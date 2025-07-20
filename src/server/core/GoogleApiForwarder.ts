import { GoogleGenAI } from '@google/genai';
import { ApiKey } from '../types';
import { RotatingProxyConfig } from '../types/RotatingProxy';
import { RotatingProxyHealthMonitor } from './RotatingProxyHealthMonitor';
import config from '../config';

// 定义一个简单的错误类型，用于传递 Google API 错误信息，特别是包含 Key 信息
export class GoogleApiError extends Error {
  statusCode?: number;
  apiKey?: string;
  isRateLimitError: boolean;
  isProxyError: boolean;
  proxyUrl?: string;

  constructor(
    message: string, 
    statusCode?: number, 
    apiKey?: string, 
    isRateLimitError: boolean = false,
    isProxyError: boolean = false,
    proxyUrl?: string
  ) {
    super(message);
    this.name = 'GoogleApiError';
    this.statusCode = statusCode;
    this.apiKey = apiKey;
    this.isRateLimitError = isRateLimitError;
    this.isProxyError = isProxyError;
    this.proxyUrl = proxyUrl;
  }
}

import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

class GoogleApiForwarder {
  private maxProxyRetries: number = 1;
  private requestTimeout: number = 30000; // 30 seconds
  private rotatingProxyFailureCount: number = 0;
  private maxRotatingProxyFailures: number = 3;
  private rotatingProxyDisabledUntil?: number;
  private healthMonitor?: RotatingProxyHealthMonitor;
  private healthMonitor?: RotatingProxyHealthMonitor;
  
  /**
   * Set the maximum number of proxy retries
   */
  public setMaxProxyRetries(retries: number): void {
    this.maxProxyRetries = retries;
  }

  /**
   * Set the rotating proxy health monitor
   */
  public setHealthMonitor(monitor: RotatingProxyHealthMonitor): void {
    this.healthMonitor = monitor;
  }

  /**
   * Set the health monitor for rotating proxy
   */
  public setHealthMonitor(healthMonitor: RotatingProxyHealthMonitor): void {
    this.healthMonitor = healthMonitor;
  }
  
  /**
   * Get the proxy URL to use for a request
   * Returns rotating proxy if configured and healthy, otherwise returns the API key's assigned proxy
   */
  private getProxyForRequest(apiKey: ApiKey): { proxyUrl?: string; isRotatingProxy: boolean } {
    // Check if rotating proxy is temporarily disabled due to failures
    if (this.rotatingProxyDisabledUntil && Date.now() < this.rotatingProxyDisabledUntil) {
      console.warn(`GoogleApiForwarder: Rotating proxy is temporarily disabled until ${new Date(this.rotatingProxyDisabledUntil).toISOString()}`);
      return { proxyUrl: apiKey.proxy, isRotatingProxy: false };
    }

    // If rotating proxy is configured and not disabled, use it
    if (config.USE_ROTATING_PROXY && config.ROTATING_PROXY) {
      console.log(`GoogleApiForwarder: Using rotating proxy for key ${apiKey.keyId}`);
      return { proxyUrl: config.ROTATING_PROXY, isRotatingProxy: true };
    }
    
    // Otherwise, use the individual proxy assigned to this API key
    return { proxyUrl: apiKey.proxy, isRotatingProxy: false };
  }

  /**
   * Handle rotating proxy failure and implement fallback logic
   */
  private async handleRotatingProxyFailure(error: unknown, responseTime?: number): Promise<void> {
    this.rotatingProxyFailureCount++;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`GoogleApiForwarder: Rotating proxy failure #${this.rotatingProxyFailureCount}:`, error);

    // Record failed request with health monitor
    if (this.healthMonitor) {
      await this.healthMonitor.recordRequest(false, responseTime, errorMessage);
    }

