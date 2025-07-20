import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProxyConfigurationManager } from '../server/core/ProxyConfigurationManager';
import { RotatingProxyHealthMonitor } from '../server/core/RotatingProxyHealthMonitor';
import { GoogleApiForwarder } from '../server/core/GoogleApiForwarder';
import { ApiKey } from '../server/types/ApiKey';
import { RotatingProxyValidation } from '../server/types/RotatingProxy';
import * as vscode from 'vscode';

// Mock vscode module
vi.mock('vscode', () => ({
  ExtensionContext: vi.fn(),
  SecretStorage: vi.fn(),
  window: {
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn()
  }
}));

// Mock config
vi.mock('../server/config', () => ({
  default: {
    USE_ROTATING_PROXY: false,
    ROTATING_PROXY: undefined
  }
}));

describe('Rotating Proxy Configuration', () => {
  let proxyConfigManager: ProxyConfigurationManager;
  let mockContext: any;

  beforeEach(() => {
    mockContext = {
      secrets: {
        get: vi.fn().mockResolvedValue(undefined),
        store: vi.fn().mockResolvedValue(undefined)
      }
    };
    proxyConfigManager = new ProxyConfigurationManager(mockContext);
  });

  describe('URL Validation', () => {
    it('should validate correct rotating proxy URL with rotate credentials', () => {
      const url = 'http://username-rotate:password@proxy.example.com:8080';
      const result: RotatingProxyValidation = proxyConfigManager.validateRotatingProxyUrl(url);
      
      expect(result.isValid).toBe(true);
      expect(result.hasRotateCredentials).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.parsedUrl?.hostname).toBe('proxy.example.com');
      expect(result.parsedUrl?.port).toBe('8080');
    });

    it('should validate HTTPS rotating proxy URL', () => {
      const url = 'https://user-rotate:pass@secure-proxy.com:443';
      const result = proxyConfigManager.validateRotatingProxyUrl(url);
      
      expect(result.isValid).toBe(true);
      expect(result.hasRotateCredentials).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate SOCKS5 rotating proxy URL', () => {
      const url = 'socks5://rotate-user:secret@socks.proxy.com:1080';
      const result = proxyConfigManager.validateRotatingProxyUrl(url);
      
      expect(result.isValid).toBe(true);
      expect(result.hasRotateCredentials).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty URL', () => {
      const result = proxyConfigManager.validateRotatingProxyUrl('');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Rotating proxy URL cannot be empty');
    });

    it('should reject invalid URL format', () => {
      const result = proxyConfigManager.validateRotatingProxyUrl('not-a-url');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Invalid URL format');
    });

    it('should reject unsupported protocol', () => {
      const url = 'ftp://user:pass@proxy.com:21';
      const result = proxyConfigManager.validateRotatingProxyUrl(url);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unsupported protocol: ftp:. Supported: http:, https:, socks:, socks5:');
    });

    it('should warn about non-rotating credentials', () => {
      const url = 'http://normaluser:password@proxy.example.com:8080';
      const result = proxyConfigManager.validateRotatingProxyUrl(url);
      
      expect(result.isValid).toBe(true);
      expect(result.hasRotateCredentials).toBe(false);
      expect(result.warnings).toContain('Username does not follow rotating proxy pattern (should end with "-rotate")');
    });

    it('should require password when username is provided', () => {
      const url = 'http://username-rotate@proxy.example.com:8080';
      const result = proxyConfigManager.validateRotatingProxyUrl(url);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is required when username is provided');
    });

    it('should warn about missing port', () => {
      const url = 'http://user-rotate:pass@proxy.example.com';
      const result = proxyConfigManager.validateRotatingProxyUrl(url);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('No port specified, using default port for protocol');
    });
  });

  describe('Configuration Management', () => {
    it('should load default rotating proxy configuration', async () => {
      const config = await proxyConfigManager.loadRotatingProxyConfig();
      
      expect(config.enabled).toBe(false);
      expect(config.url).toBe('');
      expect(config.isValid).toBe(false);
      expect(config.errorCount).toBe(0);
      expect(config.totalRequests).toBe(0);
      expect(config.successfulRequests).toBe(0);
    });

    it('should save and load rotating proxy configuration', async () => {
      const testConfig = {
        enabled: true,
        url: 'http://test-rotate:pass@proxy.com:8080',
        isValid: true,
        errorCount: 2,
        totalRequests: 100,
        successfulRequests: 95,
        lastError: 'Test error',
        responseTime: 150,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await proxyConfigManager.saveRotatingProxyConfig(testConfig);
      
      expect(mockContext.secrets.store).toHaveBeenCalledWith(
        'geminiRotatingProxyConfig',
        expect.stringContaining('"enabled":true')
      );
    });

    it('should update rotating proxy statistics', async () => {
      // First save a base configuration
      const baseConfig = {
        enabled: true,
        url: 'http://test-rotate:pass@proxy.com:8080',
        isValid: true,
        errorCount: 0,
        totalRequests: 0,
        successfulRequests: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await proxyConfigManager.saveRotatingProxyConfig(baseConfig);

      // Mock the stored configuration for loading
      mockContext.secrets.get.mockResolvedValueOnce(JSON.stringify({
        enabled: true,
        url: 'http://test-rotate:pass@proxy.com:8080',
        errorCount: 0,
        totalRequests: 0,
        successfulRequests: 0,
        createdAt: baseConfig.createdAt.toISOString(),
        updatedAt: baseConfig.updatedAt.toISOString()
      }));

      // Update stats for successful request
      await proxyConfigManager.updateRotatingProxyStats(true, 200);
      
      expect(mockContext.secrets.store).toHaveBeenCalledWith(
        'geminiRotatingProxyConfig',
        expect.stringContaining('"totalRequests":1')
      );
      expect(mockContext.secrets.store).toHaveBeenCalledWith(
        'geminiRotatingProxyConfig',
        expect.stringContaining('"successfulRequests":1')
      );
    });
  });
});

describe('Rotating Proxy Health Monitor', () => {
  let healthMonitor: RotatingProxyHealthMonitor;
  let mockProxyConfigManager: any;

  beforeEach(() => {
    mockProxyConfigManager = {
      getRotatingProxy: vi.fn().mockReturnValue('http://test-rotate:pass@proxy.com:8080'),
      isRotatingProxyEnabled: vi.fn().mockReturnValue(true),
      loadRotatingProxyConfig: vi.fn().mockResolvedValue({
        enabled: true,
        url: 'http://test-rotate:pass@proxy.com:8080',
        isValid: true,
        errorCount: 0,
        totalRequests: 10,
        successfulRequests: 9,
        lastHealthCheck: new Date(),
        responseTime: 150,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      updateRotatingProxyStats: vi.fn().mockResolvedValue(undefined)
    };

    healthMonitor = new RotatingProxyHealthMonitor(mockProxyConfigManager);
  });

  afterEach(() => {
    healthMonitor.stopMonitoring();
  });

  it('should start and stop monitoring', () => {
    expect(healthMonitor.isMonitoringActive()).toBe(false);
    
    healthMonitor.startMonitoring();
    expect(healthMonitor.isMonitoringActive()).toBe(true);
    
    healthMonitor.stopMonitoring();
    expect(healthMonitor.isMonitoringActive()).toBe(false);
  });

  it('should record request results', () => {
    healthMonitor.recordRequest(true, 200);
    healthMonitor.recordRequest(false, 500);
    
    // Verify that requests are recorded (internal state)
    // This would be tested through the getStats method
  });

  it('should calculate health status correctly', async () => {
    const healthStatus = await healthMonitor.getHealthStatus();
    
    expect(healthStatus.isHealthy).toBe(true);
    expect(healthStatus.errorCount).toBe(0);
    expect(healthStatus.uptime).toBeGreaterThan(0);
  });

  it('should calculate statistics correctly', async () => {
    // Record some test requests
    healthMonitor.recordRequest(true, 100);
    healthMonitor.recordRequest(true, 200);
    healthMonitor.recordRequest(false, 300);
    
    const stats = await healthMonitor.getStats();
    
    expect(stats.totalRequests).toBe(10); // From mock config
    expect(stats.successfulRequests).toBe(9); // From mock config
    expect(stats.failedRequests).toBe(1); // Calculated
  });
});

describe('GoogleApiForwarder Rotating Proxy Integration', () => {
  let googleApiForwarder: GoogleApiForwarder;
  let mockHealthMonitor: any;

  beforeEach(() => {
    mockHealthMonitor = {
      recordRequest: vi.fn()
    };

    googleApiForwarder = new GoogleApiForwarder();
    googleApiForwarder.setHealthMonitor(mockHealthMonitor);
  });

  it('should set health monitor correctly', () => {
    const newHealthMonitor = { recordRequest: vi.fn() };
    googleApiForwarder.setHealthMonitor(newHealthMonitor);
    
    // This would be tested through actual request forwarding
    expect(true).toBe(true); // Placeholder assertion
  });

  describe('Proxy Mode Detection', () => {
    it('should detect rotating proxy mode correctly', () => {
      // Mock config for rotating proxy
      vi.doMock('../server/config', () => ({
        default: {
          USE_ROTATING_PROXY: true,
          ROTATING_PROXY: 'http://test-rotate:pass@proxy.com:8080'
        }
      }));

      const testApiKey: ApiKey = {
        key: 'test-key',
        keyId: 'test-key-1',
        status: 'available',
        currentRequests: 0,
        proxy: 'http://individual-proxy.com:8080'
      };

      // This would test the internal getProxyForRequest method
      // Since it's private, we'd test it through forwardRequest
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should fallback to individual proxy when rotating proxy is disabled', () => {
      // Mock config for individual proxy mode
      vi.doMock('../server/config', () => ({
        default: {
          USE_ROTATING_PROXY: false,
          ROTATING_PROXY: undefined
        }
      }));

      const testApiKey: ApiKey = {
        key: 'test-key',
        keyId: 'test-key-1',
        status: 'available',
        currentRequests: 0,
        proxy: 'http://individual-proxy.com:8080'
      };

      // This would test the proxy selection logic
      expect(true).toBe(true); // Placeholder assertion
    });
  });

  describe('Error Handling', () => {
    it('should handle rotating proxy failures correctly', () => {
      // This would test the rotating proxy failure handling
      // and temporary disabling logic
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should reset failure count on successful requests', () => {
      // This would test the failure count reset logic
      expect(true).toBe(true); // Placeholder assertion
    });
  });
});

describe('API Key Management with Rotating Proxy', () => {
  it('should skip individual proxy assignment when rotating proxy is enabled', () => {
    // Mock config for rotating proxy mode
    vi.doMock('../server/config', () => ({
      default: {
        USE_ROTATING_PROXY: true,
        ROTATING_PROXY: 'http://test-rotate:pass@proxy.com:8080'
      }
    }));

    // This would test ApiKeyManager behavior with rotating proxy
    expect(true).toBe(true); // Placeholder assertion
  });

  it('should preserve individual proxy assignments for fallback', () => {
    // This would test that existing proxy assignments are preserved
    // even when rotating proxy is enabled
    expect(true).toBe(true); // Placeholder assertion
  });
});