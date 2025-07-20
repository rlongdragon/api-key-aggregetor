import * as assert from 'assert';
import * as vscode from 'vscode';
import { ProxyConfigurationManager } from '../server/core/ProxyConfigurationManager';
import { RotatingProxyValidation } from '../server/types/RotatingProxy';

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

suite('Rotating Proxy Configuration Tests', () => {
  let proxyConfigManager: ProxyConfigurationManager;
  let mockContext: MockExtensionContext;

  setup(() => {
    mockContext = new MockExtensionContext();
    proxyConfigManager = new ProxyConfigurationManager(mockContext);
  });

  suite('URL Validation', () => {
    test('should validate correct HTTP rotating proxy URL', () => {
      const url = 'http://username-rotate:password@proxy.example.com:8080';
      const result: RotatingProxyValidation = proxyConfigManager.validateRotatingProxyUrl(url);
      
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.hasRotateCredentials, true);
      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.parsedUrl?.hostname, 'proxy.example.com');
      assert.strictEqual(result.parsedUrl?.port, '8080');
    });

    test('should validate correct HTTPS rotating proxy URL', () => {
      const url = 'https://user-rotate:pass@secure-proxy.com:443';
      const result = proxyConfigManager.validateRotatingProxyUrl(url);
      
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.hasRotateCredentials, true);
      assert.strictEqual(result.errors.length, 0);
    });

    test('should validate SOCKS5 rotating proxy URL', () => {
      const url = 'socks5://rotate-user:secret@socks.proxy.com:1080';
      const result = proxyConfigManager.validateRotatingProxyUrl(url);
      
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.hasRotateCredentials, true);
      assert.strictEqual(result.errors.length, 0);
    });

    test('should reject empty URL', () => {
      const result = proxyConfigManager.validateRotatingProxyUrl('');
      
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.length, 1);
      assert.strictEqual(result.errors[0], 'Rotating proxy URL cannot be empty');
    });

    test('should reject invalid URL format', () => {
      const result = proxyConfigManager.validateRotatingProxyUrl('not-a-url');
      
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.length, 1);
      assert(result.errors[0].includes('Invalid URL format'));
    });

    test('should reject unsupported protocol', () => {
      const url = 'ftp://user:pass@proxy.com:21';
      const result = proxyConfigManager.validateRotatingProxyUrl(url);
      
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.length, 1);
      assert(result.errors[0].includes('Unsupported protocol: ftp:'));
    });

    test('should warn about non-rotating credentials', () => {
      const url = 'http://normaluser:password@proxy.example.com:8080';
      const result = proxyConfigManager.validateRotatingProxyUrl(url);
      
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.hasRotateCredentials, false);
      assert.strictEqual(result.warnings.length, 1);
      assert(result.warnings[0].includes('does not follow rotating proxy pattern'));
    });

    test('should require password when username is provided', () => {
      const url = 'http://username-rotate@proxy.example.com:8080';
      const result = proxyConfigManager.validateRotatingProxyUrl(url);
      
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.length, 1);
      assert.strictEqual(result.errors[0], 'Password is required when username is provided');
    });

    test('should warn about missing port', () => {
      const url = 'http://user-rotate:pass@proxy.example.com';
      const result = proxyConfigManager.validateRotatingProxyUrl(url);
      
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.warnings.length, 1);
      assert(result.warnings[0].includes('No port specified'));
    });
  });

  suite('Configuration Management', () => {
    test('should load default rotating proxy configuration', async () => {
      const config = await proxyConfigManager.loadRotatingProxyConfig();
      
      assert.strictEqual(config.enabled, false); // Default when no env var
      assert.strictEqual(config.url, '');
      assert.strictEqual(config.isValid, false);
      assert.strictEqual(config.errorCount, 0);
      assert.strictEqual(config.totalRequests, 0);
      assert.strictEqual(config.successfulRequests, 0);
    });

    test('should save and load rotating proxy configuration', async () => {
      const testConfig = {
        enabled: true,
        url: 'http://test-rotate:pass@proxy.test.com:8080',
        isValid: true,
        errorCount: 2,
        totalRequests: 100,
        successfulRequests: 95,
        lastError: 'Connection timeout',
        responseTime: 250,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02')
      };

      await proxyConfigManager.saveRotatingProxyConfig(testConfig);
      const loadedConfig = await proxyConfigManager.loadRotatingProxyConfig();

      assert.strictEqual(loadedConfig.errorCount, 2);
      assert.strictEqual(loadedConfig.totalRequests, 100);
      assert.strictEqual(loadedConfig.successfulRequests, 95);
      assert.strictEqual(loadedConfig.lastError, 'Connection timeout');
      assert.strictEqual(loadedConfig.responseTime, 250);
    });

    test('should update rotating proxy statistics', async () => {
      // Start with clean config
      const initialConfig = await proxyConfigManager.loadRotatingProxyConfig();
      assert.strictEqual(initialConfig.totalRequests, 0);
      assert.strictEqual(initialConfig.successfulRequests, 0);

      // Record successful request
      await proxyConfigManager.updateRotatingProxyStats(true, 150);
      let config = await proxyConfigManager.loadRotatingProxyConfig();
      assert.strictEqual(config.totalRequests, 1);
      assert.strictEqual(config.successfulRequests, 1);
      assert.strictEqual(config.errorCount, 0);
      assert.strictEqual(config.responseTime, 150);

      // Record failed request
      await proxyConfigManager.updateRotatingProxyStats(false, 300, 'Timeout error');
      config = await proxyConfigManager.loadRotatingProxyConfig();
      assert.strictEqual(config.totalRequests, 2);
      assert.strictEqual(config.successfulRequests, 1);
      assert.strictEqual(config.errorCount, 1);
      assert.strictEqual(config.lastError, 'Timeout error');
      assert.strictEqual(config.responseTime, 300);

      // Record another successful request (should reset error count)
      await proxyConfigManager.updateRotatingProxyStats(true, 120);
      config = await proxyConfigManager.loadRotatingProxyConfig();
      assert.strictEqual(config.totalRequests, 3);
      assert.strictEqual(config.successfulRequests, 2);
      assert.strictEqual(config.errorCount, 0); // Reset on success
      assert.strictEqual(config.responseTime, 120);
    });
  });

  suite('Environment Variable Integration', () => {
    test('should detect rotating proxy from environment', () => {
      // Note: This test would need to mock the config module
      // For now, we test the methods that check the configuration
      
      const rotatingProxy = proxyConfigManager.getRotatingProxy();
      const isEnabled = proxyConfigManager.isRotatingProxyEnabled();
      
      // These will return undefined/false in test environment
      assert.strictEqual(typeof rotatingProxy, 'string' || 'undefined');
      assert.strictEqual(typeof isEnabled, 'boolean');
    });
  });
});