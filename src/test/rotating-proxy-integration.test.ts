import * as assert from 'assert';
import GoogleApiForwarder from '../server/core/GoogleApiForwarder';
import ApiKeyManager from '../server/core/ApiKeyManager';
import { RotatingProxyHealthMonitor } from '../server/core/RotatingProxyHealthMonitor';
import { ProxyConfigurationManager } from '../server/core/ProxyConfigurationManager';
import { ApiKey } from '../server/types/ApiKey';
import * as vscode from 'vscode';

// Mock VS Code context
class MockExtensionContext implements vscode.ExtensionContext {
  subscriptions: vscode.Disposable[] = [];
  workspaceState: vscode.Memento = {} as any;
  globalState: vscode.Memento = {} as any;
  extensionUri: vscode.Uri = {} as any;
  extensionPath: string = '';
  environmentVariableCollection: vscode.EnvironmentVariableCollection = {} as any;
  asAbsolutePath = (relativePath: string) => relativePath;
  storageUri: vscode.Uri | undefined = undefined;
  storagePath: string | undefined = undefined;
  globalStorageUri: vscode.Uri = {} as any;
  globalStoragePath: string = '';
  logUri: vscode.Uri = {} as any;
  logPath: string = '';
  extensionMode: vscode.ExtensionMode = vscode.ExtensionMode.Test;
  extension: vscode.Extension<any> = {} as any;

  private storage = new Map<string, string>();

  secrets: vscode.SecretStorage = {
    get: async (key: string) => this.storage.get(key),
    store: async (key: string, value: string) => { this.storage.set(key, value); },
    delete: async (key: string) => { this.storage.delete(key); },
    onDidChange: {} as any
  };
}

// Mock event manager
class MockEventManager {
  emitApiKeyStatusUpdate = () => {};
  on = () => {};
  emit = () => {};
}

// Mock ProxyConfigurationManager for testing
class MockProxyConfigurationManager extends ProxyConfigurationManager {
  private mockRotatingProxyEnabled = false;
  private mockRotatingProxyUrl?: string;

  constructor(context: vscode.ExtensionContext) {
    super(context);
  }

  public setMockRotatingProxy(enabled: boolean, url?: string) {
    this.mockRotatingProxyEnabled = enabled;
    this.mockRotatingProxyUrl = url;
  }

  public isRotatingProxyEnabled(): boolean {
    return this.mockRotatingProxyEnabled;
  }

  public getRotatingProxy(): string | undefined {
    return this.mockRotatingProxyUrl;
  }
}

