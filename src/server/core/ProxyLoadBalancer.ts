import { LoadBalancingStrategy, ProxyAssignment, ProxyServer, RebalancePlan } from '../types/Proxy';

/**
 * Round-robin load balancing strategy
 */
export class RoundRobinStrategy implements LoadBalancingStrategy {
  private lastIndex: number = -1;
  
  selectProxyForNewKey(availableProxies: ProxyServer[]): ProxyServer | null {
    if (availableProxies.length === 0) {
      return null;
    }
    
    this.lastIndex = (this.lastIndex + 1) % availableProxies.length;
    return availableProxies[this.lastIndex];
  }
  
  shouldRebalance(assignments: ProxyAssignment[], proxies: ProxyServer[]): boolean {
    if (proxies.length <= 1 || assignments.length === 0) {
      return false;
    }
    
    // Count assignments per proxy
    const counts = new Map<string, number>();
    for (const assignment of assignments) {
      const count = counts.get(assignment.proxyId) || 0;
      counts.set(assignment.proxyId, count + 1);
    }
    
    // Calculate min and max counts
    let min = Number.MAX_SAFE_INTEGER;
    let max = 0;
    
    for (const proxy of proxies) {
      const count = counts.get(proxy.id) || 0;
      min = Math.min(min, count);
      max = Math.max(max, count);
    }
    
    // If the difference between min and max is more than 1, rebalance
    return max - min > 1;
  }
}

/**
 * Least-loaded load balancing strategy
 */
export class LeastLoadedStrategy implements LoadBalancingStrategy {
  selectProxyForNewKey(availableProxies: ProxyServer[]): ProxyServer | null {
    if (availableProxies.length === 0) {
      return null;
    }
    
    // Sort by assigned key count
    const sorted = [...availableProxies].sort((a, b) => a.assignedKeyCount - b.assignedKeyCount);
    return sorted[0];
  }
  
  shouldRebalance(assignments: ProxyAssignment[], proxies: ProxyServer[]): boolean {
    if (proxies.length <= 1 || assignments.length === 0) {
      return false;
    }
    
    // Count assignments per proxy
    const counts = new Map<string, number>();
    for (const assignment of assignments) {
      const count = counts.get(assignment.proxyId) || 0;
      counts.set(assignment.proxyId, count + 1);
    }
    
    // Calculate min and max counts
    let min = Number.MAX_SAFE_INTEGER;
    let max = 0;
    
    for (const proxy of proxies) {
      const count = counts.get(proxy.id) || 0;
      min = Math.min(min, count);
      max = Math.max(max, count);
    }
    
    // If the difference between min and max is more than 1, rebalance
    return max - min > 1;
  }
}

/**
 * Random load balancing strategy
 */
export class RandomStrategy implements LoadBalancingStrategy {
  selectProxyForNewKey(availableProxies: ProxyServer[]): ProxyServer | null {
    if (availableProxies.length === 0) {
      return null;
    }
    
    const randomIndex = Math.floor(Math.random() * availableProxies.length);
    return availableProxies[randomIndex];
  }
  
  shouldRebalance(assignments: ProxyAssignment[], proxies: ProxyServer[]): boolean {
    // Random strategy doesn't need rebalancing as often
    if (proxies.length <= 1 || assignments.length === 0) {
      return false;
    }
    
    // Count assignments per proxy
    const counts = new Map<string, number>();
    for (const assignment of assignments) {
      const count = counts.get(assignment.proxyId) || 0;
      counts.set(assignment.proxyId, count + 1);
    }
    
    // Calculate min and max counts
    let min = Number.MAX_SAFE_INTEGER;
    let max = 0;
    
    for (const proxy of proxies) {
      const count = counts.get(proxy.id) || 0;
      min = Math.min(min, count);
      max = Math.max(max, count);
    }
    
    // For random strategy, only rebalance if the difference is significant
    return max - min > 2;
  }
}

/**
 * Manages load balancing for proxy assignments
 */
export class ProxyLoadBalancer {
  private strategy: LoadBalancingStrategy;
  private rebalanceThreshold: number = 1;
  
  constructor(strategyType: 'round_robin' | 'least_loaded' | 'random' = 'least_loaded') {
    this.strategy = this.createStrategy(strategyType);
  }
  
  /**
   * Create a load balancing strategy based on the specified type
   */
  private createStrategy(type: 'round_robin' | 'least_loaded' | 'random'): LoadBalancingStrategy {
    switch (type) {
      case 'round_robin':
        return new RoundRobinStrategy();
      case 'least_loaded':
        return new LeastLoadedStrategy();
      case 'random':
        return new RandomStrategy();
      default:
        return new LeastLoadedStrategy();
    }
  }
  
