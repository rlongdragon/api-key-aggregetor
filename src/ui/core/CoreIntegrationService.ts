 import * as vscode from 'vscode';
import { EventManager } from '../../server/core/EventManager';
import ApiKeyManager from '../../server/core/ApiKeyManager';
import { ProxyPoolManager } from '../../server/core/ProxyPoolManager';
import { ProxyAssignmentManager } from '../../server/core/ProxyAssignmentManager';
import { uiStateManager } from './UIStateManager';
import { uiEventManager } from './UIEventManager';
import { DataTransformers } from '../utils/DataTransformers';

/**
 * Service that integrates UI components with core business logic managers
 */
export class CoreIntegrationService {
    private disposables: vscode.Disposable[] = [];
    private isInitialized = false;

    constructor(
        private coreEventManager: EventManager,
        private apiKeyManager: ApiKeyManager,
        private proxyPoolManager: ProxyPoolManager,
        private proxyAssignmentManager: ProxyAssignmentManager
    ) { }

    /**
     * Initialize the integration service and set up event listeners
     */
    public initialize(): void {
        if (this.isInitialized) {
            return;
        }

        this.setupCoreEventListeners();
        this.performInitialDataSync();
        this.isInitialized = true;

        console.log('CoreIntegrationService: Initialized successfully');
    }

    /**
     * Set up event listeners for core system events
     */
    private setupCoreEventListeners(): void {
        // Listen for API key events from core system
        this.coreEventManager.on('apiKeyAdded', (data) => {
            this.handleApiKeyAdded(data);
        });

        this.coreEventManager.on('apiKeyRemoved', (data) => {
            this.handleApiKeyRemoved(data);
        });

        this.coreEventManager.on('apiKeyStatusChanged', (data) => {
            this.handleApiKeyStatusChanged(data);
        });

        // Listen for proxy events from core system
        this.coreEventManager.on('proxyAdded', (data) => {
            this.handleProxyAdded(data);
        });

        this.coreEventManager.on('proxyRemoved', (data) => {
            this.handleProxyRemoved(data);
        });

        this.coreEventManager.on('proxyStatusChanged', (data) => {
            this.handleProxyStatusChanged(data);
        });

        // Listen for server events
        this.coreEventManager.on('serverStarted', (data) => {
            this.handleServerStarted(data);
        });

        this.coreEventManager.on('serverStopped', (data) => {
            this.handleServerStopped(data);
        });

        this.coreEventManager.on('serverError', (data) => {
            this.handleServerError(data);
        });

        // Listen for request events
        this.coreEventManager.on('requestUpdate', (data) => {
            this.handleRequestUpdate(data);
        });

        console.log('CoreIntegrationService: Event listeners set up');
    }

    /**
     * Perform initial data synchronization from core managers to UI
     */
    private async performInitialDataSync(): Promise<void> {
        try {
            // Sync API keys
            await this.syncApiKeys();

            // Sync proxies
            await this.syncProxies();

            // Sync server status
            await this.syncServerStatus();

            console.log('CoreIntegrationService: Initial data sync completed');
        } catch (error) {
            console.error('CoreIntegrationService: Error during initial sync:', error);
        }
    }

    /**
     * Sync API keys from core manager to UI state
     */
    private async syncApiKeys(): Promise<void> {
        try {
            const apiKeys = this.apiKeyManager.getAllKeys();

            for (const apiKey of apiKeys) {
                const treeItem = DataTransformers.transformApiKey(apiKey);
                uiStateManager.updateApiKey(apiKey.keyId, treeItem);
            }
        } catch (error) {
            console.error('CoreIntegrationService: Error syncing API keys:', error);
        }
    }

    /**
     * Sync proxies from core manager to UI state
     */
    private async syncProxies(): Promise<void> {
        try {
            const proxies = this.proxyPoolManager.getAllProxies();

            for (const proxy of proxies) {
                const assignments = this.proxyAssignmentManager.getAllAssignments()
                    .filter(a => a.proxyId === proxy.id);

                const treeItem = DataTransformers.transformProxy(proxy);
                // Add assignment information to the tree item
                treeItem.assignedKeys = assignments.map(a => a.keyId);
                uiStateManager.updateProxy(proxy.id, treeItem);
            }
        } catch (error) {
            console.error('CoreIntegrationService: Error syncing proxies:', error);
        }
    }

    /**
     * Sync server status from core system to UI state
     */
    private async syncServerStatus(): Promise<void> {
        try {
            // Get current server status from core system
            // This would need to be implemented in the core system
            const serverStatus = {
                isRunning: true, // This should come from actual server state
                port: 3146,
                totalRequests: 0,
                activeConnections: 0
            };

            uiStateManager.updateServerStatus(serverStatus);
        } catch (error) {
            console.error('CoreIntegrationService: Error syncing server status:', error);
        }
    }