suite('Rotating Proxy Integration Tests', () => {
  let googleApiForwarder: GoogleApiForwarder;
  let apiKeyManager: ApiKeyManager;
  let healthMonitor: RotatingProxyHealthMonitor;
  let proxyConfigManager: MockProxyConfigurationManager;
  let mockContext: MockExtensionContext;
  let mockEventManager: MockEventManager;

  setup(() => {
    // Initialize components
    mockContext = new MockExtensionContext();
    proxyConfigManager = new MockProxyConfigurationManager(mockContext);
    healthMonitor = new RotatingProxyHealthMonitor(proxyConfigManager);
    googleApiForwarder = new GoogleApiForwarder();
    googleApiForwarder.setHealthMonitor(healthMonitor);

    // Mock event manager for ApiKeyManager
    mockEventManager = new MockEventManager();
    apiKeyManager = new ApiKeyManager([], mockEventManager as any, mockContext);
  });

  teardown(() => {
    healthMonitor.stopMonitoring();
  });

  suite('Complete Request Flow with Rotating Proxy', () => {
    test('should handle rotating proxy configuration correctly', async () => {
      // Test rotating proxy enabled
      proxyConfigManager.setMockRotatingProxy(true, 'http://test-rotate:password@proxy.example.com:8080');
      
      assert.strictEqual(proxyConfigManager.isRotatingProxyEnabled(), true);
      assert.strictEqual(proxyConfigManager.getRotatingProxy(), 'http://test-rotate:password@proxy.example.com:8080');

      // Test rotating proxy disabled
      proxyConfigManager.setMockRotatingProxy(false);
      
      assert.strictEqual(proxyConfigManager.isRotatingProxyEnabled(), false);
      assert.strictEqual(proxyConfigManager.getRotatingProxy(), undefined);
    });

    test('should load and save rotating proxy configuration', async () => {
      const testConfig = {
        enabled: true,
        url: 'http://test-rotate:pass@proxy.test.com:8080',
        isValid: true,
        errorCount: 1,
        totalRequests: 50,
        successfulRequests: 45,
        lastError: 'Timeout',
        responseTime: 200,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02')
      };

      await proxyConfigManager.saveRotatingProxyConfig(testConfig);
      const loadedConfig = await proxyConfigManager.loadRotatingProxyConfig();

      assert.strictEqual(loadedConfig.errorCount, 1);
      assert.strictEqual(loadedConfig.totalRequests, 50);
      assert.strictEqual(loadedConfig.successfulRequests, 45);
      assert.strictEqual(loadedConfig.lastError, 'Timeout');
      assert.strictEqual(loadedConfig.responseTime, 200);
    });

    test('should validate rotating proxy URLs correctly', () => {
      // Valid rotating proxy URL
      const validResult = proxyConfigManager.validateRotatingProxyUrl('http://user-rotate:pass@proxy.com:8080');
      assert.strictEqual(validResult.isValid, true);
      assert.strictEqual(validResult.hasRotateCredentials, true);
      assert.strictEqual(validResult.errors.length, 0);

      // Invalid URL
      const invalidResult = proxyConfigManager.validateRotatingProxyUrl('not-a-url');
      assert.strictEqual(invalidResult.isValid, false);
      assert(invalidResult.errors.length > 0);

      // Non-rotating credentials
      const nonRotatingResult = proxyConfigManager.validateRotatingProxyUrl('http://user:pass@proxy.com:8080');
      assert.strictEqual(nonRotatingResult.isValid, true);
      assert.strictEqual(nonRotatingResult.hasRotateCredentials, false);
      assert(nonRotatingResult.warnings.length > 0);
    });
  });

  suite('API Key Management with Rotating Proxy', () => {
    test('should preserve individual proxy assignments when rotating proxy is enabled', async () => {
      const testApiKeys: ApiKey[] = [
        {
          key: 'test-api-key-1',
          keyId: 'test-key-1',
          status: 'available',
          currentRequests: 0,
          proxy: 'http://proxy1.com:8080'
        },
        {
          key: 'test-api-key-2',
          keyId: 'test-key-2',
          status: 'available',
          currentRequests: 0,
          proxy: 'http://proxy2.com:8080'
        }
      ];

      // Load keys with individual proxies
      await apiKeyManager.loadKeys(testApiKeys);
      const loadedKeys = apiKeyManager.getAllKeys();

      // Verify individual proxy assignments are preserved
      assert.strictEqual(loadedKeys[0].proxy, 'http://proxy1.com:8080');
      assert.strictEqual(loadedKeys[1].proxy, 'http://proxy2.com:8080');

      // Enable rotating proxy
      proxyConfigManager.setMockRotatingProxy(true, 'http://rotating-proxy.com:8080');

      // Individual proxy assignments should still be preserved for fallback
      const keysAfterRotating = apiKeyManager.getAllKeys();
      assert.strictEqual(keysAfterRotating[0].proxy, 'http://proxy1.com:8080');
      assert.strictEqual(keysAfterRotating[1].proxy, 'http://proxy2.com:8080');
    });

    test('should get available keys correctly', async () => {
      const testApiKeys: ApiKey[] = [
        {
          key: 'available-key',
          keyId: 'available-1',
          status: 'available',
          currentRequests: 0
        },
        {
          key: 'cooling-key',
          keyId: 'cooling-1',
          status: 'cooling_down',
          currentRequests: 0,
          coolingDownUntil: Date.now() + 60000 // 1 minute from now
        }
      ];

      await apiKeyManager.loadKeys(testApiKeys);
      
      const availableKey = await apiKeyManager.getAvailableKey();
      assert(availableKey !== null);
      assert.strictEqual(availableKey.keyId, 'available-1');
    });
  });

  suite('Health Monitoring Integration', () => {
    test('should start and stop health monitoring', () => {
      assert.strictEqual(healthMonitor.isActive(), false);
      
      healthMonitor.startMonitoring();
      assert.strictEqual(healthMonitor.isActive(), true);
      
      healthMonitor.stopMonitoring();
      assert.strictEqual(healthMonitor.isActive(), false);
    });

    test('should record requests and calculate statistics', async () => {
      // Record successful requests
      await healthMonitor.recordRequest(true, 100);
      await healthMonitor.recordRequest(true, 150);
      await healthMonitor.recordRequest(false, 300, 'Timeout error');

      const stats = await healthMonitor.getStats();
      assert.strictEqual(stats.totalRequests, 3);
      assert.strictEqual(stats.successfulRequests, 2);
      assert.strictEqual(stats.failedRequests, 1);
      assert.strictEqual(Math.round(stats.errorRate), 33); // 1/3 ≈ 33%
    });

    test('should calculate health status correctly', async () => {
      // Record mostly successful requests
      for (let i = 0; i < 9; i++) {
        await healthMonitor.recordRequest(true, 100 + i * 10);
      }
      await healthMonitor.recordRequest(false, 500, 'Single error');

      const healthStatus = await healthMonitor.getHealthStatus();
      assert.strictEqual(healthStatus.isHealthy, true); // 90% success rate
      assert.strictEqual(healthStatus.errorCount, 1);
      assert.strictEqual(healthStatus.uptime, 90);
    });

    test('should detect unhealthy status with too many errors', async () => {
      // Record many failed requests
      for (let i = 0; i < 6; i++) {
        await healthMonitor.recordRequest(false, 500, `Error ${i}`);
      }

      const healthStatus = await healthMonitor.getHealthStatus();
      assert.strictEqual(healthStatus.isHealthy, false);
      assert.strictEqual(healthStatus.errorCount, 6);
      assert.strictEqual(healthStatus.uptime, 0);
    });
  });

  suite('Mode Switching', () => {
    test('should handle switching between proxy modes', async () => {
      const testApiKey: ApiKey = {
        key: 'test-api-key',
        keyId: 'test-key-1',
        status: 'available',
        currentRequests: 0,
        proxy: 'http://individual-proxy.com:8080'
      };

      await apiKeyManager.loadKeys([testApiKey]);

      // Start with individual proxy mode
      proxyConfigManager.setMockRotatingProxy(false);
      assert.strictEqual(proxyConfigManager.isRotatingProxyEnabled(), false);

      // Switch to rotating proxy mode
      proxyConfigManager.setMockRotatingProxy(true, 'http://rotating-proxy.com:8080');
      assert.strictEqual(proxyConfigManager.isRotatingProxyEnabled(), true);
      assert.strictEqual(proxyConfigManager.getRotatingProxy(), 'http://rotating-proxy.com:8080');

      // Individual proxy should still be preserved
      const keys = apiKeyManager.getAllKeys();
      assert.strictEqual(keys[0].proxy, 'http://individual-proxy.com:8080');
    });

    test('should update statistics when switching modes', async () => {
      // Start with some statistics
      await proxyConfigManager.updateRotatingProxyStats(true, 150);
      await proxyConfigManager.updateRotatingProxyStats(false, 300, 'Error');

      let config = await proxyConfigManager.loadRotatingProxyConfig();
      assert.strictEqual(config.totalRequests, 2);
      assert.strictEqual(config.successfulRequests, 1);
      assert.strictEqual(config.errorCount, 1);

      // Add more statistics
      await proxyConfigManager.updateRotatingProxyStats(true, 120);
      config = await proxyConfigManager.loadRotatingProxyConfig();
      assert.strictEqual(config.totalRequests, 3);
      assert.strictEqual(config.successfulRequests, 2);
      assert.strictEqual(config.errorCount, 0); // Reset on success
    });
  });

  suite('Error Handling and Fallback', () => {
    test('should handle configuration errors gracefully', async () => {
      // Test with invalid configuration
      const invalidConfig = await proxyConfigManager.loadRotatingProxyConfig();
      
      // Should not throw errors and provide defaults
      assert.strictEqual(typeof invalidConfig.enabled, 'boolean');
      assert.strictEqual(typeof invalidConfig.url, 'string');
      assert.strictEqual(typeof invalidConfig.errorCount, 'number');
      assert.strictEqual(typeof invalidConfig.totalRequests, 'number');
    });

    test('should validate proxy URLs and provide feedback', () => {
      // Test various invalid URLs
      const testCases = [
        { url: '', shouldBeValid: false },
        { url: 'not-a-url', shouldBeValid: false },
        { url: 'ftp://user:pass@proxy.com:21', shouldBeValid: false },
        { url: 'http://user-rotate:pass@proxy.com:8080', shouldBeValid: true },
        { url: 'https://user-rotate:pass@proxy.com:443', shouldBeValid: true },
        { url: 'socks5://user-rotate:pass@proxy.com:1080', shouldBeValid: true }
      ];

      testCases.forEach(testCase => {
        const result = proxyConfigManager.validateRotatingProxyUrl(testCase.url);
        assert.strictEqual(result.isValid, testCase.shouldBeValid, 
          `URL "${testCase.url}" validation failed. Expected: ${testCase.shouldBeValid}, Got: ${result.isValid}`);
      });
    });

    test('should handle health monitoring errors gracefully', async () => {
      // Start monitoring
      healthMonitor.startMonitoring();
      
      // Record various types of requests
      await healthMonitor.recordRequest(true, 100);
      await healthMonitor.recordRequest(false, undefined, 'Network error');
      await healthMonitor.recordRequest(true, 0); // Zero response time
      await healthMonitor.recordRequest(false, 5000, 'Very slow timeout');

      // Should not throw errors
      const stats = await healthMonitor.getStats();
      const healthStatus = await healthMonitor.getHealthStatus();

      assert.strictEqual(typeof stats.totalRequests, 'number');
      assert.strictEqual(typeof healthStatus.isHealthy, 'boolean');
    });
  });

  suite('Configuration Persistence', () => {
    test('should persist and restore rotating proxy configuration', async () => {
      const originalConfig = {
        enabled: true,
        url: 'http://persist-test:pass@proxy.com:8080',
        isValid: true,
        errorCount: 3,
        totalRequests: 100,
        successfulRequests: 85,
        lastError: 'Connection refused',
        responseTime: 250,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T11:00:00Z')
      };

      // Save configuration
      await proxyConfigManager.saveRotatingProxyConfig(originalConfig);

      // Create new manager instance to test persistence
      const newContext = new MockExtensionContext();
      // Copy storage from original context
      for (const [key, value] of (mockContext.secrets as any).storage) {
        await newContext.secrets.store(key, value);
      }
      
      const newProxyConfigManager = new MockProxyConfigurationManager(newContext);
      const restoredConfig = await newProxyConfigManager.loadRotatingProxyConfig();

      // Verify all fields are restored correctly
      assert.strictEqual(restoredConfig.errorCount, originalConfig.errorCount);
      assert.strictEqual(restoredConfig.totalRequests, originalConfig.totalRequests);
      assert.strictEqual(restoredConfig.successfulRequests, originalConfig.successfulRequests);
      assert.strictEqual(restoredConfig.lastError, originalConfig.lastError);
      assert.strictEqual(restoredConfig.responseTime, originalConfig.responseTime);
    });

    test('should handle corrupted configuration data', async () => {
      // Store invalid JSON
      await mockContext.secrets.store('geminiRotatingProxyConfig', 'invalid-json{');

      // Should handle gracefully and return defaults
      const config = await proxyConfigManager.loadRotatingProxyConfig();
      
      assert.strictEqual(config.enabled, false);
      assert.strictEqual(config.url, '');
      assert.strictEqual(config.errorCount, 0);
      assert.strictEqual(config.totalRequests, 0);
    });
  });
});