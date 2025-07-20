import { ProxyAssignment, PROXY_STORAGE_KEYS, StoredProxyAssignments } from '../types/Proxy';
import { EventManager } from './EventManager';
import { ProxyPoolManager } from './ProxyPoolManager';
import * as vscode from 'vscode';

/**
 * Manages the assignment of proxies to API keys
 */
export class ProxyAssignmentManager {
  private assignments: Map<string, ProxyAssignment> = new Map();
  private eventManager: EventManager;
  private proxyPoolManager: ProxyPoolManager;
  private context: vscode.ExtensionContext;
  private autoAssignmentEnabled: boolean = true;

  constructor(
    eventManager: EventManager,
    proxyPoolManager: ProxyPoolManager,
    context: vscode.ExtensionContext
  ) {
    this.eventManager = eventManager;
    this.proxyPoolManager = proxyPoolManager;
    this.context = context;
  }

  /**
   * Initialize the proxy assignment manager
   */
  public async initialize(): Promise<void> {
    await this.loadAssignments();
    await this.updateProxyAssignmentCounts();
  }

  /**
   * Load assignments from storage
   */
  private async loadAssignments(): Promise<void> {
    try {
      const storedAssignmentsJson = await this.context.secrets.get(PROXY_STORAGE_KEYS.PROXY_ASSIGNMENTS);
      if (storedAssignmentsJson) {
        const storedAssignments: StoredProxyAssignments = JSON.parse(storedAssignmentsJson);
        
        this.assignments.clear();
        for (const assignment of storedAssignments.assignments) {
          this.assignments.set(assignment.keyId, {
            keyId: assignment.keyId,
            proxyId: assignment.proxyId,
            assignedAt: assignment.assignedAt,
            isManual: assignment.isManual,
            lastUsed: assignment.lastUsed
          });
        }
        
        console.log(`ProxyAssignmentManager: Loaded ${this.assignments.size} assignments from storage`);
      } else {
        console.log('ProxyAssignmentManager: No stored assignments found');
      }
    } catch (error) {
      console.error('ProxyAssignmentManager: Error loading assignments from storage', error);
    }
  }

  /**
   * Save assignments to storage
   */
  private async saveAssignments(): Promise<void> {
    try {
      const storedAssignments: StoredProxyAssignments = {
        assignments: Array.from(this.assignments.values()).map(assignment => ({
          keyId: assignment.keyId,
          proxyId: assignment.proxyId,
          assignedAt: assignment.assignedAt,
          isManual: assignment.isManual,
          lastUsed: assignment.lastUsed
        })),
        lastUpdated: Date.now()
      };
      
      await this.context.secrets.store(
        PROXY_STORAGE_KEYS.PROXY_ASSIGNMENTS,
        JSON.stringify(storedAssignments)
      );
      
      console.log('ProxyAssignmentManager: Saved assignments to storage');
    } catch (error) {
      console.error('ProxyAssignmentManager: Error saving assignments to storage', error);
    }
  }

  /**
   * Update the assigned key count for all proxies
   */
  private async updateProxyAssignmentCounts(): Promise<void> {
    // Count assignments per proxy
    const proxyCounts = new Map<string, number>();
    
    for (const assignment of this.assignments.values()) {
      const count = proxyCounts.get(assignment.proxyId) || 0;
      proxyCounts.set(assignment.proxyId, count + 1);
    }
    
    // Update counts in ProxyPoolManager
    for (const [proxyId, count] of proxyCounts.entries()) {
      try {
        await this.proxyPoolManager.updateAssignedKeyCount(proxyId, count);
      } catch (error) {
        console.warn(`ProxyAssignmentManager: Could not update count for proxy ${proxyId}`, error);
      }
    }
  }