  /**
   * Set the load balancing strategy
   */
  public setStrategy(type: 'round_robin' | 'least_loaded' | 'random'): void {
    this.strategy = this.createStrategy(type);
  }
  
  /**
   * Set the rebalance threshold
   */
  public setRebalanceThreshold(threshold: number): void {
    this.rebalanceThreshold = threshold;
  }
  
  /**
   * Select the optimal proxy for a new API key
   */
  public selectOptimalProxy(availableProxies: ProxyServer[]): ProxyServer | null {
    return this.strategy.selectProxyForNewKey(availableProxies);
  }
  
  /**
   * Calculate the load on a specific proxy
   */
  public calculateProxyLoad(proxyId: string, assignments: ProxyAssignment[]): number {
    return assignments.filter(a => a.proxyId === proxyId).length;
  }
  
  /**
   * Check if rebalancing is needed
   */
  public shouldRebalance(assignments: ProxyAssignment[], proxies: ProxyServer[]): boolean {
    return this.strategy.shouldRebalance(assignments, proxies);
  }
  
  /**
   * Generate a plan for rebalancing proxy assignments
   */
  public generateRebalancePlan(assignments: ProxyAssignment[], proxies: ProxyServer[]): RebalancePlan {
    // Filter out inactive proxies
    const activeProxies = proxies.filter(p => p.status === 'active');
    
    // Filter out manual assignments (don't rebalance these)
    const autoAssignments = assignments.filter(a => !a.isManual);
    
    // If no active proxies or no assignments, return empty plan
    if (activeProxies.length <= 1 || autoAssignments.length === 0) {
      return {
        reassignments: [],
        expectedLoadAfter: new Map()
      };
    }
    
    // Count current assignments per proxy
    const currentLoad = new Map<string, number>();
    for (const proxy of activeProxies) {
      currentLoad.set(proxy.id, 0);
    }
    
    for (const assignment of autoAssignments) {
      if (currentLoad.has(assignment.proxyId)) {
        currentLoad.set(assignment.proxyId, (currentLoad.get(assignment.proxyId) || 0) + 1);
      }
    }
    
    // Calculate target load per proxy
    const totalAssignments = autoAssignments.length;
    const targetLoad = Math.floor(totalAssignments / activeProxies.length);
    const remainder = totalAssignments % activeProxies.length;
    
    // Calculate how many assignments each proxy should have
    const targetLoads = new Map<string, number>();
    activeProxies.forEach((proxy, index) => {
      // Distribute remainder evenly
      targetLoads.set(proxy.id, targetLoad + (index < remainder ? 1 : 0));
    });
    
    // Find overloaded and underloaded proxies
    const overloaded: string[] = [];
    const underloaded: string[] = [];
    
    for (const [proxyId, load] of currentLoad.entries()) {
      const target = targetLoads.get(proxyId) || 0;
      if (load > target) {
        overloaded.push(proxyId);
      } else if (load < target) {
        underloaded.push(proxyId);
      }
    }
    
    // Generate reassignments
    const reassignments: { keyId: string; fromProxyId: string; toProxyId: string }[] = [];
    const expectedLoadAfter = new Map(currentLoad);
    
    for (const fromProxyId of overloaded) {
      const excessLoad = (currentLoad.get(fromProxyId) || 0) - (targetLoads.get(fromProxyId) || 0);
      
      // Find assignments to move
      const assignmentsToMove = autoAssignments
        .filter(a => a.proxyId === fromProxyId)
        .sort((a, b) => (a.lastUsed || 0) - (b.lastUsed || 0)); // Move oldest used first
      
      // Move assignments to underloaded proxies
      let moved = 0;
      for (let i = 0; i < excessLoad && i < assignmentsToMove.length && underloaded.length > 0; i++) {
        const assignment = assignmentsToMove[i];
        const toProxyId = underloaded[0];
        
        reassignments.push({
          keyId: assignment.keyId,
          fromProxyId,
          toProxyId
        });
        
        // Update expected loads
        expectedLoadAfter.set(fromProxyId, (expectedLoadAfter.get(fromProxyId) || 0) - 1);
        expectedLoadAfter.set(toProxyId, (expectedLoadAfter.get(toProxyId) || 0) + 1);
        
        moved++;
        
        // Check if this proxy is no longer underloaded
        if ((expectedLoadAfter.get(toProxyId) || 0) >= (targetLoads.get(toProxyId) || 0)) {
          underloaded.shift();
        }
      }
    }
    
    return {
      reassignments,
      expectedLoadAfter
    };
  }
}