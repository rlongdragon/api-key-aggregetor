import * as vscode from 'vscode';
import { ProxyPoolManager } from './ProxyPoolManager';
import { ProxyAssignmentManager } from './ProxyAssignmentManager';
import { ProxyConfigurationManager } from './ProxyConfigurationManager';
import { EventManager } from './EventManager';

/**
 * Manages migration from legacy proxy system to new proxy-per-API-key system
 */
export class MigrationManager {
  private context: vscode.ExtensionContext;
  private eventManager: EventManager;
  private proxyPoolManager: ProxyPoolManager;
  private proxyAssignmentManager: ProxyAssignmentManager;
  private proxyConfigurationManager: ProxyConfigurationManager;

  constructor(
    context: vscode.ExtensionContext,
    eventManager: EventManager,
    proxyPoolManager: ProxyPoolManager,
    proxyAssignmentManager: ProxyAssignmentManager,
    proxyConfigurationManager: ProxyConfigurationManager
  ) {
    this.context = context;
    this.eventManager = eventManager;
    this.proxyPoolManager = proxyPoolManager;
    this.proxyAssignmentManager = proxyAssignmentManager;
    this.proxyConfigurationManager = proxyConfigurationManager;
  }

  /**
   * Perform complete migration from legacy system
   */
  public async performMigration(): Promise<void> {
    console.log('MigrationManager: Starting migration from legacy proxy system');

    try {
      // Check if migration has already been performed
      const migrationVersion = await this.context.secrets.get('proxyMigrationVersion');
      const currentVersion = '1.0.0';

      if (migrationVersion === currentVersion) {
        console.log('MigrationManager: Migration already completed for this version');
        return;
      }

      // Step 1: Migrate proxy configuration
      await this.migrateLegacyConfiguration();

      // Step 2: Migrate proxy pool
      await this.migrateLegacyProxyPool();

      // Step 3: Migrate API key proxy assignments
      await this.migrateLegacyApiKeyProxies();

      // Step 4: Clean up legacy data (optional)
      await this.cleanupLegacyData();

      // Mark migration as completed
      await this.context.secrets.store('proxyMigrationVersion', currentVersion);

      console.log('MigrationManager: Migration completed successfully');
      
      // Show user notification
      vscode.window.showInformationMessage(
        'Proxy system has been upgraded! Your existing proxy settings have been migrated to the new system.',
        'Learn More'
      ).then(selection => {
        if (selection === 'Learn More') {
          vscode.env.openExternal(vscode.Uri.parse('https://github.com/your-repo/wiki/proxy-upgrade'));
        }
      });

    } catch (error) {
      console.error('MigrationManager: Migration failed:', error);
      vscode.window.showWarningMessage(
        'Proxy system migration encountered issues. Some settings may need to be reconfigured.',
        'View Logs'
      ).then(selection => {
        if (selection === 'View Logs') {
          vscode.commands.executeCommand('workbench.action.toggleDevTools');
        }
      });
    }
  }

  /**
   * Migrate legacy proxy configuration
   */
  private async migrateLegacyConfiguration(): Promise<void> {
    console.log('MigrationManager: Migrating legacy configuration');

    // This is already handled by ProxyConfigurationManager.migrateLegacyConfiguration()
    await this.proxyConfigurationManager.migrateLegacyConfiguration();
  }

  /**
   * Migrate legacy proxy pool from simple array to new proxy pool system
   */
  private async migrateLegacyProxyPool(): Promise<void> {
    console.log('MigrationManager: Migrating legacy proxy pool');

    try {
      const legacyProxiesJson = await this.context.secrets.get('geminiProxies');
      
      if (legacyProxiesJson) {
        const legacyProxies: string[] = JSON.parse(legacyProxiesJson);
        
        if (legacyProxies.length > 0) {
          console.log(`MigrationManager: Found ${legacyProxies.length} legacy proxies to migrate`);
          
          // Add each legacy proxy to the new proxy pool
          const migratedProxyIds: string[] = [];
          
          for (const proxyUrl of legacyProxies) {
            try {
              // Check if proxy already exists in new system
              const existingProxies = this.proxyPoolManager.getAllProxies();
              const existingProxy = existingProxies.find(p => p.url === proxyUrl);
              
              if (!existingProxy) {
                const proxyId = await this.proxyPoolManager.addProxy(proxyUrl);
                migratedProxyIds.push(proxyId);
                console.log(`MigrationManager: Migrated proxy ${proxyUrl} to new system (ID: ${proxyId})`);
              } else {
                console.log(`MigrationManager: Proxy ${proxyUrl} already exists in new system`);
              }
            } catch (error) {
              console.warn(`MigrationManager: Failed to migrate proxy ${proxyUrl}:`, error);
            }
          }
          
          console.log(`MigrationManager: Successfully migrated ${migratedProxyIds.length} proxies to new system`);
        }
      }
    } catch (error) {
      console.error('MigrationManager: Error migrating legacy proxy pool:', error);
    }
  }