    if (this.rotatingProxyFailureCount >= this.maxRotatingProxyFailures) {
      // Temporarily disable rotating proxy for 5 minutes
      const disableDuration = 5 * 60 * 1000; // 5 minutes
      this.rotatingProxyDisabledUntil = Date.now() + disableDuration;
      
      console.error(`GoogleApiForwarder: Rotating proxy disabled for ${disableDuration / 1000} seconds due to ${this.rotatingProxyFailureCount} consecutive failures`);
      
      // Reset failure count
      this.rotatingProxyFailureCount = 0;
    }
  }

  /**
   * Reset rotating proxy failure count on successful request
   */
  private resetRotatingProxyFailures(): void {
    if (this.rotatingProxyFailureCount > 0) {
      console.log(`GoogleApiForwarder: Rotating proxy recovered, resetting failure count from ${this.rotatingProxyFailureCount} to 0`);
      this.rotatingProxyFailureCount = 0;
    }
    
    // Clear any temporary disable
    if (this.rotatingProxyDisabledUntil) {
      this.rotatingProxyDisabledUntil = undefined;
    }
  }
  
  /**
   * Create an appropriate proxy agent based on the proxy URL
   */
  private createProxyAgent(proxyUrl: string): import('https-proxy-agent').HttpsProxyAgent<string> | import('socks-proxy-agent').SocksProxyAgent | undefined {
    try {
      if (!proxyUrl) {
        return undefined;
      }
      
      const url = new URL(proxyUrl);
      
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return new HttpsProxyAgent(proxyUrl);
      } else if (url.protocol === 'socks:' || url.protocol === 'socks5:') {
        return new SocksProxyAgent(proxyUrl);
      } else {
        console.warn(`GoogleApiForwarder: Unsupported proxy protocol: ${url.protocol}`);
        return undefined;
      }
    } catch (error) {
      console.error('GoogleApiForwarder: Error creating proxy agent:', error);
      return undefined;
    }
  }
  
  /**
   * Check if an error is likely caused by a proxy issue
   */
  private isProxyError(error: unknown): boolean {
    if (!error) {
      return false;
    }
    
    // Common proxy error patterns
    const proxyErrorPatterns = [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ECONNRESET',
      'socket hang up',
      'proxy',
      'tunnel',
      'unable to verify the first certificate',
      'certificate has expired',
      'certificate is not trusted',
      'unable to get local issuer certificate',
      'self signed certificate',
      'proxy authentication required'
    ];
    
    const errorString = error.toString().toLowerCase();
    return proxyErrorPatterns.some(pattern => errorString.includes(pattern.toLowerCase()));
  }

  /**
   * Forward a request to the Google API with proxy support and error handling
   */
  async forwardRequest(
    modelId: string, 
    methodName: string, 
    requestBody: { contents?: unknown; config?: unknown } | unknown, 
    apiKey: ApiKey,
    retryCount: number = 0
  ): Promise<{ response?: unknown, stream?: AsyncIterable<unknown>, error?: GoogleApiError }> {
    // Get the proxy to use for this request (rotating or individual)
    const { proxyUrl, isRotatingProxy } = this.getProxyForRequest(apiKey);
    const agent = proxyUrl ? this.createProxyAgent(proxyUrl) : undefined;
    
    // Log proxy usage
    if (proxyUrl) {
      const proxyType = isRotatingProxy ? 'rotating proxy' : 'individual proxy';
      console.log(`GoogleApiForwarder: Using ${proxyType} ${proxyUrl} for key ${apiKey.keyId}`);
    } else {
      console.log(`GoogleApiForwarder: No proxy used for key ${apiKey.keyId}`);
    }
    
    // Initialize GoogleGenAI with proxy support
    const httpOptions = agent ? { agent, timeout: this.requestTimeout } : { timeout: this.requestTimeout };
    const ai = new GoogleGenAI({
      apiKey: apiKey.key,
      httpOptions: httpOptions
    });

    const requestStartTime = Date.now();

    try {
      let result;
      if (methodName === 'generateContent') {
        // 处理非流式请求 - 使用新的 @google/genai SDK API
        const body = requestBody as { contents?: unknown; config?: unknown };
        result = await ai.models.generateContent({
          model: modelId,
          contents: (body.contents || requestBody) as any,
          config: body.config || {}
        });
        console.info(`GoogleApiForwarder: 转发非流式请求到模型 ${modelId} 使用 Key ${apiKey.key}`);
        
        // Record successful request
        const responseTime = Date.now() - requestStartTime;
        if (isRotatingProxy && this.healthMonitor) {
          this.healthMonitor.recordRequest(true, responseTime);
          this.resetRotatingProxyFailures();
        }
        
        return { response: result };
      } else if (methodName === 'streamGenerateContent') {
        // 处理流式请求 - 使用新的 @google/genai SDK API
        const body = requestBody as { contents?: unknown; config?: unknown };
        result = await ai.models.generateContentStream({
          model: modelId,
          contents: (body.contents || requestBody) as any,
          config: body.config || {}
        });
        console.info(`GoogleApiForwarder: 转发流式请求到模型 ${modelId} 使用 Key ${apiKey.key}`);
        
        // Record successful request
        const responseTime = Date.now() - requestStartTime;
        if (isRotatingProxy && this.healthMonitor) {
          this.healthMonitor.recordRequest(true, responseTime);
          this.resetRotatingProxyFailures();
        }
        
        return { stream: result };
      } else {
        // 理论上这部分代码不会被执行，因为 ProxyRoute 已经做了方法名验证
        // 但作为防御性编程，保留此处的错误处理
        const unsupportedMethodError = new GoogleApiError(
          `Unsupported API method: ${methodName}`,
          400, // Bad Request
          apiKey.key,
          false
        );
        console.error(`GoogleApiForwarder: 不支持的 API 方法 (${apiKey.key}):`, methodName);
        return { error: unsupportedMethodError };
      }

    } catch (error: unknown) {
      console.error(`GoogleApiForwarder: 调用 Google API 时发生错误 (${apiKey.key}):`, JSON.stringify(error));

      // 尝试识别速率限制错误 (HTTP 429) 或其他 Google API 错误
      const statusCode = (error as any).response?.status || (error as any).statusCode;
      const isRateLimit = statusCode === 429; // Google API 返回 429 表示速率限制
      const isProxyError = this.isProxyError(error);
      
      // Handle proxy errors with appropriate fallback logic
      if (isProxyError && proxyUrl && retryCount < this.maxProxyRetries) {
        console.warn(`GoogleApiForwarder: Proxy error detected for key ${apiKey.keyId}`);
        
        if (isRotatingProxy) {
          // Handle rotating proxy failure
          const responseTime = Date.now() - requestStartTime;
          await this.handleRotatingProxyFailure(error, responseTime);
          
          // Try to fallback to individual proxy if available
          if (apiKey.proxy && apiKey.proxy !== proxyUrl) {
            console.log(`GoogleApiForwarder: Falling back to individual proxy for key ${apiKey.keyId}`);
            const apiKeyWithIndividualProxy: ApiKey = {
              ...apiKey,
              useRotatingProxy: false
            };
            return this.forwardRequest(modelId, methodName, requestBody, apiKeyWithIndividualProxy, retryCount + 1);
          } else {
            // Try without any proxy as last resort
            console.log(`GoogleApiForwarder: Falling back to direct connection for key ${apiKey.keyId}`);
            const apiKeyWithoutProxy: ApiKey = {
              ...apiKey,
              proxy: undefined,
              useRotatingProxy: false
            };
            return this.forwardRequest(modelId, methodName, requestBody, apiKeyWithoutProxy, retryCount + 1);
          }
        } else {
          // For individual proxy, create a copy of the API key without the proxy
          const apiKeyWithoutProxy: ApiKey = {
            ...apiKey,
            proxy: undefined
          };
          
          // Retry the request without proxy
          return this.forwardRequest(modelId, methodName, requestBody, apiKeyWithoutProxy, retryCount + 1);
        }
      }

      // Record failed request and handle rotating proxy failure tracking
      const responseTime = Date.now() - requestStartTime;
      if (isRotatingProxy) {
        if (isProxyError) {
          await this.handleRotatingProxyFailure(error, responseTime);
        } else if (this.healthMonitor) {
          // Record non-proxy errors
          const errorMessage = error instanceof Error ? error.message : String(error);
          await this.healthMonitor.recordRequest(false, responseTime, errorMessage);
        }
      }

      // Create enhanced error message for rotating proxy
      let errorMessage = `Google API Error: ${(error as any).message || 'Unknown error'}`;
      if (isRotatingProxy && isProxyError) {
        errorMessage = `Rotating Proxy Error: ${errorMessage}. Failure count: ${this.rotatingProxyFailureCount}/${this.maxRotatingProxyFailures}`;
        if (this.rotatingProxyDisabledUntil) {
          errorMessage += `. Rotating proxy temporarily disabled until ${new Date(this.rotatingProxyDisabledUntil).toISOString()}`;
        }
      }

      // 创建自定义错误对象，包含 Key 信息和是否为速率限制错误
      const googleApiError = new GoogleApiError(
        errorMessage,
        statusCode,
        apiKey.key,
        isRateLimit,
        isProxyError,
        proxyUrl
      );

      return { error: googleApiError };
    }
  }
}

export default GoogleApiForwarder;