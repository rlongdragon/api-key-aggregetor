/**
 * Configuration for rotating proxy endpoint
 */
export interface RotatingProxyConfig {
  enabled: boolean;                     // Whether rotating proxy is enabled
  url: string;                          // Rotating proxy URL
  isValid: boolean;                     // Whether the URL format is valid
  lastHealthCheck?: Date;               // Last health check timestamp
  errorCount: number;                   // Number of consecutive errors
  lastError?: string;                   // Last error message
  responseTime?: number;                // Last response time in milliseconds
  totalRequests: number;                // Total requests made through this proxy
  successfulRequests: number;           // Number of successful requests
  createdAt: Date;                      // When the configuration was created
  updatedAt: Date;                      // When the configuration was last updated
}

/**
 * Health status for rotating proxy
 */
export interface RotatingProxyHealthStatus {
  isHealthy: boolean;                   // Overall health status
  lastCheck: Date;                      // Last health check timestamp
  responseTime?: number;                // Response time in milliseconds
  errorCount: number;                   // Number of recent errors
  consecutiveErrors: number;            // Number of consecutive errors
  uptime: number;                       // Uptime percentage (0-100)
  lastError?: string;                   // Last error message
}

/**
 * Statistics for rotating proxy usage
 */
export interface RotatingProxyStats {
  totalRequests: number;                // Total requests made
  successfulRequests: number;           // Successful requests
  failedRequests: number;               // Failed requests
  averageResponseTime: number;          // Average response time in ms
  requestsPerMinute: number;            // Current requests per minute
  lastRequestTime?: Date;               // Timestamp of last request
  errorRate: number;                    // Error rate percentage (0-100)
}

/**
 * Validation result for rotating proxy URL
 */
export interface RotatingProxyValidation {
  isValid: boolean;                     // Whether the URL is valid
  errors: string[];                     // List of validation errors
  warnings: string[];                   // List of validation warnings
  parsedUrl?: URL;                      // Parsed URL object if valid
  hasRotateCredentials: boolean;        // Whether URL contains rotate credentials
}

/**
 * Storage schema for rotating proxy configuration
 */
export interface StoredRotatingProxyConfig {
  enabled: boolean;
  url: string;
  errorCount: number;
  totalRequests: number;
  successfulRequests: number;
  lastHealthCheck?: string;             // ISO string
  lastError?: string;
  responseTime?: number;
  createdAt: string;                    // ISO string
  updatedAt: string;                    // ISO string
}

/**
 * Storage keys for rotating proxy data
 */
export const ROTATING_PROXY_STORAGE_KEYS = {
  CONFIG: 'geminiRotatingProxyConfig',
  STATS: 'geminiRotatingProxyStats',
  HEALTH: 'geminiRotatingProxyHealth'
};

/**
 * Constants for rotating proxy validation and operation
 */
export const ROTATING_PROXY_CONSTANTS = {
  MAX_CONSECUTIVE_ERRORS: 5,            // Max consecutive errors before marking unhealthy
  HEALTH_CHECK_INTERVAL: 60000,         // Health check interval in ms (1 minute)
  HEALTH_CHECK_TIMEOUT: 10000,          // Health check timeout in ms (10 seconds)
  STATS_WINDOW_SIZE: 100,               // Number of recent requests to track for stats
  MIN_UPTIME_THRESHOLD: 80,             // Minimum uptime percentage to consider healthy
  ROTATE_USERNAME_PATTERN: /.*-rotate$/, // Pattern to detect rotating proxy credentials
};