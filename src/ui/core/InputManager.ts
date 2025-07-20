import * as vscode from 'vscode';

/**
 * Interface for proxy configuration input
 */
export interface ProxyConfig {
  url: string;
  username?: string;
  password?: string;
  type: 'http' | 'https' | 'socks4' | 'socks5';
}

/**
 * Manages user input and dialog interactions for the extension
 */
export class InputManager {
  /**
   * Prompt user for API key with validation
   */
  public async promptForApiKey(): Promise<string | undefined> {
    const apiKey = await vscode.window.showInputBox({
      prompt: 'Enter your Google Gemini API Key',
      placeHolder: 'AIza...',
      password: true,
      validateInput: (value: string) => {
        if (!value || value.trim().length === 0) {
          return 'API key cannot be empty';
        }
        
        if (!value.startsWith('AIza')) {
          return 'Google Gemini API keys typically start with "AIza"';
        }
        
        if (value.length < 20) {
          return 'API key appears to be too short';
        }
        
        if (value.length > 100) {
          return 'API key appears to be too long';
        }
        
        // Check for invalid characters
        if (!/^[A-Za-z0-9_-]+$/.test(value)) {
          return 'API key contains invalid characters';
        }
        
        return undefined;
      }
    });
    
    return apiKey?.trim();
  }

  /**
   * Prompt user for proxy configuration with structured input collection
   */
  public async promptForProxyConfig(): Promise<ProxyConfig | undefined> {
    // Step 1: Get proxy URL
    const url = await vscode.window.showInputBox({
      prompt: 'Enter proxy URL (e.g., http://proxy.example.com:8080)',
      placeHolder: 'http://proxy.example.com:8080',
      validateInput: (value: string) => {
        if (!value || value.trim().length === 0) {
          return 'Proxy URL cannot be empty';
        }
        
        try {
          const parsedUrl = new URL(value);
          if (!['http:', 'https:', 'socks4:', 'socks5:'].includes(parsedUrl.protocol)) {
            return 'Proxy URL must use http, https, socks4, or socks5 protocol';
          }
          
          if (!parsedUrl.hostname) {
            return 'Proxy URL must include a hostname';
          }
          
          return undefined;
        } catch (error) {
          return 'Invalid URL format';
        }
      }
    });
    
    if (!url) {
      return undefined;
    }
    
    const parsedUrl = new URL(url);
    const proxyType = parsedUrl.protocol.slice(0, -1) as 'http' | 'https' | 'socks4' | 'socks5';
    
    // Step 2: Ask if authentication is required
    const needsAuth = await vscode.window.showQuickPick(
      [
        { label: 'No Authentication', description: 'Proxy does not require credentials', value: false },
        { label: 'Username/Password', description: 'Proxy requires authentication', value: true }
      ],
      {
        placeHolder: 'Does this proxy require authentication?',
        canPickMany: false
      }
    );
    
    if (needsAuth === undefined) {
      return undefined;
    }
    
    let username: string | undefined;
    let password: string | undefined;
    
    // Step 3: Get credentials if needed
    if (needsAuth.value) {
      username = await vscode.window.showInputBox({
        prompt: 'Enter proxy username',
        placeHolder: 'username',
        validateInput: (value: string) => {
          if (!value || value.trim().length === 0) {
            return 'Username cannot be empty';
          }
          return undefined;
        }
      });
      
      if (!username) {
        return undefined;
      }
      
      password = await vscode.window.showInputBox({
        prompt: 'Enter proxy password',
        placeHolder: 'password',
        password: true,
        validateInput: (value: string) => {
          if (!value || value.trim().length === 0) {
            return 'Password cannot be empty';
          }
          return undefined;
        }
      });
      
      if (!password) {
        return undefined;
      }
    }
    
    return {
      url: url.trim(),
      username: username?.trim(),
      password: password?.trim(),
      type: proxyType
    };
  }

  /**
   * Show confirmation dialog for deletion operations
   */
  public async confirmDeletion(itemName: string, itemType: string = 'item'): Promise<boolean> {
    const result = await vscode.window.showWarningMessage(
      `Are you sure you want to delete ${itemType} "${itemName}"?`,
      { modal: true },
      'Delete',
      'Cancel'
    );
    
    return result === 'Delete';
  }

  /**
   * Show selection dialog using QuickPick interface
   */
  public async selectFromList<T>(
    items: T[],
    options: {
      placeHolder: string;
      canPickMany?: boolean;
      labelProperty?: keyof T;
      descriptionProperty?: keyof T;
      detailProperty?: keyof T;
    }
  ): Promise<T | T[] | undefined> {
    if (items.length === 0) {
      vscode.window.showInformationMessage('No items available to select from');
      return undefined;
    }
    
    const quickPickItems = items.map(item => ({
      label: options.labelProperty ? String(item[options.labelProperty]) : String(item),
      description: options.descriptionProperty ? String(item[options.descriptionProperty]) : undefined,
      detail: options.detailProperty ? String(item[options.detailProperty]) : undefined,
      item: item
    }));
    
    if (options.canPickMany) {
      const selected = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: options.placeHolder,
        canPickMany: true
      });
      
      return selected?.map(s => s.item);
    } else {
      const selected = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: options.placeHolder,
        canPickMany: false
      });
      
      return selected?.item;
    }
  }

  /**
   * Validate API key format
   */
  public validateApiKey(apiKey: string): string | undefined {
    if (!apiKey || apiKey.trim().length === 0) {
      return 'API key cannot be empty';
    }
    
    const trimmed = apiKey.trim();
    
    if (!trimmed.startsWith('AIza')) {
      return 'Google Gemini API keys typically start with "AIza"';
    }
    
    if (trimmed.length < 20) {
      return 'API key appears to be too short';
    }
    
    if (trimmed.length > 100) {
      return 'API key appears to be too long';
    }
    
    if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
      return 'API key contains invalid characters';
    }
    
    return undefined;
  }

  /**
   * Validate proxy URL format
   */
  public validateProxyUrl(url: string): string | undefined {
    if (!url || url.trim().length === 0) {
      return 'Proxy URL cannot be empty';
    }
    
    try {
      const parsedUrl = new URL(url.trim());
      
      if (!['http:', 'https:', 'socks4:', 'socks5:'].includes(parsedUrl.protocol)) {
        return 'Proxy URL must use http, https, socks4, or socks5 protocol';
      }
      
      if (!parsedUrl.hostname) {
        return 'Proxy URL must include a hostname';
      }
      
      // Check for reasonable port range
      if (parsedUrl.port) {
        const portNum = parseInt(parsedUrl.port);
        if (portNum < 1 || portNum > 65535) {
          return 'Port number must be between 1 and 65535';
        }
      }
      
      return undefined;
    } catch (error) {
      return 'Invalid URL format';
    }
  }
}

/**
 * Global input manager instance
 */
export const inputManager = new InputManager();