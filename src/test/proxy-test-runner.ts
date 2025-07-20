/// <reference types="node" />
import * as vscode from 'vscode';
import { ProxyPoolManager } from '../server/core/ProxyPoolManager';
import { ProxyAssignmentManager } from '../server/core/ProxyAssignmentManager';
import { ProxyLoadBalancer } from '../server/core/ProxyLoadBalancer';
import ApiKeyManager from '../server/core/ApiKeyManager';
import GoogleApiForwarder from '../server/core/GoogleApiForwarder';
import { EventManager } from '../server/core/EventManager';
import { ApiKey } from '../server/types/ApiKey';
import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig();

// Mock VS Code extension context for testing
const mockContext = {
  secrets: {
    store: async (key: string, _value: string) => {
      console.log(`[MOCK] Storing secret: ${key}`);
      return Promise.resolve();
    },
    get: async (key: string) => {
      console.log(`[MOCK] Getting secret: ${key}`);
      return Promise.resolve(null);
    },
    delete: async (key: string) => {
      console.log(`[MOCK] Deleting secret: ${key}`);
      return Promise.resolve();
    },
    onDidChange: {} as any
  },
  subscriptions: [],
  workspaceState: {} as any,
  globalState: {} as any,
  extensionUri: {} as any,
  extensionPath: '',
  environmentVariableCollection: {} as any,
  extensionMode: 1,
  logUri: {} as any,
  storageUri: {} as any,
  globalStorageUri: {} as any,
  logPath: '',
  storagePath: '',
  globalStoragePath: '',
  asAbsolutePath: (relativePath: string) => relativePath,
  extension: {} as any,
  languageModelAccessInformation: {} as any
} as unknown as vscode.ExtensionContext;

interface TestConfig {
  apiKeys: string[];
  proxies: string[];
  testModel: string;
  testPrompt: string;
  rotatingProxy?: string;
  useRotatingProxy: boolean;
}

function loadTestConfig(): TestConfig {
  const config: TestConfig = {
    apiKeys: [],
    proxies: [],
    testModel: process.env.TEST_MODEL || 'gemini-2.0-flash',
    testPrompt: process.env.TEST_PROMPT || 'Hello, how are you?',
    rotatingProxy: process.env.ROTATING_PROXY,
    useRotatingProxy: Boolean(process.env.ROTATING_PROXY && process.env.ROTATING_PROXY.trim() !== '')
  };

  // Load API keys from environment (try both TEST_API_KEYS and GEMINI_API_KEYS)
  const apiKeysEnv = process.env.TEST_API_KEYS || process.env.GEMINI_API_KEYS;
  if (apiKeysEnv) {
    config.apiKeys = apiKeysEnv.split(',').map((key: string) => key.trim()).filter((key: string) => key.length > 0);
  }

  // Load proxies from environment (try both TEST_PROXIES and PROXY_SERVERS)
  const proxiesEnv = process.env.TEST_PROXIES || process.env.PROXY_SERVERS;
  if (proxiesEnv) {
    config.proxies = proxiesEnv.split(',').map((proxy: string) => proxy.trim()).filter((proxy: string) => proxy.length > 0);
  }

  return config;
}