    /**
     * Handle API key added event from core system
     */
    private handleApiKeyAdded(data: any): void {
        try {
            const treeItem = DataTransformers.transformApiKey(data.apiKey);
            uiStateManager.updateApiKey(data.apiKey.keyId, treeItem);

            // Emit UI event
            uiEventManager.emit('apiKeyAdded', {
                keyId: data.apiKey.keyId,
                item: treeItem
            });
        } catch (error) {
            console.error('CoreIntegrationService: Error handling API key added:', error);
        }
    }

    /**
     * Handle API key removed event from core system
     */
    private handleApiKeyRemoved(data: any): void {
        try {
            uiStateManager.removeApiKey(data.keyId);

            // Emit UI event
            uiEventManager.emit('apiKeyRemoved', {
                keyId: data.keyId
            });
        } catch (error) {
            console.error('CoreIntegrationService: Error handling API key removed:', error);
        }
    }

    /**
     * Handle API key status changed event from core system
     */
    private handleApiKeyStatusChanged(data: any): void {
        try {
            const treeItem = DataTransformers.transformApiKey(data.apiKey);
            uiStateManager.updateApiKey(data.apiKey.keyId, treeItem);

            // Emit UI event
            uiEventManager.emit('apiKeyUpdated', {
                keyId: data.apiKey.keyId,
                item: treeItem
            });
        } catch (error) {
            console.error('CoreIntegrationService: Error handling API key status changed:', error);
        }
    }

    /**
     * Handle proxy added event from core system
     */
    private handleProxyAdded(data: any): void {
        try {
            const assignments = this.proxyAssignmentManager.getAllAssignments()
                .filter(a => a.proxyId === data.proxy.id);

            const treeItem = DataTransformers.transformProxy(data.proxy);
            // Add assignment information to the tree item
            treeItem.assignedKeys = assignments.map(a => a.keyId);
            uiStateManager.updateProxy(data.proxy.id, treeItem);

            // Emit UI event
            uiEventManager.emit('proxyAdded', {
                proxyId: data.proxy.id,
                item: treeItem
            });
        } catch (error) {
            console.error('CoreIntegrationService: Error handling proxy added:', error);
        }
    }

    /**
     * Handle proxy removed event from core system
     */
    private handleProxyRemoved(data: any): void {
        try {
            uiStateManager.removeProxy(data.proxyId);

            // Emit UI event
            uiEventManager.emit('proxyRemoved', {
                proxyId: data.proxyId
            });
        } catch (error) {
            console.error('CoreIntegrationService: Error handling proxy removed:', error);
        }
    }

    /**
     * Handle proxy status changed event from core system
     */
    private handleProxyStatusChanged(data: any): void {
        try {
            const assignments = this.proxyAssignmentManager.getAllAssignments()
                .filter(a => a.proxyId === data.proxy.id);

            const treeItem = DataTransformers.transformProxy(data.proxy);
            // Add assignment information to the tree item
            treeItem.assignedKeys = assignments.map(a => a.keyId);
            uiStateManager.updateProxy(data.proxy.id, treeItem);

            // Emit UI event
            uiEventManager.emit('proxyUpdated', {
                proxyId: data.proxy.id,
                item: treeItem
            });
        } catch (error) {
            console.error('CoreIntegrationService: Error handling proxy status changed:', error);
        }
    }

    /**
     * Handle server started event from core system
     */
    private handleServerStarted(data: any): void {
        try {
            uiStateManager.updateServerStatus({
                isRunning: true,
                port: data.port,
                uptime: 0,
                totalRequests: 0,
                activeConnections: 0
            });
        } catch (error) {
            console.error('CoreIntegrationService: Error handling server started:', error);
        }
    }

    /**
     * Handle server stopped event from core system
     */
    private handleServerStopped(_data: any): void {
        try {
            uiStateManager.updateServerStatus({
                isRunning: false,
                totalRequests: 0,
                activeConnections: 0
            });
        } catch (error) {
            console.error('CoreIntegrationService: Error handling server stopped:', error);
        }
    }

    /**
     * Handle server error event from core system
     */
    private handleServerError(data: any): void {
        try {
            uiStateManager.updateServerStatus({
                isRunning: false,
                lastError: data.error,
                totalRequests: 0,
                activeConnections: 0
            });
        } catch (error) {
            console.error('CoreIntegrationService: Error handling server error:', error);
        }
    }

    /**
     * Handle request update event from core system
     */
    private handleRequestUpdate(data: any): void {
        try {
            // Update request statistics
            const currentStatus = uiStateManager.getServerStatus();

            // Count active requests
            const activeConnections = data.status === 'pending' ?
                currentStatus.activeConnections + 1 :
                Math.max(0, currentStatus.activeConnections - 1);

            // Count total requests
            const totalRequests = data.status === 'completed' || data.status === 'failed' ?
                currentStatus.totalRequests + 1 :
                currentStatus.totalRequests;

            uiStateManager.updateServerStatus({
                activeConnections,
                totalRequests
            });
        } catch (error) {
            console.error('CoreIntegrationService: Error handling request update:', error);
        }
    }

