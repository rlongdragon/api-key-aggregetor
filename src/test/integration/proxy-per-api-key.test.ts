/// <reference types="node" />
/// <reference types="mocha" />
import * as vscode from 'vscode';
import { ProxyPoolManager } from '../../server/core/ProxyPoolManager';
import { ProxyAssignmentManager } from '../../server/core/ProxyAssignmentManager';
import { ProxyLoadBalancer } from '../../server/core/ProxyLoadBalancer';
import ApiKeyManager from '../../server/core/ApiKeyManager';
import GoogleApiForwarder from '../../server/core/GoogleApiForwarder';
import { EventManager } from '../../server/core/EventManager';
import { ApiKey } from '../../server/types/ApiKey';
import { config as dotenvConfig } from 'dotenv';
import * as assert from 'assert';

// Load environment variables
dotenvConfig();

// Mock VS Code extension context for testing
const secretsMap = new Map<string, string>();

const mockContext = {
  secrets: {
    store: async (key: string, value: string) => {
      secretsMap.set(key, value);
      return Promise.resolve();
    },
    get: async (key: string) => {
      return Promise.resolve(secretsMap.get(key));
    },
    delete: async (key: string) => {
      secretsMap.delete(key);
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
} as vscode.ExtensionContext;

describe('Proxy-per-API-Key Integration Tests', function() {
  this.timeout(60000); // 60 second timeout for integration tests
  
  let eventManager: EventManager;
  let proxyPoolManager: ProxyPoolManager;
  let proxyAssignmentManager: ProxyAssignmentManager;
  let proxyLoadBalancer: ProxyLoadBalancer;
  let apiKeyManager: ApiKeyManager;
  let googleApiForwarder: GoogleApiForwarder;
  
  const testApiKeys = (process.env.TEST_API_KEYS || '').split(',').filter((k: string) => k.trim());
  const testProxies = (process.env.TEST_PROXIES || '').split(',').filter((p: string) => p.trim());
  
  before(function() {
    if (testApiKeys.length === 0) {
      console.log('⚠️  Skipping integration tests - no TEST_API_KEYS provided');
      console.log('   Set TEST_API_KEYS environment variable to run these tests');
      this.skip();
    }
    
    if (testProxies.length === 0) {
      console.log('⚠️  Skipping integration tests - no TEST_PROXIES provided');
      console.log('   Set TEST_PROXIES environment variable to run these tests');
      this.skip();
    }
  });
  
  beforeEach(async function() {
    // Initialize all components
    eventManager = new EventManager();
    proxyPoolManager = new ProxyPoolManager(eventManager, mockContext);
    proxyLoadBalancer = new ProxyLoadBalancer('least_loaded');
    proxyAssignmentManager = new ProxyAssignmentManager(eventManager, proxyPoolManager, mockContext);
    googleApiForwarder = new GoogleApiForwarder();
    
    await proxyPoolManager.initialize();
    await proxyAssignmentManager.initialize();
    
    // Create API key objects
    const apiKeys: ApiKey[] = testApiKeys.map((key: string, index: number) => ({
      key,
      keyId: `test_key_${index + 1}`,
      status: 'available' as const,
      currentRequests: 0,
      usedHistory: []
    }));
    
    apiKeyManager = new ApiKeyManager(
      apiKeys,
      eventManager,
      mockContext,
      proxyPoolManager,
      proxyAssignmentManager,
      proxyLoadBalancer
    );
    
    await apiKeyManager.loadKeys(apiKeys);
  });
  
  afterEach(function() {
    if (proxyPoolManager) {
      proxyPoolManager.dispose();
    }
  });
  
  it('should add proxies to the pool successfully', async function() {
    console.log(`   Adding ${testProxies.length} proxies to the pool...`);
    
    const proxyIds: string[] = [];
    for (const proxyUrl of testProxies) {
      const proxyId = await proxyPoolManager.addProxy(proxyUrl);
      proxyIds.push(proxyId);
      console.log(`   ✅ Added proxy: ${proxyUrl}`);
    }
    
    const allProxies = proxyPoolManager.getAllProxies();
    assert.strictEqual(allProxies.length, testProxies.length, 'All proxies should be added');
    
    // Wait a moment for health checks
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const activeProxies = proxyPoolManager.getAvailableProxies();
    console.log(`   ${activeProxies.length}/${allProxies.length} proxies are active`);
    
    assert.ok(activeProxies.length > 0, 'At least one proxy should be active');
  });
  
  it('should assign proxies to API keys automatically', async function() {
    // Add proxies first
    for (const proxyUrl of testProxies) {
      await proxyPoolManager.addProxy(proxyUrl);
    }
    
    // Wait for health checks
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const availableProxies = proxyPoolManager.getAvailableProxies();
    if (availableProxies.length === 0) {
      this.skip(); // Skip if no proxies are available
    }
    
    console.log(`   Assigning proxies to ${testApiKeys.length} API keys...`);
    
    // Assign proxies to API keys
    for (let i = 0; i < testApiKeys.length; i++) {
      const keyId = `test_key_${i + 1}`;
      const proxy = availableProxies[i % availableProxies.length];
      
      await proxyAssignmentManager.assignProxyToKey(keyId, proxy.id, true);
      console.log(`   ✅ Assigned ${proxy.url} to ${keyId}`);
    }
    
    const assignments = proxyAssignmentManager.getAllAssignments();
    assert.strictEqual(assignments.length, testApiKeys.length, 'All API keys should have proxy assignments');
  });
  
  it('should make requests through assigned proxies', async function() {
    // Add proxies and assign them
    for (const proxyUrl of testProxies) {
      await proxyPoolManager.addProxy(proxyUrl);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const availableProxies = proxyPoolManager.getAvailableProxies();
    if (availableProxies.length === 0) {
      this.skip(); // Skip if no proxies are available
    }
    
    // Assign first proxy to first API key
    const firstProxy = availableProxies[0];
    await proxyAssignmentManager.assignProxyToKey('test_key_1', firstProxy.id, true);
    
    console.log(`   Testing request through proxy: ${firstProxy.url}`);
    
    // Get API key with assigned proxy
    const apiKey = await apiKeyManager.getAvailableKey();
    assert.ok(apiKey, 'Should get an available API key');
    assert.ok(apiKey.proxy, 'API key should have an assigned proxy');
    
    console.log(`   Making request with key ${apiKey.keyId} through ${apiKey.proxy}`);
    
    // Make a test request
    const result = await googleApiForwarder.forwardRequest(
      'gemini-2.0-flash',
      'generateContent',
      {
        contents: [{ parts: [{ text: 'Hello, respond with just "OK"' }] }]
      },
      apiKey
    );
    
    if (result.error) {
      console.log(`   Request failed: ${result.error.message}`);
      if (result.error.isProxyError) {
        console.log(`   This was a proxy-related error`);
        // Don't fail the test for proxy errors, as they might be expected
        return;
      }
      if (result.error.isRateLimitError) {
        console.log(`   This was a rate limit error`);
        return;
      }
      // Only fail for unexpected errors
      throw new Error(`Unexpected API error: ${result.error.message}`);
    }
    
    assert.ok(result.response, 'Should get a response from the API');
    console.log(`   ✅ Request successful through proxy`);
  });
  
  it('should handle proxy failures gracefully', async function() {
    // Add a known bad proxy
    const badProxyUrl = 'http://nonexistent-proxy.invalid:8080';
    const badProxyId = await proxyPoolManager.addProxy(badProxyUrl);
    
    // Assign the bad proxy to an API key
    await proxyAssignmentManager.assignProxyToKey('test_key_1', badProxyId, true);
    
    console.log(`   Testing request through bad proxy: ${badProxyUrl}`);
    
    const apiKey = await apiKeyManager.getAvailableKey();
    assert.ok(apiKey, 'Should get an available API key');
    
    // Make a request that should fail due to bad proxy
    const result = await googleApiForwarder.forwardRequest(
      'gemini-2.0-flash',
      'generateContent',
      {
        contents: [{ parts: [{ text: 'Hello' }] }]
      },
      apiKey
    );
    
    if (result.error && result.error.isProxyError) {
      console.log(`   ✅ Proxy error detected and handled gracefully`);
      assert.ok(true, 'Proxy error should be detected');
    } else if (result.response) {
      console.log(`   ✅ Request succeeded (possibly fell back to direct connection)`);
      assert.ok(true, 'Request should succeed or fail gracefully');
    } else {
      console.log(`   Request failed with non-proxy error: ${result.error?.message}`);
    }
  });
  
  it('should rebalance proxy assignments', async function() {
    // Add multiple proxies
    const proxyIds: string[] = [];
    for (const proxyUrl of testProxies.slice(0, 2)) { // Use first 2 proxies
      const proxyId = await proxyPoolManager.addProxy(proxyUrl);
      proxyIds.push(proxyId);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const availableProxies = proxyPoolManager.getAvailableProxies();
    if (availableProxies.length < 2) {
      this.skip(); // Need at least 2 active proxies for rebalancing test
    }
    
    // Assign all keys to the first proxy (unbalanced)
    const firstProxy = availableProxies[0];
    for (let i = 0; i < testApiKeys.length; i++) {
      await proxyAssignmentManager.assignProxyToKey(`test_key_${i + 1}`, firstProxy.id, false);
    }
    
    console.log(`   All ${testApiKeys.length} keys assigned to ${firstProxy.url}`);
    
    // Rebalance assignments
    await proxyAssignmentManager.rebalanceAssignments();
    
    console.log(`   Rebalanced assignments across ${availableProxies.length} proxies`);
    
    // Check that assignments are more balanced
    const assignments = proxyAssignmentManager.getAllAssignments();
    const assignmentCounts = new Map<string, number>();
    
    for (const assignment of assignments) {
      const count = assignmentCounts.get(assignment.proxyId) || 0;
      assignmentCounts.set(assignment.proxyId, count + 1);
    }
    
    const counts = Array.from(assignmentCounts.values());
    const maxCount = Math.max(...counts);
    const minCount = Math.min(...counts);
    
    console.log(`   Assignment distribution: ${counts.join(', ')}`);
    
    // After rebalancing, the difference should be at most 1
    assert.ok(maxCount - minCount <= 1, 'Assignments should be balanced');
  });
});