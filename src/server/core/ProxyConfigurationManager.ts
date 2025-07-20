import { ProxyConfiguration, PROXY_STORAGE_KEYS } from '../types/Proxy';
import { 
  RotatingProxyConfig, 
  RotatingProxyValidation, 
  ROTATING_PROXY_STORAGE_KEYS,
  ROTATING_PROXY_CONSTANTS 
} from '../types/RotatingProxy';
import * as vscode from 'vscode';
import config from '../config';

/**
 * Manages proxy configuration settings and persistence
 */
export class ProxyConfigurationManager {
  private context: vscode.ExtensionContext;
  private defaultConfig: ProxyConfiguration = {
    autoAssignmentEnabled: true,
    loadBalancingStrategy: 'least_loaded',
    healthCheckInterval: 60000, // 1 minute
    maxErrorsBeforeDisable: 3,
    rebalanceThreshold: 1
  };

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Load proxy configuration from storage
   */
  public async loadConfiguration(): Promise<ProxyConfiguration> {
    try {
      const storedConfigJson = await this.context.secrets.get(PROXY_STORAGE_KEYS.PROXY_SETTINGS);
      
      if (storedConfigJson) {
        const storedConfig = JSON.parse(storedConfigJson);
        
        // Merge with defaults to ensure all properties exist
        const config: ProxyConfiguration = {
          ...this.defaultConfig,
          ...storedConfig
        };
        
        console.log('ProxyConfigurationManager: Loaded configuration from storage');
        return config;
      } else {
        console.log('ProxyConfigurationManager: No stored configuration found, using defaults');
        return { ...this.defaultConfig };
      }
    } catch (error) {
      console.error('ProxyConfigurationManager: Error loading configuration, using defaults:', error);
      return { ...this.defaultConfig };
    }
  }

  /**
   * Save proxy configuration to storage
   */
  public async saveConfiguration(config: ProxyConfiguration): Promise<void> {
    try {
      await this.context.secrets.store(
        PROXY_STORAGE_KEYS.PROXY_SETTINGS,
        JSON.stringify(config)
      );
      console.log('ProxyConfigurationManager: Configuration saved to storage');
    } catch (error) {
      console.error('ProxyConfigurationManager: Error saving configuration:', error);
      throw error;
    }
  }

  /**
   * Update specific configuration settings
   */
  public async updateConfiguration(updates: Partial<ProxyConfiguration>): Promise<ProxyConfiguration> {
    const currentConfig = await this.loadConfiguration();
    const newConfig: ProxyConfiguration = {
      ...currentConfig,
      ...updates
    };
    
    await this.saveConfiguration(newConfig);
    return newConfig;
  }

  /**
   * Reset configuration to defaults
   */
  public async resetConfiguration(): Promise<ProxyConfiguration> {
    const defaultConfig = { ...this.defaultConfig };
    await this.saveConfiguration(defaultConfig);
    console.log('ProxyConfigurationManager: Configuration reset to defaults');
    return defaultConfig;
  }

  /**
   * Migrate legacy proxy configuration to new system
   */
  public async migrateLegacyConfiguration(): Promise<void> {
    try {
      // Check for legacy rotating proxy setting
      const legacyProxiesJson = await this.context.secrets.get("geminiProxies");
      const legacyRotatingProxy = await this.context.secrets.get("geminiRotatingProxy");
      
      if (legacyProxiesJson || legacyRotatingProxy) {
        console.log('ProxyConfigurationManager: Found legacy configuration, migrating...');
        
        const currentConfig = await this.loadConfiguration();
        let needsUpdate = false;
        
        // If legacy rotating proxy was enabled, disable auto-assignment
        if (legacyRotatingProxy === 'true') {
          currentConfig.autoAssignmentEnabled = false;
          needsUpdate = true;
          console.log('ProxyConfigurationManager: Migrated legacy rotating proxy setting');
        }
        
        if (needsUpdate) {
          await this.saveConfiguration(currentConfig);
        }
        
        console.log('ProxyConfigurationManager: Legacy configuration migration completed');
      }
    } catch (error) {
      console.error('ProxyConfigurationManager: Error during legacy migration:', error);
      // Don't throw - migration failures shouldn't break the system
    }
  }