  /**
   * Assign a proxy to an API key
   * @param keyId The API key ID
   * @param proxyId Optional specific proxy ID to assign (if not provided, one will be selected automatically)
   * @param isManual Whether this is a manual assignment (vs. automatic)
   */
  public async assignProxyToKey(
    keyId: string,
    proxyId?: string,
    isManual: boolean = false
  ): Promise<ProxyAssignment | null> {
    // If auto-assignment is disabled and no specific proxy is provided, don't assign
    if (!this.autoAssignmentEnabled && !proxyId && !isManual) {
      console.log(`ProxyAssignmentManager: Auto-assignment disabled, not assigning proxy to key ${keyId}`);
      return null;
    }
    
    // If a specific proxy ID is provided, validate it
    if (proxyId) {
      const proxy = this.proxyPoolManager.getProxy(proxyId);
      if (!proxy) {
        throw new Error(`Proxy with ID ${proxyId} not found`);
      }
      
      // Check if proxy is active
      if (proxy.status !== 'active') {
        throw new Error(`Cannot assign inactive proxy ${proxyId} (status: ${proxy.status})`);
      }
    } else {
      // Auto-select a proxy
      const availableProxies = this.proxyPoolManager.getAvailableProxies();
      if (availableProxies.length === 0) {
        console.warn('ProxyAssignmentManager: No available proxies for assignment');
        return null;
      }
      
      // Select the proxy with the fewest assigned keys
      availableProxies.sort((a, b) => a.assignedKeyCount - b.assignedKeyCount);
      proxyId = availableProxies[0].id;
    }
    
    // Create the assignment
    const assignment: ProxyAssignment = {
      keyId,
      proxyId: proxyId!,
      assignedAt: Date.now(),
      isManual,
      lastUsed: undefined
    };
    
    // Store the assignment
    this.assignments.set(keyId, assignment);
    
    // Update proxy assignment count
    const proxy = this.proxyPoolManager.getProxy(proxyId!);
    if (proxy) {
      await this.proxyPoolManager.updateAssignedKeyCount(proxyId!, proxy.assignedKeyCount + 1);
    }
    
    // Save to storage
    await this.saveAssignments();
    
    // Emit event
    this.eventManager.emit('proxyAssigned', assignment);
    
    console.log(`ProxyAssignmentManager: Assigned proxy ${proxyId} to key ${keyId}`);
    return assignment;
  }

  /**
   * Remove a proxy assignment for an API key
   */
  public async unassignProxy(keyId: string): Promise<void> {
    const assignment = this.assignments.get(keyId);
    if (!assignment) {
      console.log(`ProxyAssignmentManager: No assignment found for key ${keyId}`);
      return;
    }
    
    const proxyId = assignment.proxyId;
    
    // Remove the assignment
    this.assignments.delete(keyId);
    
    // Update proxy assignment count
    const proxy = this.proxyPoolManager.getProxy(proxyId);
    if (proxy && proxy.assignedKeyCount > 0) {
      await this.proxyPoolManager.updateAssignedKeyCount(proxyId, proxy.assignedKeyCount - 1);
    }
    
    // Save to storage
    await this.saveAssignments();
    
    // Emit event
    this.eventManager.emit('proxyUnassigned', keyId);
    
    console.log(`ProxyAssignmentManager: Unassigned proxy from key ${keyId}`);
  }

  /**
   * Reassign a key to a different proxy
   */
  public async reassignProxy(
    keyId: string,
    newProxyId: string,
    isManual: boolean = true
  ): Promise<ProxyAssignment | null> {
    // Check if the new proxy exists and is active
    const newProxy = this.proxyPoolManager.getProxy(newProxyId);
    if (!newProxy) {
      throw new Error(`Proxy with ID ${newProxyId} not found`);
    }
    
    if (newProxy.status !== 'active') {
      throw new Error(`Cannot assign inactive proxy ${newProxyId} (status: ${newProxy.status})`);
    }
    
    // Get the current assignment
    const currentAssignment = this.assignments.get(keyId);
    
    // If there's a current assignment and it's the same proxy, do nothing
    if (currentAssignment && currentAssignment.proxyId === newProxyId) {
      console.log(`ProxyAssignmentManager: Key ${keyId} is already assigned to proxy ${newProxyId}`);
      return currentAssignment;
    }
    
    // If there's a current assignment, unassign it first
    if (currentAssignment) {
      await this.unassignProxy(keyId);
    }
    
    // Create a new assignment
    return this.assignProxyToKey(keyId, newProxyId, isManual);
  }

  /**
   * Get the assignment for a specific key
   */
  public getAssignmentForKey(keyId: string): ProxyAssignment | null {
    return this.assignments.get(keyId) || null;
  }

  /**
   * Get all assignments
   */
  public getAllAssignments(): ProxyAssignment[] {
    return Array.from(this.assignments.values());
  }

  /**
   * Update the last used timestamp for an assignment
   */
  public async updateLastUsed(keyId: string): Promise<void> {
    const assignment = this.assignments.get(keyId);
    if (assignment) {
      assignment.lastUsed = Date.now();
      await this.saveAssignments();
    }
  }