async function testProxyPerApiKey() {
  console.log('🚀 Starting Proxy-per-API-Key Test Runner');
  console.log('=====================================');

  const config = loadTestConfig();

  // Validate configuration
  if (config.apiKeys.length === 0) {
    console.error('❌ No API keys provided. Please set TEST_API_KEYS environment variable.');
    console.log('Example: TEST_API_KEYS="key1,key2,key3"');
    process.exit(1);
  }

  if (!config.useRotatingProxy && config.proxies.length === 0) {
    console.error('❌ No proxies provided. Please set TEST_PROXIES environment variable or ROTATING_PROXY.');
    console.log('Example: TEST_PROXIES="http://proxy1:8080,http://proxy2:8080"');
    console.log('Or: ROTATING_PROXY="http://user:pass@rotating-proxy.com:80"');
    process.exit(1);
  }

  // Display configuration
  console.log('📊 Test Configuration:');
  console.log(`   API Keys: ${config.apiKeys.length} keys`);
  if (config.useRotatingProxy) {
    console.log(`   Rotating Proxy: ${config.rotatingProxy} (ENABLED)`);
    console.log(`   Individual Proxies: 0 proxies (DISABLED - using rotating proxy)`);
  } else {
    console.log(`   Individual Proxies: ${config.proxies.length} proxies`);
    console.log(`   Rotating Proxy: Not configured`);
  }
  console.log(`   Model: ${config.testModel}`);
  console.log(`   Prompt: "${config.testPrompt}"`);
  console.log('');

  try {
    // Initialize components
  console.log('🔧 Initializing proxy management components...');
  const eventManager = new EventManager();
  const proxyPoolManager = new ProxyPoolManager(eventManager, mockContext);
  await proxyPoolManager.initialize();

  const proxyAssignmentManager = new ProxyAssignmentManager(
    eventManager,
    proxyPoolManager,
    mockContext
  );
  await proxyAssignmentManager.initialize();

  const proxyLoadBalancer = new ProxyLoadBalancer('least_loaded');

  // Add proxies to the pool (only if not using rotating proxy)
  if (!config.useRotatingProxy) {
    console.log('🌐 Adding proxies to the pool...');
    for (const proxyUrl of config.proxies) {
      try {
        const proxyId = await proxyPoolManager.addProxy(proxyUrl);
        console.log(`   ✅ Added proxy: ${proxyUrl} (ID: ${proxyId})`);
      } catch (error) {
        console.log(`   ❌ Failed to add proxy ${proxyUrl}: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  // Create API key objects
  console.log('🔑 Creating API key objects...');
  const apiKeys: ApiKey[] = config.apiKeys.map((key, index) => ({
    key: key,
    keyId: `test_key_${index + 1}`,
    status: 'available' as const,
    currentRequests: 0,
    coolingDownUntil: undefined,
    usedHistory: [],
    proxy: undefined,
    assignedProxyId: undefined,
    proxyAssignedAt: undefined
  }));

  // Initialize API key manager
  const apiKeyManager = new ApiKeyManager(
    apiKeys,
    eventManager,
    mockContext,
    proxyPoolManager,
    proxyAssignmentManager,
    proxyLoadBalancer
  );
  await apiKeyManager.loadKeys(apiKeys);

  // Assign proxies to API keys (skip if using rotating proxy)
  if (config.useRotatingProxy) {
    console.log('🔗 Skipping individual proxy assignments - using rotating proxy mode');
    console.log(`   🌐 All requests will use rotating proxy: ${config.rotatingProxy}`);
  } else {
    console.log('🔗 Assigning proxies to API keys...');
    const availableProxies = proxyPoolManager.getAvailableProxies();
    
    if (availableProxies.length === 0) {
      console.error('❌ No active proxies available for assignment');
      process.exit(1);
    }

    for (let i = 0; i < apiKeys.length; i++) {
      const apiKey = apiKeys[i];
      const proxy = availableProxies[i % availableProxies.length]; // Round-robin assignment
      
      try {
        await proxyAssignmentManager.assignProxyToKey(apiKey.keyId, proxy.id, true);
        console.log(`   ✅ Assigned ${proxy.url} to ${apiKey.keyId}`);
      } catch (error) {
        console.log(`   ❌ Failed to assign proxy to ${apiKey.keyId}: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  // Test requests through assigned proxies
  console.log('🧪 Testing requests through assigned proxies...');
  const googleApiForwarder = new GoogleApiForwarder();

  for (let i = 0; i < Math.min(3, apiKeys.length); i++) { // Test first 3 keys
    const apiKey = await apiKeyManager.getAvailableKey();
    if (!apiKey) {
      console.log('   ❌ No available API key');
      continue;
    }

    const proxyInfo = config.useRotatingProxy ? config.rotatingProxy : (apiKey.proxy || 'direct');
    console.log(`🔄 Testing request with ${apiKey.keyId} through proxy: ${proxyInfo}`);
    
    try {
      const result = await googleApiForwarder.forwardRequest(
        config.testModel,
        'generateContent',
        {
          contents: [{ parts: [{ text: config.testPrompt }] }]
        },
        apiKey
      );

      if (result.error) {
        console.log(`   ❌ Request failed: ${result.error.message}`);
        if (result.error.isProxyError) {
          console.log(`      🌐 Proxy error detected for proxy: ${result.error.proxyUrl}`);
        }
      } else if (result.response) {
        console.log(`   ✅ Request successful through ${proxyInfo}`);
        console.log(`      📝 Response preview: ${JSON.stringify(result.response).substring(0, 100)}...`);
      }
    } catch (error) {
      console.log(`   ❌ Unexpected error: ${error instanceof Error ? error.message : error}`);
    }
  }

  // Generate final status report
  console.log('');
  console.log('📈 Final Status Report:');
  console.log('======================');
  
  if (config.useRotatingProxy) {
    console.log('Rotating Proxy Status:');
    console.log(`   🌐 ${config.rotatingProxy} - active (used by all ${config.apiKeys.length} keys)`);
    console.log('');
    console.log('API Key Configuration:');
    for (let i = 0; i < apiKeys.length; i++) {
      console.log(`   🔑 test_key_${i + 1} → rotating proxy (Automatic)`);
    }
  } else {
    console.log('Proxy Status:');
    const allProxies = proxyPoolManager.getAllProxies();
    for (const proxy of allProxies) {
      const statusIcon = proxy.status === 'active' ? '✅' : '❌';
      const errorInfo = proxy.status === 'error' ? `\n      Error: Failed initial health check` : '';
      console.log(`   ${statusIcon} ${proxy.url} - ${proxy.status} (${proxy.assignedKeyCount} keys assigned)${errorInfo}`);
    }

    console.log('');
    console.log('API Key Assignments:');
    const assignments = proxyAssignmentManager.getAllAssignments();
    for (const assignment of assignments) {
      const proxy = proxyPoolManager.getProxy(assignment.proxyId);
      const assignmentType = assignment.isManual ? 'Manual' : 'Automatic';
      console.log(`   🔑 ${assignment.keyId} → ${proxy?.url || 'Unknown'} (${assignmentType})`);
    }
  }

    console.log('');
    console.log('✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  }
  
  // Exit the process to stop health check timers
  process.exit(0);
}

// Run the test if this file is executed directly
if (require.main === module) {
  testProxyPerApiKey().catch(console.error);
}

export { testProxyPerApiKey };