    /**
     * Force refresh of all data from core managers
     */
    public async forceRefresh(): Promise<void> {
        await this.performInitialDataSync();
        uiEventManager.emit('refreshRequested', {});
    }

    /**
     * Get API key from core manager
     */
    public async getApiKey(keyId: string): Promise<any> {
        try {
            // Find the key in the available keys
            const allKeys = this.apiKeyManager.getAllKeys();
            return allKeys.find(key => key.keyId === keyId);
        } catch (error) {
            console.error('CoreIntegrationService: Error getting API key:', error);
            return null;
        }
    }

    /**
     * Get proxy from core manager
     */
    public getProxy(proxyId: string): any {
        try {
            return this.proxyPoolManager.getProxy(proxyId);
        } catch (error) {
            console.error('CoreIntegrationService: Error getting proxy:', error);
            return null;
        }
    }

    /**
     * Get proxy assignments from core manager
     */
    public getProxyAssignments(proxyId?: string): any[] {
        try {
            const assignments = this.proxyAssignmentManager.getAllAssignments();
            return proxyId ? assignments.filter(a => a.proxyId === proxyId) : assignments;
        } catch (error) {
            console.error('CoreIntegrationService: Error getting proxy assignments:', error);
            return [];
        }
    }

    /**
     * Add API key through core manager
     */
    public async addApiKey(_apiKey: string): Promise<boolean> {
        try {
            // Note: The current ApiKeyManager doesn't have an addKey method
            // This would need to be implemented in the core system
            // For now, this is a placeholder that would need proper implementation
            console.warn('CoreIntegrationService: addApiKey not implemented in core ApiKeyManager');
            return false;
        } catch (error) {
            console.error('CoreIntegrationService: Error adding API key:', error);
            return false;
        }
    }

    /**
     * Remove API key through core manager
     */
    public async removeApiKey(_keyId: string): Promise<boolean> {
        try {
            // Note: The current ApiKeyManager doesn't have a removeKey method
            // This would need to be implemented in the core system
            // For now, this is a placeholder that would need proper implementation
            console.warn('CoreIntegrationService: removeApiKey not implemented in core ApiKeyManager');
            return false;
        } catch (error) {
            console.error('CoreIntegrationService: Error removing API key:', error);
            return false;
        }
    }

    /**
     * Add proxy through core manager
     */
    public async addProxy(url: string, _credentials?: { username: string; password: string }): Promise<boolean> {
        try {
            await this.proxyPoolManager.addProxy(url);
            // Note: credentials are not currently supported by the core ProxyPoolManager
            // This would need to be implemented in the core system
            return true;
        } catch (error) {
            console.error('CoreIntegrationService: Error adding proxy:', error);
            return false;
        }
    }

    /**
     * Remove proxy through core manager
     */
    public removeProxy(proxyId: string): boolean {
        try {
            this.proxyPoolManager.removeProxy(proxyId);
            return true;
        } catch (error) {
            console.error('CoreIntegrationService: Error removing proxy:', error);
            return false;
        }
    }

    /**
     * Test API key through core manager
     */
    public async testApiKey(keyId: string): Promise<boolean> {
        try {
            // Find the key in the available keys
            const allKeys = this.apiKeyManager.getAllKeys();
            const apiKey = allKeys.find(key => key.keyId === keyId);
            if (!apiKey) {
                return false;
            }

            // Check if key is available (not cooling down or disabled)
            return apiKey.status === 'available';
        } catch (error) {
            console.error('CoreIntegrationService: Error testing API key:', error);
            return false;
        }
    }

    /**
     * Test proxy through core manager
     */
    public async testProxy(proxyId: string): Promise<boolean> {
        try {
            // This would use the proxy health check functionality
            const proxy = this.proxyPoolManager.getProxy(proxyId);
            if (!proxy) {
                return false;
            }

            // Perform actual test - this is a placeholder
            return proxy.status === 'active';
        } catch (error) {
            console.error('CoreIntegrationService: Error testing proxy:', error);
            return false;
        }
    }

    /**
     * Dispose all resources
     */
    public dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.isInitialized = false;

        console.log('CoreIntegrationService: Disposed');
    }
}

/**
 * Create and configure the core integration service
 */
export function createCoreIntegrationService(
    coreEventManager: EventManager,
    apiKeyManager: ApiKeyManager,
    proxyPoolManager: ProxyPoolManager,
    proxyAssignmentManager: ProxyAssignmentManager
): CoreIntegrationService {
    return new CoreIntegrationService(
        coreEventManager,
        apiKeyManager,
        proxyPoolManager,
        proxyAssignmentManager
    );
}