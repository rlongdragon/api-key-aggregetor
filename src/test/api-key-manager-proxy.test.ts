import * as assert from 'assert';
import ApiKeyManager from '../server/core/ApiKeyManager';
import { EventManager } from '../server/core/EventManager';
import { ProxyPoolManager } from '../server/core/ProxyPoolManager';
import { ProxyAssignmentManager } from '../server/core/ProxyAssignmentManager';
import { ProxyLoadBalancer } from '../server/core/ProxyLoadBalancer';
import * as vscode from 'vscode';
import { ApiKey } from '../server/types/ApiKey';

// Mock VS Code extension context
const mockContext = {
  secrets: {
    store: async (key: string, value: string) => Promise.resolve(),
    get: async (key: string) => Promise.resolve(null),
    delete: async (key: string) => Promise.resolve()
  },
  subscriptions: []
} as unknown as vscode.ExtensionContext;

describe('ApiKeyManager with Proxy Integration', () => {
  let apiKeyManager: ApiKeyManager;
  let eventManager: EventManager;
  let proxyPoolManager: ProxyPoolManager;
  let proxyAssignmentManager: ProxyAssignmentManager;
  let proxyLoadBalancer: ProxyLoadBalancer;
  
  // Test data
  const testApiKeys: ApiKey[] = [
    {
      key: 'api_key_1',
      keyId: 'key1',
      status: 'available',
      currentRequests: 0,
      usedHistory: []
    },
    {
      key: 'api_key_2',
      keyId: 'key2',
      status: 'available',
      currentRequests: 0,
      usedHistory: []
    }
  ];
  
  beforeEach(async () => {
    eventManager = new EventManager();
    proxyPoolManager = new ProxyPoolManager(eventManager, mockContext);
    proxyLoadBalancer = new ProxyLoadBalancer('least_loaded');
    proxyAssignmentManager = new ProxyAssignmentManager(eventManager, proxyPoolManager, mockContext);
    
    // Initialize proxy pool with test proxies
    await proxyPoolManager.addProxy('http://proxy1.example.com:8080');
    await proxyPoolManager.addProxy('http://proxy2.example.com:8080');
    
    apiKeyManager = new ApiKeyManager(
      testApiKeys,
      eventManager,
      mockContext,
      proxyPoolManager,
      proxyAssignmentManager,
      proxyLoadBalancer
    );
  });
  
  describe('proxy integration', () => {
    it('should return API key with assigned proxy', async () => {
      // First assign a proxy to the key
      const availableProxies = proxyPoolManager.getAvailableProxies();
      const proxyId = availableProxies[0].id;
      await proxyAssignmentManager.assignProxyToKey('key1', proxyId, true);
      
      // Get the key
      const apiKey = await apiKeyManager.getAvailableKey();
      
      assert.ok(apiKey, 'Should return an API key');
      assert.strictEqual(apiKey!.keyId, 'key1', 'Should return the first key');
      assert.strictEqual(apiKey!.proxy, availableProxies[0].url, 'Should include the assigned proxy URL');
    });
    
    it('should fall back to rotating proxy when no assignment exists', async () => {
      // Set up rotating proxy
      apiKeyManager.setRotatingProxy(true);
      apiKeyManager.setProxies(['http://rotating1.example.com:8080', 'http://rotating2.example.com:8080']);
      
      // Get a key without assignment
      const apiKey = await apiKeyManager.getAvailableKey();
      
      assert.ok(apiKey, 'Should return an API key');
      assert.ok(apiKey!.proxy, 'Should have a proxy URL');
      assert.ok(
        apiKey!.proxy === 'http://rotating1.example.com:8080' || 
        apiKey!.proxy === 'http://rotating2.example.com:8080',
        'Should use one of the rotating proxies'
      );
    });
    
    it('should not modify the original key object when adding proxy', async () => {
      // First assign a proxy to the key
      const availableProxies = proxyPoolManager.getAvailableProxies();
      const proxyId = availableProxies[0].id;
      await proxyAssignmentManager.assignProxyToKey('key1', proxyId, true);
      
      // Get the key
      const apiKey = await apiKeyManager.getAvailableKey();
      
      // Check that the original key in the map doesn't have the proxy URL directly set
      const originalKeys = apiKeyManager.getAllKeys();
      const originalKey = originalKeys.find(k => k.keyId === 'key1');
      
      assert.ok(originalKey, 'Original key should exist');
      assert.notStrictEqual(originalKey!.proxy, apiKey!.proxy, 'Original key should not have proxy URL directly set');
    });
  });
});