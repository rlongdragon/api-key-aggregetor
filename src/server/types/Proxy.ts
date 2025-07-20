/**
 * Represents a proxy server in the proxy pool
 */
export interface ProxyServer {
  id: string;                           // Unique identifier for the proxy
  url: string;                          // Proxy URL (http://, https://, socks://, socks5://)
  status: 'active' | 'inactive' | 'error'; // Current status of the proxy
  assignedKeyCount: number;             // Number of API keys assigned to this proxy
  lastHealthCheck?: number;             // Timestamp of the last health check
  errorCount: number;                   // Number of consecutive errors
  lastError?: string;                   // Last error message (if any)
  createdAt: number;                    // Timestamp when the proxy was added
  updatedAt: number;                    // Timestamp when the proxy was last updated
}

/**
 * Represents an assignment between an API key and a proxy server
 */
export interface ProxyAssignment {
  keyId: string;                        // API Key ID
  proxyId: string;                      // Proxy server ID
  assignedAt: number;                   // Timestamp when the assignment was made
  isManual: boolean;                    // Whether the assignment was made manually
  lastUsed?: number;                    // Timestamp when the assignment was last used
}

/**
 * Configuration options for proxy management
 */
export interface ProxyConfiguration {
  autoAssignmentEnabled: boolean;       // Whether to automatically assign proxies to new API keys
  loadBalancingStrategy: 'round_robin' | 'least_loaded' | 'random'; // Strategy for load balancing
  healthCheckInterval: number;          // Interval in ms between health checks
  maxErrorsBeforeDisable: number;       // Number of consecutive errors before disabling a proxy
  rebalanceThreshold: number;           // Threshold for triggering rebalancing
}

/**
 * Storage schema for proxy pool
 */
export interface StoredProxyPool {
  proxies: {
    id: string;
    url: string;
    status: string;
    errorCount: number;
    createdAt: number;
    updatedAt: number;
  }[];
  lastUpdated: number;
}

/**
 * Storage schema for proxy assignments
 */
export interface StoredProxyAssignments {
  assignments: {
    keyId: string;
    proxyId: string;
    assignedAt: number;
    isManual: boolean;
    lastUsed?: number;
  }[];
  lastUpdated: number;
}

/**
 * Storage keys for proxy-related data
 */
export const PROXY_STORAGE_KEYS = {
  PROXY_POOL: 'geminiProxyPool',
  PROXY_ASSIGNMENTS: 'geminiProxyAssignments',
  PROXY_SETTINGS: 'geminiProxySettings'
};

/**
 * Interface for load balancing strategies
 */
export interface LoadBalancingStrategy {
  selectProxyForNewKey(availableProxies: ProxyServer[]): ProxyServer | null;
  shouldRebalance(assignments: ProxyAssignment[], proxies: ProxyServer[]): boolean;
}

/**
 * Rebalance plan for proxy assignments
 */
export interface RebalancePlan {
  reassignments: {
    keyId: string;
    fromProxyId: string;
    toProxyId: string;
  }[];
  expectedLoadAfter: Map<string, number>;
}