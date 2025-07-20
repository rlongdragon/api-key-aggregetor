import * as vscode from 'vscode';
import { CoreIntegrationService } from '../core/CoreIntegrationService';
import { inputManager } from '../core/InputManager';
import { validationService } from '../core/ValidationService';
import { uiStateManager } from '../core/UIStateManager';
import { themeService } from '../core/ThemeService';
import { DataTransformers } from '../utils/DataTransformers';
import { ApiKey } from '../../server/types/ApiKey';
import ApiKeyManager from '../../server/core/ApiKeyManager';

/**
 * Commands for API Key management
 */
export class ApiKeyCommands {
    private coreIntegration?: CoreIntegrationService;
    private disposables: vscode.Disposable[] = [];

    constructor(coreIntegration?: CoreIntegrationService) {
        this.coreIntegration = coreIntegration;
    }

    /**
     * Register all API key commands
     */
    public registerCommands(context: vscode.ExtensionContext): void {
        // Register add API key command
        const addApiKeyCommand = vscode.commands.registerCommand(
            'geminiAggregator.addApiKey',
            () => this.addApiKey()
        );

        // Register remove API key command
        const removeApiKeyCommand = vscode.commands.registerCommand(
            'geminiAggregator.removeApiKey',
            (keyId?: string) => this.removeApiKey(keyId)
        );

        // Register view API key details command
        const viewApiKeyDetailsCommand = vscode.commands.registerCommand(
            'geminiAggregator.viewApiKeyDetails',
            (keyId?: string) => this.viewApiKeyDetails(keyId)
        );

        // Register test API key command
        const testApiKeyCommand = vscode.commands.registerCommand(
            'geminiAggregator.testApiKey',
            (keyId?: string) => this.testApiKey(keyId)
        );

        // Register refresh API keys command
        const refreshApiKeysCommand = vscode.commands.registerCommand(
            'geminiAggregator.refreshApiKeys',
            () => this.refreshApiKeys()
        );

        // Add to disposables
        this.disposables.push(
            addApiKeyCommand,
            removeApiKeyCommand,
            viewApiKeyDetailsCommand,
            testApiKeyCommand,
            refreshApiKeysCommand
        );

        // Add to extension context
        context.subscriptions.push(...this.disposables);
    }

    /**
     * Add a new API key
     */
    private async addApiKey(): Promise<void> {
        try {
            if (!this.coreIntegration) {
                vscode.window.showErrorMessage('Core integration not initialized');
                return;
            }

            // Use InputManager to get API key with validation
            const apiKey = await inputManager.promptForApiKey();
            if (!apiKey) {
                return; // User cancelled
            }

            // Validate the API key
            const validation = validationService.validateApiKey(apiKey);
            if (!validation.isValid) {
                await validationService.showValidationResult(validation, 'API Key Validation');
                return;
            }

            // Show warnings if any
            if (validation.warnings) {
                await validationService.showValidationResult(validation, 'API Key Validation');
            }

            // Show progress
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Adding API Key',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: 'Validating API key...' });

                progress.report({ increment: 50, message: 'Adding to manager...' });

                // Add through core integration service
                if (!this.coreIntegration) {
                    throw new Error('Core integration service not initialized');
                }
                
                const success = await this.coreIntegration.addApiKey(apiKey);
                if (!success) {
                    throw new Error('Failed to add API key to core manager');
                }

                progress.report({ increment: 100, message: 'Complete!' });
            });

