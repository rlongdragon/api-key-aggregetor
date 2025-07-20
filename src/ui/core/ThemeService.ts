import * as vscode from 'vscode';

/**
 * Service for managing theme integration and high contrast support
 */
export class ThemeService {
  private static instance: ThemeService;
  private currentTheme: 'light' | 'dark' | 'high-contrast' = 'dark';
  private disposables: vscode.Disposable[] = [];
  private themeChangeListeners: ((theme: vscode.ColorTheme) => void)[] = [];

  private constructor() {
    this.detectCurrentTheme();
    this.setupThemeChangeListener();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ThemeService {
    if (!ThemeService.instance) {
      ThemeService.instance = new ThemeService();
    }
    return ThemeService.instance;
  }

  /**
   * Detect current VS Code theme
   */
  private detectCurrentTheme(): void {
    const colorTheme = vscode.window.activeColorTheme;

    // Detect high contrast themes
    if (colorTheme.kind === vscode.ColorThemeKind.HighContrast ||
      colorTheme.kind === vscode.ColorThemeKind.HighContrastLight) {
      this.currentTheme = 'high-contrast';
    } else if (colorTheme.kind === vscode.ColorThemeKind.Light) {
      this.currentTheme = 'light';
    } else {
      this.currentTheme = 'dark';
    }
  }

  /**
   * Set up listener for theme changes
   */
  private setupThemeChangeListener(): void {
    const disposable = vscode.window.onDidChangeActiveColorTheme((theme) => {
      try {
        this.detectCurrentTheme();
        this.notifyThemeChangeListeners(theme);
      } catch (error) {
        console.error('ThemeService: Error in theme change listener:', error);
      }
    });

    this.disposables.push(disposable);
  }

  /**
   * Notify all theme change listeners
   */
  private notifyThemeChangeListeners(theme: vscode.ColorTheme): void {
    this.themeChangeListeners.forEach(listener => {
      try {
        listener(theme);
      } catch (error) {
        console.error('ThemeService: Error in theme change listener callback:', error);
      }
    });
  }

  /**
   * Register a theme change listener
   */
  public onThemeChange(listener: (theme: vscode.ColorTheme) => void): vscode.Disposable {
    this.themeChangeListeners.push(listener);

    // Call immediately with current theme
    listener(vscode.window.activeColorTheme);

    return {
      dispose: () => {
        const index = this.themeChangeListeners.indexOf(listener);
        if (index >= 0) {
          this.themeChangeListeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Get current theme information
   */
  public getCurrentTheme(): vscode.ColorTheme {
    return vscode.window.activeColorTheme;
  }

  /**
   * Check if current theme is high contrast
   */
  public isHighContrast(): boolean {
    const theme = vscode.window.activeColorTheme;
    return theme.kind === vscode.ColorThemeKind.HighContrast ||
      theme.kind === vscode.ColorThemeKind.HighContrastLight;
  }

  /**
   * Check if current theme is dark
   */
  public isDarkTheme(): boolean {
    const theme = vscode.window.activeColorTheme;
    return theme.kind === vscode.ColorThemeKind.Dark ||
      theme.kind === vscode.ColorThemeKind.HighContrast;
  }

  /**
   * Check if current theme is light
   */
  public isLightTheme(): boolean {
    const theme = vscode.window.activeColorTheme;
    return theme.kind === vscode.ColorThemeKind.Light ||
      theme.kind === vscode.ColorThemeKind.HighContrastLight;
  }

  /**
   * Get theme-appropriate colors for different states
   */
  public getStateColors() {
    const isHighContrast = this.isHighContrast();

    return {
      success: isHighContrast
        ? new vscode.ThemeColor('contrastBorder')
        : new vscode.ThemeColor('charts.green'),

      warning: isHighContrast
        ? new vscode.ThemeColor('contrastBorder')
        : new vscode.ThemeColor('charts.yellow'),

      error: isHighContrast
        ? new vscode.ThemeColor('contrastBorder')
        : new vscode.ThemeColor('charts.red'),

      info: isHighContrast
        ? new vscode.ThemeColor('contrastBorder')
        : new vscode.ThemeColor('charts.blue'),

      inactive: isHighContrast
        ? new vscode.ThemeColor('contrastBorder')
        : new vscode.ThemeColor('charts.gray'),

      // Status bar colors
      statusBarBackground: isHighContrast
        ? new vscode.ThemeColor('statusBar.background')
        : undefined,

      statusBarForeground: isHighContrast
        ? new vscode.ThemeColor('statusBar.foreground')
        : undefined,

      // High contrast specific colors
      border: isHighContrast
        ? new vscode.ThemeColor('contrastBorder')
        : new vscode.ThemeColor('panel.border'),

      activeBorder: isHighContrast
        ? new vscode.ThemeColor('contrastActiveBorder')
        : new vscode.ThemeColor('focusBorder')
    };
  }

  /**
   * Get theme-appropriate icons for different states
   */
  public getStateIcons() {
    const colors = this.getStateColors();

    return {
      // API Key icons with theme-appropriate colors
      apiKey: {
        active: new vscode.ThemeIcon('key', colors.success),
        inactive: new vscode.ThemeIcon('key', colors.inactive),
        error: new vscode.ThemeIcon('key', colors.error),
        rateLimited: new vscode.ThemeIcon('key', colors.warning)
      },

      // Proxy icons with theme-appropriate colors
      proxy: {
        active: new vscode.ThemeIcon('globe', colors.success),
        inactive: new vscode.ThemeIcon('globe', colors.inactive),
        error: new vscode.ThemeIcon('globe', colors.error),
        checking: new vscode.ThemeIcon('sync~spin', colors.info)
      },

      // Server icons with theme-appropriate colors
      server: {
        running: new vscode.ThemeIcon('server-process', colors.success),
        stopped: new vscode.ThemeIcon('server-process', colors.inactive),
        error: new vscode.ThemeIcon('server-process', colors.error)
      },

      // General purpose icons
      group: new vscode.ThemeIcon('folder'),
      rotatingProxy: new vscode.ThemeIcon('sync', colors.info),
      refresh: new vscode.ThemeIcon('refresh'),
      settings: new vscode.ThemeIcon('settings-gear'),
      add: new vscode.ThemeIcon('add'),
      remove: new vscode.ThemeIcon('remove'),
      test: new vscode.ThemeIcon('beaker'),
      details: new vscode.ThemeIcon('info')
    };
  }

  /**
   * Get CSS styles for webview content that adapt to theme
   */
  public getWebviewStyles(): string {
    const isHighContrast = this.isHighContrast();

    return `
      <style>
        body {
          font-family: var(--vscode-font-family);
          font-size: var(--vscode-font-size);
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
          line-height: 1.6;
          ${isHighContrast ? 'border: 1px solid var(--vscode-contrastBorder);' : ''}
        }
        
        .header {
          border-bottom: 1px solid var(--vscode-panel-border);
          padding-bottom: 15px;
          margin-bottom: 20px;
          ${isHighContrast ? 'border-bottom-width: 2px;' : ''}
        }
        
        .section {
          margin-bottom: 25px;
          ${isHighContrast ? 'border: 1px solid var(--vscode-contrastBorder); padding: 10px;' : ''}
        }
        
        .section h3 {
          color: var(--vscode-textLink-foreground);
          margin-bottom: 10px;
          ${isHighContrast ? 'text-decoration: underline;' : ''}
        }
        
        .info-grid {
          display: grid;
          grid-template-columns: 200px 1fr;
          gap: 10px;
          margin-bottom: 15px;
        }
        
        .info-label {
          font-weight: bold;
          color: var(--vscode-descriptionForeground);
          ${isHighContrast ? 'text-decoration: underline;' : ''}
        }
        
        .status-running { 
          color: var(--vscode-charts-green); 
          ${isHighContrast ? 'font-weight: bold; text-decoration: underline;' : ''}
        }
        
        .status-stopped { 
          color: var(--vscode-charts-red); 
          ${isHighContrast ? 'font-weight: bold; text-decoration: underline;' : ''}
        }
        
        .status-active { 
          color: var(--vscode-charts-green); 
          ${isHighContrast ? 'font-weight: bold;' : ''}
        }
        
        .status-error { 
          color: var(--vscode-charts-red); 
          ${isHighContrast ? 'font-weight: bold; text-decoration: underline;' : ''}
        }
        
        .status-inactive { 
          color: var(--vscode-charts-gray); 
          ${isHighContrast ? 'font-weight: bold;' : ''}
        }
        
        .stats-box {
          background-color: var(--vscode-textBlockQuote-background);
          padding: 15px;
          border-radius: 5px;
          margin: 10px 0;
          ${isHighContrast ? 'border: 2px solid var(--vscode-contrastBorder);' : ''}
        }
        
        .stats-row {
          display: flex;
          justify-content: space-between;
          margin: 5px 0;
          ${isHighContrast ? 'border-bottom: 1px solid var(--vscode-contrastBorder); padding-bottom: 5px;' : ''}
        }
        
        .warning {
          color: var(--vscode-charts-yellow);
          ${isHighContrast ? 'font-weight: bold; background-color: var(--vscode-inputValidation-warningBackground);' : ''}
        }
        
        .error {
          color: var(--vscode-charts-red);
          ${isHighContrast ? 'font-weight: bold; background-color: var(--vscode-inputValidation-errorBackground);' : ''}
        }
        
        .success {
          color: var(--vscode-charts-green);
          ${isHighContrast ? 'font-weight: bold;' : ''}
        }
        
        /* High contrast specific improvements */
        ${isHighContrast ? `
          .clickable {
            border: 2px solid var(--vscode-contrastActiveBorder);
            padding: 2px 4px;
          }
          
          .clickable:hover {
            background-color: var(--vscode-list-hoverBackground);
          }
          
          .important {
            text-decoration: underline;
            font-weight: bold;
          }
          
          .separator {
            border-top: 2px solid var(--vscode-contrastBorder);
            margin: 10px 0;
          }
        ` : ''}
      </style>
    `;
  }

  /**
   * Get theme kind name for logging
   */
  private getThemeKindName(kind: vscode.ColorThemeKind): string {
    switch (kind) {
      case vscode.ColorThemeKind.Light:
        return 'Light';
      case vscode.ColorThemeKind.Dark:
        return 'Dark';
      case vscode.ColorThemeKind.HighContrast:
        return 'High Contrast Dark';
      case vscode.ColorThemeKind.HighContrastLight:
        return 'High Contrast Light';
      default:
        return 'Unknown';
    }
  }

  /**
   * Apply theme-aware styling to status bar items
   */
  public applyStatusBarTheme(statusBarItem: vscode.StatusBarItem, state: 'success' | 'warning' | 'error' | 'info' | 'inactive'): void {
    const colors = this.getStateColors();
    const isHighContrast = this.isHighContrast();

    // Reset colors first
    statusBarItem.backgroundColor = undefined;
    statusBarItem.color = undefined;

    switch (state) {
      case 'success':
        statusBarItem.color = colors.success;
        break;
      case 'warning':
        statusBarItem.backgroundColor = isHighContrast
          ? new vscode.ThemeColor('statusBarItem.warningBackground')
          : new vscode.ThemeColor('statusBarItem.warningBackground');
        statusBarItem.color = isHighContrast
          ? new vscode.ThemeColor('statusBarItem.warningForeground')
          : new vscode.ThemeColor('statusBarItem.warningForeground');
        break;
      case 'error':
        statusBarItem.backgroundColor = isHighContrast
          ? new vscode.ThemeColor('statusBarItem.errorBackground')
          : new vscode.ThemeColor('statusBarItem.errorBackground');
        statusBarItem.color = isHighContrast
          ? new vscode.ThemeColor('statusBarItem.errorForeground')
          : new vscode.ThemeColor('statusBarItem.errorForeground');
        break;
      case 'info':
        statusBarItem.color = colors.info;
        break;
      case 'inactive':
        statusBarItem.color = colors.inactive;
        break;
    }
  }

  /**
   * Get accessibility-friendly description for theme state
   */
  public getAccessibilityDescription(state: string, context: string): string {
    const isHighContrast = this.isHighContrast();
    const themeType = this.getThemeKindName(this.getCurrentTheme().kind);

    let description = `${context} is ${state}`;

    if (isHighContrast) {
      description += ` (High contrast mode active)`;
    }

    return description;
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    this.themeChangeListeners = [];
  }
}

/**
 * Global theme service instance
 */
export const themeService = ThemeService.getInstance();