  /**
   * Migrate legacy API key proxy assignments
   */
  private async migrateLegacyApiKeyProxies(): Promise<void> {
    console.log('MigrationManager: Migrating legacy API key proxy assignments');

    try {
      // Get all stored API key IDs
      const storedKeyIdsJson = await this.context.secrets.get('geminiApiKeysIds');
      if (!storedKeyIdsJson) {
        console.log('MigrationManager: No API keys found to migrate');
        return;
      }

      const storedKeyIds: string[] = JSON.parse(storedKeyIdsJson);
      let migratedCount = 0;

      for (const keyId of storedKeyIds) {
        try {
          // Check if this key has a legacy proxy assignment
          const keyStatusId = `apiKeyStatus_${keyId}`;
          const storedStatusJson = await this.context.secrets.get(keyStatusId);
          
          if (storedStatusJson) {
            const storedStatus = JSON.parse(storedStatusJson);
            const legacyProxy = storedStatus.proxy;
            
            if (legacyProxy && !storedStatus.assignedProxyId) {
              // This key has a legacy proxy but no new assignment
              console.log(`MigrationManager: Migrating proxy assignment for key ${keyId}: ${legacyProxy}`);
              
              // Find or create the proxy in the new system
              const existingProxies = this.proxyPoolManager.getAllProxies();
              let targetProxy = existingProxies.find(p => p.url === legacyProxy);
              
              if (!targetProxy) {
                // Create the proxy if it doesn't exist
                const proxyId = await this.proxyPoolManager.addProxy(legacyProxy);
                targetProxy = this.proxyPoolManager.getProxy(proxyId);
              }
              
              if (targetProxy) {
                // Assign the proxy to the key in the new system
                await this.proxyAssignmentManager.assignProxyToKey(keyId, targetProxy.id, true);
                migratedCount++;
                console.log(`MigrationManager: Assigned proxy ${targetProxy.url} to key ${keyId}`);
              }
            }
          }
        } catch (error) {
          console.warn(`MigrationManager: Failed to migrate proxy assignment for key ${keyId}:`, error);
        }
      }

      console.log(`MigrationManager: Successfully migrated ${migratedCount} API key proxy assignments`);
    } catch (error) {
      console.error('MigrationManager: Error migrating API key proxy assignments:', error);
    }
  }

  /**
   * Clean up legacy data (optional - can be disabled for safety)
   */
  private async cleanupLegacyData(): Promise<void> {
    // For safety, we'll keep legacy data for now
    // Users can manually clean it up later if desired
    console.log('MigrationManager: Keeping legacy data for safety (can be cleaned up manually)');
    
    // Uncomment the following lines if you want to clean up legacy data:
    /*
    try {
      await this.context.secrets.delete('geminiProxies');
      await this.context.secrets.delete('geminiRotatingProxy');
      console.log('MigrationManager: Cleaned up legacy proxy data');
    } catch (error) {
      console.warn('MigrationManager: Error cleaning up legacy data:', error);
    }
    */
  }

  /**
   * Check if migration is needed
   */
  public async isMigrationNeeded(): Promise<boolean> {
    try {
      const migrationVersion = await this.context.secrets.get('proxyMigrationVersion');
      const currentVersion = '1.0.0';
      
      if (migrationVersion === currentVersion) {
        return false;
      }

      // Check if there's any legacy data to migrate
      const legacyProxiesJson = await this.context.secrets.get('geminiProxies');
      const legacyRotatingProxy = await this.context.secrets.get('geminiRotatingProxy');
      
      return !!(legacyProxiesJson || legacyRotatingProxy);
    } catch (error) {
      console.error('MigrationManager: Error checking migration status:', error);
      return false;
    }
  }

  /**
   * Get migration status report
   */
  public async getMigrationReport(): Promise<{
    migrationCompleted: boolean;
    legacyProxiesFound: number;
    migratedProxies: number;
    legacyAssignmentsFound: number;
    migratedAssignments: number;
  }> {
    try {
      const migrationVersion = await this.context.secrets.get('proxyMigrationVersion');
      const migrationCompleted = migrationVersion === '1.0.0';

      let legacyProxiesFound = 0;
      let legacyAssignmentsFound = 0;

      // Count legacy proxies
      const legacyProxiesJson = await this.context.secrets.get('geminiProxies');
      if (legacyProxiesJson) {
        const legacyProxies: string[] = JSON.parse(legacyProxiesJson);
        legacyProxiesFound = legacyProxies.length;
      }

      // Count legacy assignments
      const storedKeyIdsJson = await this.context.secrets.get('geminiApiKeysIds');
      if (storedKeyIdsJson) {
        const storedKeyIds: string[] = JSON.parse(storedKeyIdsJson);
        for (const keyId of storedKeyIds) {
          const keyStatusId = `apiKeyStatus_${keyId}`;
          const storedStatusJson = await this.context.secrets.get(keyStatusId);
          if (storedStatusJson) {
            const storedStatus = JSON.parse(storedStatusJson);
            if (storedStatus.proxy && !storedStatus.assignedProxyId) {
              legacyAssignmentsFound++;
            }
          }
        }
      }

      // Count migrated items
      const migratedProxies = this.proxyPoolManager.getAllProxies().length;
      const migratedAssignments = this.proxyAssignmentManager.getAllAssignments().length;

      return {
        migrationCompleted,
        legacyProxiesFound,
        migratedProxies,
        legacyAssignmentsFound,
        migratedAssignments
      };
    } catch (error) {
      console.error('MigrationManager: Error generating migration report:', error);
      return {
        migrationCompleted: false,
        legacyProxiesFound: 0,
        migratedProxies: 0,
        legacyAssignmentsFound: 0,
        migratedAssignments: 0
      };
    }
  }
}