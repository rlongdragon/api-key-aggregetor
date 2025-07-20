import * as assert from 'assert';
import { ProxyLoadBalancer } from '../server/core/ProxyLoadBalancer';
import { ProxyAssignment, ProxyServer } from '../server/types/Proxy';

describe('ProxyLoadBalancer', () => {
  let loadBalancer: ProxyLoadBalancer;
  
  // Test data
  const testProxies: ProxyServer[] = [
    {
      id: 'proxy1',
      url: 'http://proxy1.example.com:8080',
      status: 'active',
      assignedKeyCount: 2,
      errorCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'proxy2',
      url: 'http://proxy2.example.com:8080',
      status: 'active',
      assignedKeyCount: 1,
      errorCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'proxy3',
      url: 'http://proxy3.example.com:8080',
      status: 'active',
      assignedKeyCount: 3,
      errorCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'proxy4',
      url: 'http://proxy4.example.com:8080',
      status: 'error', // Inactive proxy
      assignedKeyCount: 0,
      errorCount: 3,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ];
  
  const testAssignments: ProxyAssignment[] = [
    {
      keyId: 'key1',
      proxyId: 'proxy1',
      assignedAt: Date.now(),
      isManual: false
    },
    {
      keyId: 'key2',
      proxyId: 'proxy1',
      assignedAt: Date.now(),
      isManual: false
    },
    {
      keyId: 'key3',
      proxyId: 'proxy2',
      assignedAt: Date.now(),
      isManual: true // Manual assignment
    },
    {
      keyId: 'key4',
      proxyId: 'proxy3',
      assignedAt: Date.now(),
      isManual: false
    },
    {
      keyId: 'key5',
      proxyId: 'proxy3',
      assignedAt: Date.now(),
      isManual: false
    },
    {
      keyId: 'key6',
      proxyId: 'proxy3',
      assignedAt: Date.now(),
      isManual: false
    }
  ];
  
  beforeEach(() => {
    loadBalancer = new ProxyLoadBalancer();
  });
  
  describe('strategy selection', () => {
    it('should use least loaded strategy by default', () => {
      const proxy = loadBalancer.selectOptimalProxy(testProxies.filter(p => p.status === 'active'));
      assert.strictEqual(proxy?.id, 'proxy2', 'Should select the least loaded proxy');
    });
    
    it('should use round robin strategy when configured', () => {
      loadBalancer.setStrategy('round_robin');
      
      const proxy1 = loadBalancer.selectOptimalProxy(testProxies.filter(p => p.status === 'active'));
      const proxy2 = loadBalancer.selectOptimalProxy(testProxies.filter(p => p.status === 'active'));
      const proxy3 = loadBalancer.selectOptimalProxy(testProxies.filter(p => p.status === 'active'));
      const proxy4 = loadBalancer.selectOptimalProxy(testProxies.filter(p => p.status === 'active'));
      
      assert.strictEqual(proxy1?.id, 'proxy1', 'First selection should be proxy1');
      assert.strictEqual(proxy2?.id, 'proxy2', 'Second selection should be proxy2');
      assert.strictEqual(proxy3?.id, 'proxy3', 'Third selection should be proxy3');
      assert.strictEqual(proxy4?.id, 'proxy1', 'Fourth selection should wrap around to proxy1');
    });
    
    it('should use random strategy when configured', () => {
      loadBalancer.setStrategy('random');
      
      // Since it's random, we can't assert exact values
      // But we can check that it returns a valid proxy
      const proxy = loadBalancer.selectOptimalProxy(testProxies.filter(p => p.status === 'active'));
      assert.ok(proxy, 'Should select a proxy');
      assert.ok(['proxy1', 'proxy2', 'proxy3'].includes(proxy!.id), 'Should select one of the active proxies');
    });
  });
  
  describe('rebalance detection', () => {
    it('should detect when rebalancing is needed', () => {
      const needsRebalance = loadBalancer.shouldRebalance(
        testAssignments,
        testProxies.filter(p => p.status === 'active')
      );
      
      assert.strictEqual(needsRebalance, true, 'Should detect unbalanced assignments');
    });
    
    it('should not suggest rebalancing when proxies are balanced', () => {
      const balancedAssignments: ProxyAssignment[] = [
        { keyId: 'key1', proxyId: 'proxy1', assignedAt: Date.now(), isManual: false },
        { keyId: 'key2', proxyId: 'proxy2', assignedAt: Date.now(), isManual: false },
        { keyId: 'key3', proxyId: 'proxy3', assignedAt: Date.now(), isManual: false }
      ];
      
      const needsRebalance = loadBalancer.shouldRebalance(
        balancedAssignments,
        testProxies.filter(p => p.status === 'active')
      );
      
      assert.strictEqual(needsRebalance, false, 'Should not detect unbalanced assignments');
    });
    
    it('should not suggest rebalancing with only one proxy', () => {
      const needsRebalance = loadBalancer.shouldRebalance(
        testAssignments,
        [testProxies[0]]
      );
      
      assert.strictEqual(needsRebalance, false, 'Should not suggest rebalancing with only one proxy');
    });
  });
  
  describe('rebalance plan generation', () => {
    it('should generate a valid rebalance plan', () => {
      const plan = loadBalancer.generateRebalancePlan(
        testAssignments,
        testProxies.filter(p => p.status === 'active')
      );
      
      assert.ok(plan.reassignments.length > 0, 'Should generate reassignments');
      
      // Check that the plan would balance the load
      const expectedLoads = Array.from(plan.expectedLoadAfter.values());
      const min = Math.min(...expectedLoads);
      const max = Math.max(...expectedLoads);
      
      assert.ok(max - min <= 1, 'Plan should balance the load to a difference of at most 1');
    });
    
    it('should not include manual assignments in rebalancing', () => {
      const plan = loadBalancer.generateRebalancePlan(
        testAssignments,
        testProxies.filter(p => p.status === 'active')
      );
      
      // Check that no manual assignments are moved
      const manualKeyIds = testAssignments
        .filter(a => a.isManual)
        .map(a => a.keyId);
      
      const movedKeyIds = plan.reassignments.map(r => r.keyId);
      
      for (const manualKeyId of manualKeyIds) {
        assert.ok(!movedKeyIds.includes(manualKeyId), `Manual assignment ${manualKeyId} should not be moved`);
      }
    });
    
    it('should return empty plan when no rebalancing is needed', () => {
      const balancedAssignments: ProxyAssignment[] = [
        { keyId: 'key1', proxyId: 'proxy1', assignedAt: Date.now(), isManual: false },
        { keyId: 'key2', proxyId: 'proxy2', assignedAt: Date.now(), isManual: false },
        { keyId: 'key3', proxyId: 'proxy3', assignedAt: Date.now(), isManual: false }
      ];
      
      const plan = loadBalancer.generateRebalancePlan(
        balancedAssignments,
        testProxies.filter(p => p.status === 'active')
      );
      
      assert.strictEqual(plan.reassignments.length, 0, 'Should not generate reassignments for balanced assignments');
    });
  });
  
  describe('load calculation', () => {
    it('should calculate proxy load correctly', () => {
      const proxy1Load = loadBalancer.calculateProxyLoad('proxy1', testAssignments);
      const proxy2Load = loadBalancer.calculateProxyLoad('proxy2', testAssignments);
      const proxy3Load = loadBalancer.calculateProxyLoad('proxy3', testAssignments);
      
      assert.strictEqual(proxy1Load, 2, 'Proxy1 should have 2 assignments');
      assert.strictEqual(proxy2Load, 1, 'Proxy2 should have 1 assignment');
      assert.strictEqual(proxy3Load, 3, 'Proxy3 should have 3 assignments');
    });
  });
});