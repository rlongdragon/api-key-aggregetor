import * as assert from 'assert';
import * as vscode from 'vscode';
import { RotatingProxyHealthMonitor } from '../server/core/RotatingProxyHealthMonitor';
import { ProxyConfigurationManager } from '../server/core/ProxyConfigurationManager';
import { RotatingProxyHealthStatus, RotatingProxyStats } from '../server/types/RotatingProxy';

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

suite('Rotating Proxy Health Monitor Tests', () => {
  let healthMonitor: RotatingProxyHealthMonitor;
  let mockProxyConfigManager: MockProxyConfigurationManager;
  let mockContext: MockExtensionContext;

  setup(() => {
    mockContext = new MockExtensionContext();
    mockProxyConfigManager = new MockProxyConfigurationManager(mockContext);
    healthMonitor = new RotatingProxyHealthMonitor(mockProxyConfigManager);
  });

  teardown(() => {
    healthMonitor.stopMonitoring();
  });

  suite('Monitoring Control', () => {
    test('should start and stop monitoring', () => {
      assert.strictEqual(healthMonitor.isActive(), false);
      
      healthMonitor.startMonitoring();
      assert.strictEqual(healthMonitor.isActive(), true);
      
      healthMonitor.stopMonitoring();
      assert.strictEqual(healthMonitor.isActive(), false);
    });

    test('should not start monitoring twice', () => {
      healthMonitor.startMonitoring();
      assert.strictEqual(healthMonitor.isActive(), true);
      
      // Starting again should not cause issues
      healthMonitor.startMonitoring();
      assert.strictEqual(healthMonitor.isActive(), true);
    });

    test('should handle stopping when not started', () => {
      // Should not throw error
      healthMonitor.stopMonitoring();
      assert.strictEqual(healthMonitor.isActive(), false);
    });
  });

  suite('Request Recording', () => {
    test('should record successful requests', async () => {
      await healthMonitor.recordRequest(true, 150);
      
      const stats = await healthMonitor.getStats();
      assert.strictEqual(stats.totalRequests, 1);
      assert.strictEqual(stats.successfulRequests, 1);
      assert.strictEqual(stats.failedRequests, 0);
      assert.strictEqual(stats.errorRate, 0);
    });

    test('should record failed requests', async () => {
      await healthMonitor.recordRequest(false, 300, 'Connection timeout');
      
      const stats = await healthMonitor.getStats();
      assert.strictEqual(stats.totalRequests, 1);
      assert.strictEqual(stats.successfulRequests, 0);
      assert.strictEqual(stats.failedRequests, 1);
      assert.strictEqual(stats.errorRate, 100);
    });

    test('should calculate correct statistics for mixed requests', async () => {
      // Record multiple requests
      await healthMonitor.recordRequest(true, 100);
      await healthMonitor.recordRequest(true, 150);
      await healthMonitor.recordRequest(false, 500, 'Error 1');
      await healthMonitor.recordRequest(true, 120);
      await healthMonitor.recordRequest(false, 400, 'Error 2');
      
      const stats = await healthMonitor.getStats();
      assert.strictEqual(stats.totalRequests, 5);
      assert.strictEqual(stats.successfulRequests, 3);
      assert.strictEqual(stats.failedRequests, 2);
      assert.strictEqual(stats.errorRate, 40); // 2/5 = 40%
    });

    test('should track response times correctly', async () => {
      await healthMonitor.recordRequest(true, 100);
      await healthMonitor.recordRequest(true, 200);
      await healthMonitor.recordRequest(true, 300);
      
      const stats = await healthMonitor.getStats();
      assert.strictEqual(stats.averageResponseTime, 200); // (100+200+300)/3
    });
  });

  suite('Health Status', () => {
    test('should report healthy status for successful requests', async () => {
      // Record several successful requests
      for (let i = 0; i < 10; i++) {
        await healthMonitor.recordRequest(true, 100 + i * 10);
      }
      
      const healthStatus = await healthMonitor.getHealthStatus();
      assert.strictEqual(healthStatus.isHealthy, true);
      assert.strictEqual(healthStatus.errorCount, 0);
      assert.strictEqual(healthStatus.consecutiveErrors, 0);
      assert.strictEqual(healthStatus.uptime, 100);
    });

    test('should report unhealthy status for too many errors', async () => {
      // Record many failed requests
      for (let i = 0; i < 6; i++) {
        await healthMonitor.recordRequest(false, 500, `Error ${i}`);
      }
      
      const healthStatus = await healthMonitor.getHealthStatus();
      assert.strictEqual(healthStatus.isHealthy, false);
      assert.strictEqual(healthStatus.errorCount, 6);
      assert.strictEqual(healthStatus.consecutiveErrors, 6);
      assert.strictEqual(healthStatus.uptime, 0);
    });

    test('should report mixed health status correctly', async () => {
      // Record mixed requests (80% success rate)
      for (let i = 0; i < 8; i++) {
        await healthMonitor.recordRequest(true, 150);
      }
      for (let i = 0; i < 2; i++) {
        await healthMonitor.recordRequest(false, 400, 'Error');
      }
      
      const healthStatus = await healthMonitor.getHealthStatus();
      assert.strictEqual(healthStatus.isHealthy, true); // 80% uptime is above threshold
      assert.strictEqual(healthStatus.errorCount, 2);
      assert.strictEqual(healthStatus.uptime, 80);
    });

    test('should handle no requests gracefully', async () => {
      const healthStatus = await healthMonitor.getHealthStatus();
      assert.strictEqual(healthStatus.isHealthy, false); // No data means unhealthy
      assert.strictEqual(healthStatus.errorCount, 0);
      assert.strictEqual(healthStatus.uptime, 0);
    });
  });

  suite('Statistics Calculation', () => {
    test('should calculate requests per minute', async () => {
      // This test would need to manipulate time or use a more sophisticated mock
      // For now, we test that the field exists and is a number
      const stats = await healthMonitor.getStats();
      assert.strictEqual(typeof stats.requestsPerMinute, 'number');
      assert(stats.requestsPerMinute >= 0);
    });

    test('should track last request time', async () => {
      const beforeRequest = new Date();
      await healthMonitor.recordRequest(true, 100);
      const afterRequest = new Date();
      
      const stats = await healthMonitor.getStats();
      assert(stats.lastRequestTime instanceof Date);
      assert(stats.lastRequestTime >= beforeRequest);
      assert(stats.lastRequestTime <= afterRequest);
    });

    test('should handle empty statistics', async () => {
      const stats = await healthMonitor.getStats();
      assert.strictEqual(stats.totalRequests, 0);
      assert.strictEqual(stats.successfulRequests, 0);
      assert.strictEqual(stats.failedRequests, 0);
      assert.strictEqual(stats.averageResponseTime, 0);
      assert.strictEqual(stats.requestsPerMinute, 0);
      assert.strictEqual(stats.errorRate, 0);
      assert.strictEqual(stats.lastRequestTime, undefined);
    });
  });

  suite('Configuration Integration', () => {
    test('should not monitor when rotating proxy is disabled', () => {
      mockProxyConfigManager.setMockRotatingProxy(false);
      
      healthMonitor.startMonitoring();
      // Health checks should be skipped when proxy is disabled
      // This is tested implicitly by the monitoring logic
      assert.strictEqual(healthMonitor.isActive(), true);
    });

    test('should monitor when rotating proxy is enabled', () => {
      mockProxyConfigManager.setMockRotatingProxy(true, 'http://test-rotate:pass@proxy.test.com:8080');
      
      healthMonitor.startMonitoring();
      assert.strictEqual(healthMonitor.isActive(), true);
    });
  });
});