  /**
   * Validate configuration values
   */
  public validateConfiguration(config: Partial<ProxyConfiguration>): string[] {
    const errors: string[] = [];
    
    if (config.healthCheckInterval !== undefined) {
      if (config.healthCheckInterval < 10000) {
        errors.push('Health check interval must be at least 10 seconds');
      }
      if (config.healthCheckInterval > 600000) {
        errors.push('Health check interval must be at most 10 minutes');
      }
    }
    
    if (config.maxErrorsBeforeDisable !== undefined) {
      if (config.maxErrorsBeforeDisable < 1) {
        errors.push('Max errors before disable must be at least 1');
      }
      if (config.maxErrorsBeforeDisable > 10) {
        errors.push('Max errors before disable must be at most 10');
      }
    }
    
    if (config.rebalanceThreshold !== undefined) {
      if (config.rebalanceThreshold < 0) {
        errors.push('Rebalance threshold must be non-negative');
      }
      if (config.rebalanceThreshold > 5) {
        errors.push('Rebalance threshold must be at most 5');
      }
    }
    
    if (config.loadBalancingStrategy !== undefined) {
      const validStrategies = ['round_robin', 'least_loaded', 'random'];
      if (!validStrategies.includes(config.loadBalancingStrategy)) {
        errors.push(`Load balancing strategy must be one of: ${validStrategies.join(', ')}`);
      }
    }
    
    return errors;
  }

  /**
   * Export configuration for backup
   */
  public async exportConfiguration(): Promise<string> {
    const config = await this.loadConfiguration();
    return JSON.stringify(config, null, 2);
  }

