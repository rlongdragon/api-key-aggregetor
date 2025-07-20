import { getValidatedTestConfig } from './proxy';
import { ApiKey } from '../types/ApiKey';

/**
 * Initialize test API keys from environment variables
 */
export function initializeTestApiKeys(): ApiKey[] {
  const config = getValidatedTestConfig();
  
  if (config.apiKeys.length === 0) {
    console.warn('No API keys found in environment. Please set GEMINI_API_KEYS in your .env file');
    return [];
  }
  
  return config.apiKeys.map((key, index) => ({
    key,
    keyId: `key${index + 1}`,
    status: 'available' as const,
    currentRequests: 0,
    usedHistory: []
  }));
}

/**
 * Initialize test proxy servers from environment variables
 */
export function initializeTestProxies(): string[] {
  const config = getValidatedTestConfig();
  
  if (config.proxyServers.length === 0) {
    console.warn('No proxy servers found in environment. Please set PROXY_SERVERS in your .env file');
    return [];
  }
  
  console.log(`Found ${config.proxyServers.length} proxy servers in environment:`, 
    config.proxyServers.map(p => p.replace(/\/\/.*@/, '//***@'))); // Hide credentials in logs
  
  return config.proxyServers;
}

/**
 * Get proxy configuration for testing
 */
export function getTestProxyConfig() {
  const config = getValidatedTestConfig();
  return config.proxyConfig;
}

/**
 * Check if we're in test mode
 */
export function isTestMode(): boolean {
  return getValidatedTestConfig().proxyConfig.testMode;
}

/**
 * Log test configuration (without sensitive data)
 */
export function logTestConfig(): void {
  const config = getValidatedTestConfig();
  
  console.log('=== Test Configuration ===');
  console.log(`API Keys: ${config.apiKeys.length} found`);
  console.log(`Proxy Servers: ${config.proxyServers.length} found`);
  console.log(`Auto Assignment: ${config.proxyConfig.autoAssignmentEnabled}`);
  console.log(`Load Balancing: ${config.proxyConfig.loadBalancingStrategy}`);
  console.log(`Health Check Interval: ${config.proxyConfig.healthCheckInterval}ms`);
  console.log(`Max Errors Before Disable: ${config.proxyConfig.maxErrorsBeforeDisable}`);
  console.log(`Test Mode: ${config.proxyConfig.testMode}`);
  console.log('========================');
}