import * as vscode from 'vscode';
import { ProxyConfig } from './InputManager';

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
  suggestions?: string[];
}

/**
 * Service for comprehensive input validation and error handling
 */
export class ValidationService {
  private static instance: ValidationService;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): ValidationService {
    if (!ValidationService.instance) {
      ValidationService.instance = new ValidationService();
    }
    return ValidationService.instance;
  }

  /**
   * Comprehensive API key validation
   */
  public validateApiKey(apiKey: string): ValidationResult {
    if (!apiKey || apiKey.trim().length === 0) {
      return {
        isValid: false,
        error: 'API key cannot be empty',
        suggestions: ['Enter a valid Google Gemini API key starting with "AIza"']
      };
    }

    const trimmed = apiKey.trim();
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check format
    if (!trimmed.startsWith('AIza')) {
      return {
        isValid: false,
        error: 'Google Gemini API keys must start with "AIza"',
        suggestions: [
          'Verify you copied the correct API key from Google AI Studio',
          'Make sure you\'re using a Gemini API key, not a different Google service key'
        ]
      };
    }

    // Check length
    if (trimmed.length < 20) {
      return {
        isValid: false,
        error: 'API key appears to be too short',
        suggestions: ['API keys are typically 39+ characters long']
      };
    }

    if (trimmed.length > 100) {
      return {
        isValid: false,
        error: 'API key appears to be too long',
        suggestions: ['Verify you copied only the API key without extra characters']
      };
    }

    // Check for invalid characters
    if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
      return {
        isValid: false,
        error: 'API key contains invalid characters',
        suggestions: [
          'API keys should only contain letters, numbers, underscores, and hyphens',
          'Check for spaces or special characters that may have been copied accidentally'
        ]
      };
    }

    // Check for common mistakes
    if (trimmed.includes(' ')) {
      warnings.push('API key contains spaces - they will be removed');
    }

    if (trimmed.length < 35) {
      warnings.push('API key is shorter than typical - verify it\'s complete');
    }

    return {
      isValid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
      suggestions: suggestions.length > 0 ? suggestions : undefined
    };
  }

  /**
   * Comprehensive proxy configuration validation
   */
  public validateProxyConfig(config: ProxyConfig): ValidationResult {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Validate URL
    const urlValidation = this.validateProxyUrl(config.url);
    if (!urlValidation.isValid) {
      return urlValidation;
    }

    try {
      const parsedUrl = new URL(config.url);

      // Check protocol consistency
      if (config.type !== parsedUrl.protocol.slice(0, -1)) {
        warnings.push(`Protocol mismatch: URL uses ${parsedUrl.protocol} but type is set to ${config.type}`);
      }

      // Check for authentication consistency
      if ((config.username || config.password) && (!config.username || !config.password)) {
        return {
          isValid: false,
          error: 'Both username and password are required for authenticated proxies',
          suggestions: ['Provide both username and password, or remove authentication']
        };
      }

      // Check for common proxy ports
      const port = parsedUrl.port ? parseInt(parsedUrl.port) : (parsedUrl.protocol === 'https:' ? 443 : 80);
      const commonPorts = [80, 443, 1080, 3128, 8080, 8888, 9050];
      
      if (!commonPorts.includes(port)) {
        warnings.push(`Port ${port} is not a common proxy port`);
        suggestions.push('Common proxy ports are: 80, 443, 1080, 3128, 8080, 8888, 9050');
      }

      // SOCKS-specific validation
      if (config.type.startsWith('socks')) {
        if (parsedUrl.protocol !== 'socks4:' && parsedUrl.protocol !== 'socks5:') {
          warnings.push('SOCKS proxies typically use socks4:// or socks5:// protocol in the URL');
        }

        if (config.type === 'socks4' && (config.username || config.password)) {
          warnings.push('SOCKS4 does not support username/password authentication');
          suggestions.push('Use SOCKS5 for authenticated connections');
        }
      }

      // HTTP/HTTPS specific validation
      if (config.type === 'https' && parsedUrl.protocol === 'http:') {
        warnings.push('Using HTTP URL for HTTPS proxy type');
        suggestions.push('Consider using https:// URL for secure connections');
      }

    } catch (error) {
      return {
        isValid: false,
        error: 'Invalid proxy URL format',
        suggestions: ['Use format: protocol://hostname:port (e.g., http://proxy.example.com:8080)']
      };
    }

    return {
      isValid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
      suggestions: suggestions.length > 0 ? suggestions : undefined
    };
  }

  /**
   * Validate proxy URL format
   */
  public validateProxyUrl(url: string): ValidationResult {
    if (!url || url.trim().length === 0) {
      return {
        isValid: false,
        error: 'Proxy URL cannot be empty',
        suggestions: ['Enter a valid proxy URL (e.g., http://proxy.example.com:8080)']
      };
    }

    const trimmed = url.trim();

    try {
      const parsedUrl = new URL(trimmed);

      // Check protocol
      const validProtocols = ['http:', 'https:', 'socks4:', 'socks5:'];
      if (!validProtocols.includes(parsedUrl.protocol)) {
        return {
          isValid: false,
          error: `Unsupported protocol: ${parsedUrl.protocol}`,
          suggestions: ['Supported protocols: http, https, socks4, socks5']
        };
      }

      // Check hostname
      if (!parsedUrl.hostname) {
        return {
          isValid: false,
          error: 'Proxy URL must include a hostname',
          suggestions: ['Use format: protocol://hostname:port']
        };
      }

      // Validate hostname format
      if (!/^[a-zA-Z0-9.-]+$/.test(parsedUrl.hostname)) {
        return {
          isValid: false,
          error: 'Invalid hostname format',
          suggestions: ['Hostname should contain only letters, numbers, dots, and hyphens']
        };
      }

      // Check port
      if (parsedUrl.port) {
        const portNum = parseInt(parsedUrl.port);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
          return {
            isValid: false,
            error: 'Port number must be between 1 and 65535',
            suggestions: ['Common proxy ports: 80, 443, 1080, 3128, 8080, 8888']
          };
        }
      }

      // Check for localhost/private IPs (warnings)
      const warnings: string[] = [];
      if (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1') {
        warnings.push('Using localhost proxy - ensure the proxy server is running locally');
      }

      if (parsedUrl.hostname.startsWith('192.168.') || parsedUrl.hostname.startsWith('10.') || parsedUrl.hostname.startsWith('172.')) {
        warnings.push('Using private IP address - ensure the proxy is accessible from your network');
      }

      return {
        isValid: true,
        warnings: warnings.length > 0 ? warnings : undefined
      };

    } catch (error) {
      return {
        isValid: false,
        error: 'Invalid URL format',
        suggestions: [
          'Use format: protocol://hostname:port',
          'Example: http://proxy.example.com:8080',
          'Example: socks5://proxy.example.com:1080'
        ]
      };
    }
  }

  /**
   * Show validation result to user with appropriate UI feedback
   */
  public async showValidationResult(result: ValidationResult, context: string): Promise<void> {
    if (!result.isValid) {
      // Show error with suggestions
      const actions = result.suggestions ? ['Show Help', 'Dismiss'] : ['Dismiss'];
      const selection = await vscode.window.showErrorMessage(
        `${context}: ${result.error}`,
        ...actions
      );

      if (selection === 'Show Help' && result.suggestions) {
        const helpMessage = result.suggestions.join('\n• ');
        vscode.window.showInformationMessage(
          `Help for ${context}:\n• ${helpMessage}`,
          'OK'
        );
      }
    } else if (result.warnings && result.warnings.length > 0) {
      // Show warnings
      const warningMessage = result.warnings.join('\n• ');
      const actions = result.suggestions ? ['Show Suggestions', 'Continue'] : ['Continue'];
      
      const selection = await vscode.window.showWarningMessage(
        `${context} - Warnings:\n• ${warningMessage}`,
        ...actions
      );

      if (selection === 'Show Suggestions' && result.suggestions) {
        const suggestionMessage = result.suggestions.join('\n• ');
        vscode.window.showInformationMessage(
          `Suggestions for ${context}:\n• ${suggestionMessage}`,
          'OK'
        );
      }
    }
  }

  /**
   * Validate multiple API keys at once
   */
  public validateApiKeys(apiKeys: string[]): { valid: string[]; invalid: Array<{ key: string; error: string }> } {
    const valid: string[] = [];
    const invalid: Array<{ key: string; error: string }> = [];

    for (const key of apiKeys) {
      const result = this.validateApiKey(key);
      if (result.isValid) {
        valid.push(key);
      } else {
        invalid.push({ key, error: result.error || 'Unknown validation error' });
      }
    }

    return { valid, invalid };
  }

  /**
   * Create user-friendly error messages
   */
  public createUserFriendlyError(error: Error, context: string): string {
    const errorMessage = error.message.toLowerCase();

    // Network-related errors
    if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      return `${context}: Network connection failed. Please check your internet connection and proxy settings.`;
    }

    // Authentication errors
    if (errorMessage.includes('auth') || errorMessage.includes('unauthorized') || errorMessage.includes('403')) {
      return `${context}: Authentication failed. Please verify your API key or proxy credentials.`;
    }

    // Rate limiting errors
    if (errorMessage.includes('rate') || errorMessage.includes('quota') || errorMessage.includes('429')) {
      return `${context}: Rate limit exceeded. Please wait before trying again or add more API keys.`;
    }

    // Timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return `${context}: Request timed out. The service may be slow or unavailable.`;
    }

    // Proxy errors
    if (errorMessage.includes('proxy')) {
      return `${context}: Proxy connection failed. Please check your proxy configuration.`;
    }

    // Generic error with context
    return `${context}: ${error.message}`;
  }

  /**
   * Suggest fixes for common errors
   */
  public suggestFixes(error: Error): string[] {
    const errorMessage = error.message.toLowerCase();
    const suggestions: string[] = [];

    if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      suggestions.push('Check your internet connection');
      suggestions.push('Verify proxy settings if using a proxy');
      suggestions.push('Try again in a few moments');
    }

    if (errorMessage.includes('auth') || errorMessage.includes('unauthorized')) {
      suggestions.push('Verify your API key is correct and active');
      suggestions.push('Check if your API key has the required permissions');
      suggestions.push('Generate a new API key if the current one is expired');
    }

    if (errorMessage.includes('rate') || errorMessage.includes('quota')) {
      suggestions.push('Wait before making more requests');
      suggestions.push('Add additional API keys to distribute load');
      suggestions.push('Check your API usage in Google AI Studio');
    }

    if (errorMessage.includes('proxy')) {
      suggestions.push('Test proxy connection independently');
      suggestions.push('Verify proxy credentials');
      suggestions.push('Try a different proxy server');
      suggestions.push('Disable proxy temporarily to test direct connection');
    }

    return suggestions;
  }
}

/**
 * Global validation service instance
 */
export const validationService = ValidationService.getInstance();