  /**
   * Import configuration from backup
   */
  public async importConfiguration(configJson: string): Promise<ProxyConfiguration> {
    try {
      const config = JSON.parse(configJson) as Partial<ProxyConfiguration>;
      
      // Validate the imported configuration
      const errors = this.validateConfiguration(config);
      if (errors.length > 0) {
        throw new Error(`Invalid configuration: ${errors.join(', ')}`);
      }
      
      // Merge with defaults to ensure all properties exist
      const fullConfig: ProxyConfiguration = {
        ...this.defaultConfig,
        ...config
      };
      
      await this.saveConfiguration(fullConfig);
      console.log('ProxyConfigurationManager: Configuration imported successfully');
      return fullConfig;
    } catch (error) {
      console.error('ProxyConfigurationManager: Error importing configuration:', error);
      throw new Error(`Failed to import configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get default configuration
   */
  public getDefaultConfiguration(): ProxyConfiguration {
    return { ...this.defaultConfig };
  }

  /**
   * Check if configuration has been customized from defaults
   */
  public async isConfigurationCustomized(): Promise<boolean> {
    const currentConfig = await this.loadConfiguration();
    return JSON.stringify(currentConfig) !== JSON.stringify(this.defaultConfig);
  }

  // ==================== ROTATING PROXY METHODS ====================

  /**
   * Get the configured rotating proxy URL
   */
  public getRotatingProxy(): string | undefined {
    return config.ROTATING_PROXY;
  }

  /**
   * Check if rotating proxy is enabled
   */
  public isRotatingProxyEnabled(): boolean {
    return config.USE_ROTATING_PROXY;
  }

  /**
   * Validate rotating proxy URL format
   */
  public validateRotatingProxyUrl(url: string): RotatingProxyValidation {
    const result: RotatingProxyValidation = {
      isValid: false,
      errors: [],
      warnings: [],
      hasRotateCredentials: false
    };

    if (!url || url.trim() === '') {
      result.errors.push('Rotating proxy URL cannot be empty');
      return result;
    }

    try {
      const parsedUrl = new URL(url);
      result.parsedUrl = parsedUrl;

      // Check supported protocols
      const supportedProtocols = ['http:', 'https:', 'socks:', 'socks5:'];
      if (!supportedProtocols.includes(parsedUrl.protocol)) {
        result.errors.push(`Unsupported protocol: ${parsedUrl.protocol}. Supported: ${supportedProtocols.join(', ')}`);
      }

      // Check for hostname
      if (!parsedUrl.hostname) {
        result.errors.push('Rotating proxy URL must include a hostname');
      }

      // Check for port
      if (!parsedUrl.port) {
        result.warnings.push('No port specified, using default port for protocol');
      }

      // Check for rotating credentials pattern
      if (parsedUrl.username) {
        result.hasRotateCredentials = ROTATING_PROXY_CONSTANTS.ROTATE_USERNAME_PATTERN.test(parsedUrl.username);
        
        if (!result.hasRotateCredentials) {
          result.warnings.push('Username does not follow rotating proxy pattern (should end with "-rotate")');
        }

        if (!parsedUrl.password) {
          result.errors.push('Password is required when username is provided');
        }
      }

      // If no errors, mark as valid
      result.isValid = result.errors.length === 0;

    } catch (error) {
      result.errors.push(`Invalid URL format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Load rotating proxy configuration from storage
   */
  public async loadRotatingProxyConfig(): Promise<RotatingProxyConfig> {
    try {
      const storedConfigJson = await this.context.secrets.get(ROTATING_PROXY_STORAGE_KEYS.CONFIG);
      
      if (storedConfigJson) {
        const storedConfig = JSON.parse(storedConfigJson);
        
        return {
          enabled: config.USE_ROTATING_PROXY,
          url: config.ROTATING_PROXY || '',
          isValid: this.validateRotatingProxyUrl(config.ROTATING_PROXY || '').isValid,
          lastHealthCheck: storedConfig.lastHealthCheck ? new Date(storedConfig.lastHealthCheck) : undefined,
          errorCount: storedConfig.errorCount || 0,
          lastError: storedConfig.lastError,
          responseTime: storedConfig.responseTime,
          totalRequests: storedConfig.totalRequests || 0,
          successfulRequests: storedConfig.successfulRequests || 0,
          createdAt: storedConfig.createdAt ? new Date(storedConfig.createdAt) : new Date(),
          updatedAt: storedConfig.updatedAt ? new Date(storedConfig.updatedAt) : new Date()
        };
      } else {
        // Return default configuration
        return {
          enabled: config.USE_ROTATING_PROXY,
          url: config.ROTATING_PROXY || '',
          isValid: config.ROTATING_PROXY ? this.validateRotatingProxyUrl(config.ROTATING_PROXY).isValid : false,
          errorCount: 0,
          totalRequests: 0,
          successfulRequests: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }
    } catch (error) {
      console.error('ProxyConfigurationManager: Error loading rotating proxy configuration:', error);
      
      // Return default configuration on error
      return {
        enabled: false,
        url: '',
        isValid: false,
        errorCount: 0,
        totalRequests: 0,
        successfulRequests: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
  }

  /**
   * Save rotating proxy configuration to storage
   */
  public async saveRotatingProxyConfig(config: RotatingProxyConfig): Promise<void> {
    try {
      const storageData = {
        enabled: config.enabled,
        url: config.url,
        errorCount: config.errorCount,
        totalRequests: config.totalRequests,
        successfulRequests: config.successfulRequests,
        lastHealthCheck: config.lastHealthCheck?.toISOString(),
        lastError: config.lastError,
        responseTime: config.responseTime,
        createdAt: config.createdAt.toISOString(),
        updatedAt: new Date().toISOString()
      };

      await this.context.secrets.store(
        ROTATING_PROXY_STORAGE_KEYS.CONFIG,
        JSON.stringify(storageData)
      );
      
      console.log('ProxyConfigurationManager: Rotating proxy configuration saved');
    } catch (error) {
      console.error('ProxyConfigurationManager: Error saving rotating proxy configuration:', error);
      throw error;
    }
  }

  /**
   * Update rotating proxy statistics
   */
  public async updateRotatingProxyStats(
    success: boolean, 
    responseTime?: number, 
    error?: string
  ): Promise<void> {
    try {
      const config = await this.loadRotatingProxyConfig();
      
      config.totalRequests++;
      if (success) {
        config.successfulRequests++;
        config.errorCount = 0; // Reset error count on success
      } else {
        config.errorCount++;
        if (error) {
          config.lastError = error;
        }
      }
      
      if (responseTime !== undefined) {
        config.responseTime = responseTime;
      }
      
      config.updatedAt = new Date();
      
      await this.saveRotatingProxyConfig(config);
    } catch (error) {
      console.error('ProxyConfigurationManager: Error updating rotating proxy stats:', error);
    }
  }
}