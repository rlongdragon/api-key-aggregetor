import * as assert from 'assert';
import { ProxyAssignmentManager } from '../server/core/ProxyAssignmentManager';
import { ProxyPoolManager } from '../server/core/ProxyPoolManager';
import { EventManager } from '../server/core/EventManager';
import * as vscode from 'vscode';
import { ProxyAssignment } from '../server/types/Proxy';

// Mock VS Code extension context
const mockContext = {
  secrets: {
    store: async (key: string, value: string) => Promise.resolve(),
    get: async (key: string) => Promise.resolve(null),
    delete: async (key: string) => Promise.resolve()
  },
  subscriptions: []
} as unknown as vscode.ExtensionContext;

// Mock ProxyPoolManager
class MockProxyPoolManager {
  private proxies: Map<string, any> = new Map();
  
  constructor() {
    // Add some test proxies
    this.proxies.set('proxy1', {
      id: 'proxy1',
      url: 'http://proxy1.example.com:8080',
      status: 'active',
      assignedKeyCount: 0
    });
    
    this.proxies.set('proxy2', {
      id: 'proxy2',
      url: 'http://proxy2.example.com:8080',
      status: 'active',
      assignedKeyCount: 0
    });
    
    this.proxies.set('proxy3', {
      id: 'proxy3',
      url: 'http://proxy3.example.com:8080',
      status: 'error',
      assignedKeyCount: 0
    });
  }
  
  getProxy(id: string) {
    return this.proxies.get(id);
  }
  
  getAvailableProxies() {
    return Array.from(this.proxies.values()).filter(p => p.status === 'active');
  }
  
  async updateAssignedKeyCount(proxyId: string, count: number) {
    const proxy = this.proxies.get(proxyId);
    if (proxy) {
      proxy.assignedKeyCount = count;
    }
  }
}