            vscode.window.showInformationMessage('API Key added successfully!');

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to add API key: ${errorMessage}`);
        }
    }

    /**
     * Remove an API key
     */
    private async removeApiKey(keyId?: string): Promise<void> {
        try {
            let targetKeyId = keyId;

            // If no key ID provided, show selection
            if (!targetKeyId) {
                const apiKeys = this.coreIntegration ? 
                    uiStateManager.getApiKeys() : [];
                if (apiKeys.length === 0) {
                    vscode.window.showInformationMessage('No API keys to remove');
                    return;
                }

                const items = apiKeys.map((key: any) => ({
                    label: key.keyId,
                    description: `Status: ${key.status}`,
                    detail: `Used ${key.usageStats?.totalRequests || 0} times`,
                    keyId: key.keyId
                }));

                const selected = await vscode.window.showQuickPick(items, {
                    placeHolder: 'Select API key to remove',
                    canPickMany: false
                });

                if (!selected) {
                    return; // User cancelled
                }

                targetKeyId = (selected as any).keyId;
            }

            // Confirm deletion using InputManager
            const confirmed = await inputManager.confirmDeletion(targetKeyId!, 'API key');
            if (!confirmed) {
                return;
            }

            // Show progress
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Removing API Key',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: `Removing ${targetKeyId}...` });

                if (!this.coreIntegration) {
                    throw new Error('Core integration not initialized');
                }

                // Remove through core integration service
                const success = await this.coreIntegration.removeApiKey(targetKeyId!);
                if (!success) {
                    throw new Error('Failed to remove API key from core manager');
                }

                progress.report({ increment: 100, message: 'Complete!' });
            });

            vscode.window.showInformationMessage(`API Key "${targetKeyId}" removed successfully!`);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to remove API key: ${errorMessage}`);
        }
    }

    /**
     * View API key details
     */
    private async viewApiKeyDetails(keyId?: string): Promise<void> {
        try {
            let targetKeyId = keyId;

            // If no key ID provided, show selection
            if (!targetKeyId) {
                const apiKeys = uiStateManager.getApiKeys();
                if (apiKeys.length === 0) {
                    vscode.window.showInformationMessage('No API keys available');
                    return;
                }

                const items = apiKeys.map((key: any) => ({
                    label: key.keyId,
                    description: `Status: ${key.status}`,
                    detail: `${key.currentRequests} active requests`,
                    keyId: key.keyId
                }));

                const selected = await vscode.window.showQuickPick(items, {
                    placeHolder: 'Select API key to view details',
                    canPickMany: false
                });

                if (!selected) {
                    return; // User cancelled
                }

                targetKeyId = (selected as any).keyId;
            }

            // Get API key details
            const apiKey = uiStateManager.getApiKeys().find((k: any) => k.keyId === targetKeyId);
            if (!apiKey) {
                vscode.window.showErrorMessage(`API key "${targetKeyId}" not found`);
                return;
            }

            // Create details panel
            const panel = vscode.window.createWebviewPanel(
                'apiKeyDetails',
                `API Key Details: ${targetKeyId}`,
                vscode.ViewColumn.One,
                {
                    enableScripts: false,
                    retainContextWhenHidden: true
                }
            );

            // Generate HTML content
            panel.webview.html = this.generateApiKeyDetailsHtml(apiKey);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to view API key details: ${errorMessage}`);
        }
    }

    /**
     * Test an API key
     */
    private async testApiKey(keyId?: string): Promise<void> {
        try {
            if (!this.coreIntegration) {
                vscode.window.showErrorMessage('Core integration not initialized');
                return;
            }

            let targetKeyId = keyId;

            // If no key ID provided, show selection
            if (!targetKeyId) {
                const apiKeys = uiStateManager.getApiKeys();
                if (apiKeys.length === 0) {
                    vscode.window.showInformationMessage('No API keys available to test');
                    return;
                }

                const selected = await inputManager.selectFromList(apiKeys, {
                    placeHolder: 'Select API key to test',
                    labelProperty: 'keyId',
                    descriptionProperty: 'status',
                    detailProperty: 'status'
                });

                if (!selected) {
                    return; // User cancelled
                }

                targetKeyId = (selected as any).keyId;
            }

            // Show progress and test the key
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Testing API Key',
                cancellable: true
            }, async (progress, token) => {
                progress.report({ increment: 0, message: `Testing ${targetKeyId}...` });

                progress.report({ increment: 30, message: 'Making test request...' });

                // Check if cancelled
                if (token.isCancellationRequested) {
                    return;
                }

                // Test through core integration service
                if (!this.coreIntegration) {
                    throw new Error('Core integration service not initialized');
                }
                
                const success = await this.coreIntegration.testApiKey(targetKeyId!);

                progress.report({ increment: 100, message: 'Test complete!' });

                // Show result
                if (success) {
                    vscode.window.showInformationMessage(
                        `API Key "${targetKeyId}" test completed successfully!`,
                        'View Details'
                    ).then(selection => {
                        if (selection === 'View Details') {
                            this.viewApiKeyDetails(targetKeyId);
                        }
                    });
                } else {
                    vscode.window.showErrorMessage(`API Key "${targetKeyId}" test failed`);
                }
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to test API key: ${errorMessage}`);
        }
    }

    /**
     * Refresh API keys
     */
    private async refreshApiKeys(): Promise<void> {
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Refreshing API Keys',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: 'Updating API key status...' });

                if (!this.coreIntegration) {
                    throw new Error('Core integration service not initialized');
                }

                // Force refresh through core integration
                await this.coreIntegration.forceRefresh();

                progress.report({ increment: 100, message: 'Complete!' });

                // Trigger UI refresh
                uiStateManager.refresh();
            });

            vscode.window.showInformationMessage('API keys refreshed successfully!');

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to refresh API keys: ${errorMessage}`);
        }
    }

    /**
     * Generate a unique key ID
     */
    private generateKeyId(): string {
        const existingKeys = uiStateManager.getApiKeys();
        let counter = 1;
        let keyId = `api-key-${counter}`;

        while (existingKeys.some((k: any) => k.keyId === keyId)) {
            counter++;
            keyId = `api-key-${counter}`;
        }

        return keyId;
    }

    /**
     * Generate HTML content for API key details
     */
    private generateApiKeyDetailsHtml(apiKey: any): string {
        const isRotatingProxy = uiStateManager.isRotatingProxyEnabled();
        const rotatingProxyUrl = uiStateManager.getRotatingProxyUrl();

        return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>API Key Details</title>
        ${themeService.getWebviewStyles()}
      </head>
      <body>
        <div class="header">
          <h2>🔑 API Key Details</h2>
          <p><strong>Key ID:</strong> ${apiKey.keyId}</p>
        </div>

        <div class="section">
          <h3>📊 Status Information</h3>
          <div class="info-grid">
            <span class="info-label">Status:</span>
            <span class="status-${this.getStatusClass(apiKey.status)}">${apiKey.status.toUpperCase()}</span>
            
            <span class="info-label">Current Requests:</span>
            <span>${apiKey.currentRequests}</span>
            
            <span class="info-label">Total Usage:</span>
            <span>${apiKey.usedHistory?.length || 0} requests</span>
            
            <span class="info-label">Last Used:</span>
            <span>${apiKey.lastUsed ? apiKey.lastUsed.toLocaleString() : 'Never'}</span>
          </div>
        </div>

        <div class="section">
          <h3>🌐 Proxy Configuration</h3>
          <div class="info-grid">
            <span class="info-label">Mode:</span>
            <span>${isRotatingProxy ? 'Rotating Proxy' : 'Individual Proxy'}</span>
            
            <span class="info-label">Proxy URL:</span>
            <span>${isRotatingProxy ? rotatingProxyUrl || 'Not configured' : apiKey.proxy || 'Direct connection'}</span>
          </div>
        </div>

        <div class="section">
          <h3>🔐 Security Information</h3>
          <div class="info-grid">
            <span class="info-label">API Key:</span>
            <span class="masked-key">${this.maskApiKey(apiKey.key)}</span>
            
            <span class="info-label">Key Length:</span>
            <span>${apiKey.key.length} characters</span>
          </div>
        </div>

        <div class="section">
          <h3>📈 Usage History</h3>
          <p>Recent usage: ${apiKey.usedHistory?.length || 0} total requests</p>
          ${apiKey.usedHistory && apiKey.usedHistory.length > 0 ?
                `<p>Last 5 requests: ${apiKey.usedHistory.slice(-5).map((h: any) => new Date(h.date).toLocaleString()).join(', ')}</p>` :
                '<p>No usage history available</p>'
            }
        </div>
      </body>
      </html>
    `;
    }

    /**
     * Get CSS class for status
     */
    private getStatusClass(status: string): string {
        switch (status) {
            case 'available':
                return 'active';
            case 'cooling_down':
                return 'warning';
            case 'disabled':
                return 'error';
            default:
                return 'inactive';
        }
    }

    /**
     * Mask API key for display
     */
    private maskApiKey(key: string): string {
        if (key.length <= 10) {
            return '*'.repeat(key.length);
        }
        return key.substring(0, 6) + '*'.repeat(key.length - 10) + key.substring(key.length - 4);
    }

    /**
     * Update API key manager reference
     */
    public setCoreIntegration(coreIntegration: CoreIntegrationService): void {
        this.coreIntegration = coreIntegration;
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}