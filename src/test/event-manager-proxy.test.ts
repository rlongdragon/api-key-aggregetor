import * as assert from 'assert';
import { EventManager } from '../server/core/EventManager';
import { ProxyServer, ProxyAssignment } from '../server/types/Proxy';

describe('EventManager with Proxy Events', () => {
  let eventManager: EventManager;

  beforeEach(() => {
    eventManager = new EventManager();
  });

  describe('proxy events', () => {
    it('should emit proxyAdded event', (done) => {
      const testProxy: ProxyServer = {
        id: 'proxy1',
        url: 'http://proxy.example.com:8080',
        status: 'active',
        assignedKeyCount: 0,
        errorCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      eventManager.on('proxyAdded', (proxy: ProxyServer) => {
        assert.deepStrictEqual(proxy, testProxy, 'Event should contain the proxy object');
        done();
      });

      eventManager.emitProxyAdded(testProxy);
    });

    it('should emit proxyRemoved event', (done) => {
      const proxyId = 'proxy1';

      eventManager.on('proxyRemoved', (id: string) => {
        assert.strictEqual(id, proxyId, 'Event should contain the proxy ID');
        done();
      });

      eventManager.emitProxyRemoved(proxyId);
    });

    it('should emit proxyUpdated event', (done) => {
      const testProxy: ProxyServer = {
        id: 'proxy1',
        url: 'http://proxy.example.com:8080',
        status: 'active',
        assignedKeyCount: 0,
        errorCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      eventManager.on('proxyUpdated', (proxy: ProxyServer) => {
        assert.deepStrictEqual(proxy, testProxy, 'Event should contain the updated proxy object');
        done();
      });

      eventManager.emitProxyUpdated(testProxy);
    });

    it('should emit proxyStatusChanged event', (done) => {
      const testProxy: ProxyServer = {
        id: 'proxy1',
        url: 'http://proxy.example.com:8080',
        status: 'error',
        assignedKeyCount: 0,
        errorCount: 3,
        lastError: 'Connection refused',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      eventManager.on('proxyStatusChanged', (proxy: ProxyServer) => {
        assert.deepStrictEqual(proxy, testProxy, 'Event should contain the proxy with changed status');
        assert.strictEqual(proxy.status, 'error', 'Status should be updated');
        done();
      });

      eventManager.emitProxyStatusChanged(testProxy);
    });

    it('should emit proxyAssigned event', (done) => {
      const testAssignment: ProxyAssignment = {
        keyId: 'key1',
        proxyId: 'proxy1',
        assignedAt: Date.now(),
        isManual: true
      };

      eventManager.on('proxyAssigned', (assignment: ProxyAssignment) => {
        assert.deepStrictEqual(assignment, testAssignment, 'Event should contain the assignment object');
        done();
      });

      eventManager.emitProxyAssigned(testAssignment);
    });

    it('should emit proxyUnassigned event', (done) => {
      const keyId = 'key1';

      eventManager.on('proxyUnassigned', (id: string) => {
        assert.strictEqual(id, keyId, 'Event should contain the key ID');
        done();
      });

      eventManager.emitProxyUnassigned(keyId);
    });
  });

  describe('request status with proxy', () => {
    it('should include proxyId in request status', () => {
      let capturedStatus: any = null;

      eventManager.on('requestUpdate', (status) => {
        capturedStatus = status;
      });

      const requestStatus = {
        requestId: 'req123',
        keyId: 'key1',
        modelId: 'gemini-2.0-flash',
        methodName: 'generateContent',
        status: 'pending' as const,
        startTime: Date.now(),
        proxyId: 'proxy1'
      };

      eventManager.emitRequestUpdate(requestStatus);

      assert.ok(capturedStatus, 'Event should be captured');
      assert.strictEqual(capturedStatus.proxyId, 'proxy1', 'Request status should include proxyId');
    });
  });
});