describe('ProxyAssignmentManager', () => {
  let proxyAssignmentManager: ProxyAssignmentManager;
  let eventManager: EventManager;
  let proxyPoolManager: ProxyPoolManager;
  
  beforeEach(() => {
    eventManager = new EventManager();
    proxyPoolManager = new MockProxyPoolManager() as unknown as ProxyPoolManager;
    proxyAssignmentManager = new ProxyAssignmentManager(
      eventManager,
      proxyPoolManager,
      mockContext
    );
  });
  
  describe('proxy assignment', () => {
    it('should assign a proxy to a key automatically', async () => {
      const assignment = await proxyAssignmentManager.assignProxyToKey('key1');
      
      assert.ok(assignment, 'Assignment should be created');
      assert.strictEqual(assignment!.keyId, 'key1', 'Key ID should match');
      assert.ok(['proxy1', 'proxy2'].includes(assignment!.proxyId), 'Proxy ID should be one of the available proxies');
      assert.strictEqual(assignment!.isManual, false, 'Assignment should be automatic');
    });
    
    it('should assign a specific proxy when requested', async () => {
      const assignment = await proxyAssignmentManager.assignProxyToKey('key1', 'proxy2', true);
      
      assert.ok(assignment, 'Assignment should be created');
      assert.strictEqual(assignment!.keyId, 'key1', 'Key ID should match');
      assert.strictEqual(assignment!.proxyId, 'proxy2', 'Proxy ID should match requested proxy');
      assert.strictEqual(assignment!.isManual, true, 'Assignment should be manual');
    });
    
    it('should throw error when assigning non-existent proxy', async () => {
      await assert.rejects(
        async () => await proxyAssignmentManager.assignProxyToKey('key1', 'non-existent-proxy'),
        /Proxy with ID non-existent-proxy not found/,
        'Should reject non-existent proxy'
      );
    });
    
    it('should throw error when assigning inactive proxy', async () => {
      await assert.rejects(
        async () => await proxyAssignmentManager.assignProxyToKey('key1', 'proxy3'),
        /Cannot assign inactive proxy/,
        'Should reject inactive proxy'
      );
    });
  });
  
  describe('proxy unassignment', () => {
    it('should unassign a proxy from a key', async () => {
      // First assign a proxy
      await proxyAssignmentManager.assignProxyToKey('key1', 'proxy1');
      
      // Then unassign it
      await proxyAssignmentManager.unassignProxy('key1');
      
      // Check that it's unassigned
      const assignment = proxyAssignmentManager.getAssignmentForKey('key1');
      assert.strictEqual(assignment, null, 'Assignment should be removed');
    });
    
    it('should handle unassigning non-existent assignment', async () => {
      // Should not throw error
      await proxyAssignmentManager.unassignProxy('non-existent-key');
    });
  });
  
  describe('proxy reassignment', () => {
    it('should reassign a key to a different proxy', async () => {
      // First assign to proxy1
      await proxyAssignmentManager.assignProxyToKey('key1', 'proxy1');
      
      // Then reassign to proxy2
      const newAssignment = await proxyAssignmentManager.reassignProxy('key1', 'proxy2');
      
      assert.ok(newAssignment, 'New assignment should be created');
      assert.strictEqual(newAssignment!.keyId, 'key1', 'Key ID should match');
      assert.strictEqual(newAssignment!.proxyId, 'proxy2', 'Proxy ID should be updated');
    });
    
    it('should not reassign if the proxy is the same', async () => {
      // First assign to proxy1
      const originalAssignment = await proxyAssignmentManager.assignProxyToKey('key1', 'proxy1');
      
      // Then "reassign" to the same proxy
      const newAssignment = await proxyAssignmentManager.reassignProxy('key1', 'proxy1');
      
      assert.strictEqual(newAssignment, originalAssignment, 'Assignment should not change');
    });
  });
  
  describe('auto-assignment control', () => {
    it('should respect auto-assignment setting when disabled', async () => {
      // Disable auto-assignment
      proxyAssignmentManager.setAutoAssignment(false);
      
      // Try to auto-assign
      const assignment = await proxyAssignmentManager.assignProxyToKey('key1');
      
      assert.strictEqual(assignment, null, 'No assignment should be made when auto-assignment is disabled');
    });
    
    it('should still allow manual assignment when auto-assignment is disabled', async () => {
      // Disable auto-assignment
      proxyAssignmentManager.setAutoAssignment(false);
      
      // Try manual assignment
      const assignment = await proxyAssignmentManager.assignProxyToKey('key1', 'proxy1', true);
      
      assert.ok(assignment, 'Manual assignment should still work');
      assert.strictEqual(assignment!.proxyId, 'proxy1', 'Proxy ID should match requested proxy');
    });
  });
  
  describe('event emission', () => {
    it('should emit events when proxy is assigned', async () => {
      let eventFired = false;
      let eventAssignment: ProxyAssignment | null = null;
      
      eventManager.on('proxyAssigned', (assignment: ProxyAssignment) => {
        eventFired = true;
        eventAssignment = assignment;
      });
      
      await proxyAssignmentManager.assignProxyToKey('key1', 'proxy1');
      
      assert.strictEqual(eventFired, true, 'proxyAssigned event should be emitted');
      if (eventAssignment) {
        assert.strictEqual((eventAssignment as ProxyAssignment).keyId, 'key1', 'Event should contain correct key ID');
        assert.strictEqual((eventAssignment as ProxyAssignment).proxyId, 'proxy1', 'Event should contain correct proxy ID');
      } else {
        assert.fail('Event assignment should not be null');
      }
    });
    
    it('should emit events when proxy is unassigned', async () => {
      let eventFired = false;
      let unassignedKeyId: string | null = null;
      
      eventManager.on('proxyUnassigned', (keyId: string) => {
        eventFired = true;
        unassignedKeyId = keyId;
      });
      
      // First assign a proxy
      await proxyAssignmentManager.assignProxyToKey('key1', 'proxy1');
      
      // Then unassign it
      await proxyAssignmentManager.unassignProxy('key1');
      
      assert.strictEqual(eventFired, true, 'proxyUnassigned event should be emitted');
      assert.strictEqual(unassignedKeyId, 'key1', 'Event should contain correct key ID');
    });
  });
});