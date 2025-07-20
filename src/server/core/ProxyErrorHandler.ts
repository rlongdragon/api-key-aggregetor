import { EventManager } from './EventManager';
import { ProxyPoolManager } from './ProxyPoolManager';
import { ProxyAssignmentManager } from './ProxyAssignmentManager';

/**
 * Handles proxy-related errors and recovery
 */
export class ProxyErrorHandler {
  private eventManager: EventManager;
  private proxyPoolManager: ProxyPoolManager;
  private proxyAssignmentManager: ProxyAssignmentManager;

  constructor(
    eventManager: EventManager,
    proxyPoolManager: ProxyPoolManager,
    proxyAssignmentManager: ProxyAssignmentManager
  ) {
    this.eventManager = eventManager;
    this.proxyPoolManager = proxyPoolManager;
    this.proxyAssignmentManager = proxyAssignmentManager;
    
    // Listen for proxy status changes
    this.eventManager.on('proxyStatusChanged', this.handleProxyStatusChange.bind(this));
  }

  /**
   * Handle proxy status changes
   */
  private async handleProxyStatusChange(proxy: { id: string; url: string; status: string }): Promise<void> {
    if (proxy.status === 'error') {
      console.warn(`ProxyErrorHandler: Proxy ${proxy.id} (${proxy.url}) has failed`);
      
      // If this proxy has assigned keys, we might want to reassign them
      const assignments = this.proxyAssignmentManager.getAllAssignments();
      const assignedKeyCount = assignments.filter(a => a.proxyId === proxy.id).length;
      
      if (assignedKeyCount > 0) {
        console.log(`ProxyErrorHandler: Proxy ${proxy.id} has ${assignedKeyCount} assigned keys`);
        // For now, we'll let the keys continue using the failed proxy
        // The GoogleApiForwarder will handle fallback to direct connection
        // In the future, we could implement automatic reassignment here
      }
    } else if (proxy.status === 'active') {
      console.log(`ProxyErrorHandler: Proxy ${proxy.id} (${proxy.url}) has recovered`);
    }
  }

  /**
   * Handle proxy connection error
   */
  public async handleProxyError(proxyId: string, error: Error): Promise<void> {
    console.error(`ProxyErrorHandler: Error with proxy ${proxyId}:`, error.message);
    
    try {
      const proxy = this.proxyPoolManager.getProxy(proxyId);
      if (proxy) {
        // The ProxyPoolManager will handle marking the proxy as failed
        // during its health check cycle
        console.log(`ProxyErrorHandler: Proxy ${proxyId} will be checked in next health check cycle`);
      }
    } catch (err) {
      console.error(`ProxyErrorHandler: Error handling proxy error:`, err);
    }
  }

  /**
   * Handle assignment error
   */
  public async handleAssignmentError(keyId: string, proxyId: string, error: Error): Promise<void> {
    console.error(`ProxyErrorHandler: Assignment error for key ${keyId} to proxy ${proxyId}:`, error.message);
    
    try {
      // For now, we'll just log the error
      // In the future, we could implement automatic reassignment to a different proxy
      console.log(`ProxyErrorHandler: Key ${keyId} assignment to proxy ${proxyId} failed`);
    } catch (err) {
      console.error(`ProxyErrorHandler: Error handling assignment error:`, err);
    }
  }

  /**
   * Recover from proxy failure
   */
  public async recoverFromProxyFailure(keyId: string): Promise<void> {
    console.log(`ProxyErrorHandler: Attempting to recover from proxy failure for key ${keyId}`);
    
    try {
      // Get current assignment
      const assignment = this.proxyAssignmentManager.getAssignmentForKey(keyId);
      
      if (assignment) {
        const proxy = this.proxyPoolManager.getProxy(assignment.proxyId);
        
        if (proxy && proxy.status === 'error') {
          console.log(`ProxyErrorHandler: Current proxy ${proxy.id} is in error state`);
          
          // Try to find an alternative proxy
          const availableProxies = this.proxyPoolManager.getAvailableProxies();
          const alternativeProxy = availableProxies.find(p => p.id !== proxy.id);
          
          if (alternativeProxy) {
            console.log(`ProxyErrorHandler: Reassigning key ${keyId} to alternative proxy ${alternativeProxy.id}`);
            await this.proxyAssignmentManager.reassignProxy(keyId, alternativeProxy.id, false);
          } else {
            console.log(`ProxyErrorHandler: No alternative proxy available for key ${keyId}`);
            // Could unassign the proxy to allow direct connection
            // await this.proxyAssignmentManager.unassignProxy(keyId);
          }
        }
      }
    } catch (error) {
      console.error(`ProxyErrorHandler: Error during proxy failure recovery:`, error);
    }
  }
}