  /**
   * Enable or disable automatic proxy assignment
   */
  public setAutoAssignment(enabled: boolean): void {
    this.autoAssignmentEnabled = enabled;
    console.log(`ProxyAssignmentManager: Auto-assignment ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if automatic proxy assignment is enabled
   */
  public isAutoAssignmentEnabled(): boolean {
    return this.autoAssignmentEnabled;
  }

  /**
   * Rebalance assignments to maintain even distribution
   */
  public async rebalanceAssignments(): Promise<void> {
    console.log('ProxyAssignmentManager: Starting assignment rebalancing');
    
    const availableProxies = this.proxyPoolManager.getAvailableProxies();
    if (availableProxies.length === 0) {
      console.warn('ProxyAssignmentManager: No available proxies for rebalancing');
      return;
    }
    
    // Skip rebalancing if there's only one proxy
    if (availableProxies.length === 1) {
      console.log('ProxyAssignmentManager: Only one proxy available, skipping rebalancing');
      return;
    }
    
    // Get all automatic assignments (don't rebalance manual assignments)
    const automaticAssignments = Array.from(this.assignments.values())
      .filter(assignment => !assignment.isManual);
    
    // Skip if there are no automatic assignments
    if (automaticAssignments.length === 0) {
      console.log('ProxyAssignmentManager: No automatic assignments to rebalance');
      return;
    }
    
    // Calculate target number of keys per proxy
    const targetKeysPerProxy = Math.floor(automaticAssignments.length / availableProxies.length);
    
    // Count current assignments per proxy
    const proxyAssignmentCounts = new Map<string, number>();
    for (const proxy of availableProxies) {
      proxyAssignmentCounts.set(proxy.id, 0);
    }
    
    for (const assignment of automaticAssignments) {
      const count = proxyAssignmentCounts.get(assignment.proxyId) || 0;
      proxyAssignmentCounts.set(assignment.proxyId, count + 1);
    }
    
    // Find overloaded and underloaded proxies
    const overloadedProxies: string[] = [];
    const underloadedProxies: string[] = [];
    
    for (const [proxyId, count] of proxyAssignmentCounts.entries()) {
      if (count > targetKeysPerProxy) {
        overloadedProxies.push(proxyId);
      } else if (count < targetKeysPerProxy) {
        underloadedProxies.push(proxyId);
      }
    }
    
    // No rebalancing needed if no overloaded or underloaded proxies
    if (overloadedProxies.length === 0 || underloadedProxies.length === 0) {
      console.log('ProxyAssignmentManager: Assignments are already balanced');
      return;
    }
    
    console.log(`ProxyAssignmentManager: Found ${overloadedProxies.length} overloaded proxies and ${underloadedProxies.length} underloaded proxies`);
    
    // Rebalance by moving assignments from overloaded to underloaded proxies
    let reassignmentCount = 0;
    
    for (const overloadedProxyId of overloadedProxies) {
      // Find assignments for this overloaded proxy
      const assignmentsToMove = automaticAssignments
        .filter(assignment => assignment.proxyId === overloadedProxyId)
        .sort((a, b) => (a.lastUsed || 0) - (b.lastUsed || 0)); // Move oldest used first
      
      const excessCount = (proxyAssignmentCounts.get(overloadedProxyId) || 0) - targetKeysPerProxy;
      
      // Move excess assignments to underloaded proxies
      for (let i = 0; i < excessCount && i < assignmentsToMove.length && underloadedProxies.length > 0; i++) {
        const assignment = assignmentsToMove[i];
        const underloadedProxyId = underloadedProxies[0];
        
        // Reassign to underloaded proxy
        await this.reassignProxy(assignment.keyId, underloadedProxyId, false);
        reassignmentCount++;
        
        // Update counts
        proxyAssignmentCounts.set(overloadedProxyId, (proxyAssignmentCounts.get(overloadedProxyId) || 0) - 1);
        proxyAssignmentCounts.set(underloadedProxyId, (proxyAssignmentCounts.get(underloadedProxyId) || 0) + 1);
        
        // Check if this proxy is no longer underloaded
        if ((proxyAssignmentCounts.get(underloadedProxyId) || 0) >= targetKeysPerProxy) {
          underloadedProxies.shift(); // Remove from underloaded list
        }
      }
    }
    
    console.log(`ProxyAssignmentManager: Rebalanced ${reassignmentCount} assignments`);
  }
}