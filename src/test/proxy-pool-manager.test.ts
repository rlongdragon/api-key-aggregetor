import * as assert from 'assert';
import { ProxyPoolManager } from '../server/core/ProxyPoolManager';
import { EventManager } from '../server/core/EventManager';
import * as vscode from 'vscode';
import { ProxyServer } from '../server/types/Proxy';

// Mock VS Code extension context
const mockContext = {
  secrets: {
    store: async (key: string, value: string) => Promise.resolve(),
    get: async (key: string) => Promise.resolve(null),
    delete: async (key: string) => Promise.resolve()
  },
  subscriptions: []
} as unknown as vscode.ExtensionContext;

describe('ProxyPoolManager', () => {
  let proxyPoolManager: ProxyPoolManager;
  let eventManager: EventManager;
  
  beforeEach(() => {
    eventManager = new EventManager();
    proxyPoolManager = new ProxyPoolManager(eventManager, mockContext);
  });
  
  afterEach(() => {
    proxyPoolManager.dispose();
  });
  
  describe('validateProxyUrl', () => {
    it('should validate correct http proxy URLs', () => {
      assert.strictEqual(proxyPoolManager.validateProxyUrl('http://proxy.example.com:8080'), true);
    });
    
    it('should validate correct https proxy URLs', () => {
      assert.strictEqual(proxyPoolManager.validateProxyUrl('https://proxy.example.com:8080'), true);
    });
    
    it('should validate correct socks proxy URLs', () => {
      assert.strictEqual(proxyPoolManager.validateProxyUrl('socks://proxy.example.com:1080'), true);
    });
    
    it('should validate correct socks5 proxy URLs', () => {
      assert.strictEqual(proxyPoolManager.validateProxyUrl('socks5://proxy.example.com:1080'), true);
    });
    
    it('should reject invalid proxy URLs', () => {
      assert.strictEqual(proxyPoolManager.validateProxyUrl('invalid-url'), false);
    });
    
    it('should reject unsupported protocols', () => {
      assert.strictEqual(proxyPoolManager.validateProxyUrl('ftp://proxy.example.com:21'), false);
    });
  });
  
  describe('proxy management', () => {
    it('should add a proxy and return its ID', async () => {
      const proxyUrl = 'http://proxy.example.com:8080';
      const proxyId = await proxyPoolManager.addProxy(proxyUrl);
      
      assert.ok(proxyId, 'Proxy ID should be returned');
      
      const allProxies = proxyPoolManager.getAllProxies();
      assert.strictEqual(allProxies.length, 1, 'One proxy should be added');
      assert.strictEqual(allProxies[0].url, proxyUrl, 'Proxy URL should match');
    });
    
    it('should throw error when adding invalid proxy URL', async () => {
      const invalidUrl = 'invalid-url';
      
      await assert.rejects(
        async () => await proxyPoolManager.addProxy(invalidUrl),
        /Invalid proxy URL format/,
        'Should reject invalid proxy URL'
      );
    });
    
    it('should update a proxy URL', async () => {
      const originalUrl = 'http://proxy.example.com:8080';
      const updatedUrl = 'https://new-proxy.example.com:8443';
      
      const proxyId = await proxyPoolManager.addProxy(originalUrl);
      await proxyPoolManager.updateProxy(proxyId, updatedUrl);
      
      const proxy = proxyPoolManager.getProxy(proxyId);
      assert.strictEqual(proxy?.url, updatedUrl, 'Proxy URL should be updated');
    });
    
    it('should remove a proxy', async () => {
      const proxyUrl = 'http://proxy.example.com:8080';
      const proxyId = await proxyPoolManager.addProxy(proxyUrl);
      
      await proxyPoolManager.removeProxy(proxyId);
      
      const allProxies = proxyPoolManager.getAllProxies();
      assert.strictEqual(allProxies.length, 0, 'Proxy should be removed');
    });
    
    it('should update assigned key count', async () => {
      const proxyUrl = 'http://proxy.example.com:8080';
      const proxyId = await proxyPoolManager.addProxy(proxyUrl);
      
      await proxyPoolManager.updateAssignedKeyCount(proxyId, 5);
      
      const proxy = proxyPoolManager.getProxy(proxyId);
      assert.strictEqual(proxy?.assignedKeyCount, 5, 'Assigned key count should be updated');
    });
  });
  
  describe('event emission', () => {
    it('should emit events when proxy is added', async () => {
      let eventFired = false;
      let eventProxy: ProxyServer | null = null;
      
      eventManager.on('proxyAdded', (proxy: ProxyServer) => {
        eventFired = true;
        eventProxy = proxy;
      });
      
      const proxyUrl = 'http://proxy.example.com:8080';
      const proxyId = await proxyPoolManager.addProxy(proxyUrl);
      
      assert.strictEqual(eventFired, true, 'proxyAdded event should be emitted');
      if (eventProxy) {
        assert.strictEqual((eventProxy as ProxyServer).id, proxyId, 'Event should contain correct proxy ID');
        assert.strictEqual((eventProxy as ProxyServer).url, proxyUrl, 'Event should contain correct proxy URL');
      } else {
        assert.fail('Event proxy should not be null');
      }
    });
    
    it('should emit events when proxy is removed', async () => {
      let eventFired = false;
      let removedProxyId: string | null = null;
      
      eventManager.on('proxyRemoved', (proxyId: string) => {
        eventFired = true;
        removedProxyId = proxyId;
      });
      
      const proxyUrl = 'http://proxy.example.com:8080';
      const proxyId = await proxyPoolManager.addProxy(proxyUrl);
      await proxyPoolManager.removeProxy(proxyId);
      
      assert.strictEqual(eventFired, true, 'proxyRemoved event should be emitted');
      assert.strictEqual(removedProxyId, proxyId, 'Event should contain correct proxy ID');
    });
  });
});