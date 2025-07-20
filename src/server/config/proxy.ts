import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface ProxyConfig {
  healthCheckInterval: number;
  maxErrorsBeforeDisable: number;
  autoAssignmentEnabled: boolean;
  loadBalancingStrategy: 'round_robin' | 'least_loaded' | 'random';
  testMode: boolean;
  testProxyTimeout: number;
}

export interface TestConfig {
  apiKeys: string[];
  proxyServers: string[];
  proxyConfig: ProxyConfig;
}

/**
 * Parse comma-separated environment variable
 */
function parseCommaSeparated(envVar: string | undefined): string[] {
  if (!envVar) return [];
  return envVar.split(',').map(item => item.trim()).filter(item => item.length > 0);
}

/**
 * Get test configuration from environment variables
 */
export function getTestConfig(): TestConfig {
  const apiKeys = parseCommaSeparated(process.env.GEMINI_API_KEYS);
  const proxyServers = parseCommaSeparated(process.env.PROXY_SERVERS);
  
  const proxyConfig: ProxyConfig = {
    healthCheckInterval: parseInt(process.env.PROXY_HEALTH_CHECK_INTERVAL || '60000', 10),
    maxErrorsBeforeDisable: parseInt(process.env.PROXY_MAX_ERRORS_BEFORE_DISABLE || '3', 10),
    autoAssignmentEnabled: process.env.PROXY_AUTO_ASSIGNMENT_ENABLED !== 'false',
    loadBalancingStrategy: (process.env.PROXY_LOAD_BALANCING_STRATEGY as 'round_robin' | 'least_loaded' | 'random') || 'least_loaded',
    testMode: process.env.TEST_MODE === 'true',
    testProxyTimeout: parseInt(process.env.TEST_PROXY_TIMEOUT || '5000', 10)
  };
  
  return {
    apiKeys,
    proxyServers,
    proxyConfig
  };
}

/**
 * Validate proxy URL format
 */
export function validateProxyUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'socks:', 'socks5:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Validate API key format (basic validation)
 */
export function validateApiKey(key: string): boolean {
  // Basic validation - Gemini API keys typically start with 'AIza' and are 39 characters long
  return key.length >= 20 && key.length <= 50 && /^[A-Za-z0-9_-]+$/.test(key);
}

/**
 * Get configuration with validation
 */
export function getValidatedTestConfig(): TestConfig {
  const config = getTestConfig();
  
  // Validate API keys
  const validApiKeys = config.apiKeys.filter(key => {
    const isValid = validateApiKey(key);
    if (!isValid) {
      console.warn(`Invalid API key format: ${key.substring(0, 10)}...`);
    }
    return isValid;
  });
  
  // Validate proxy servers
  const validProxyServers = config.proxyServers.filter(proxy => {
    const isValid = validateProxyUrl(proxy);
    if (!isValid) {
      console.warn(`Invalid proxy URL format: ${proxy}`);
    }
    return isValid;
  });
  
  if (validApiKeys.length === 0) {
    console.warn('No valid API keys found in environment variables');
  }
  
  if (validProxyServers.length === 0) {
    console.warn('No valid proxy servers found in environment variables');
  }
  
  return {
    apiKeys: validApiKeys,
    proxyServers: validProxyServers,
    proxyConfig: config.proxyConfig
  };
}