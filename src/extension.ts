// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as http from 'http';
import * as fs from 'fs';     // 引入 fs 模組
import express from 'express';
import config from './server/config'; // Import config from the copied server code
import createProxyRouter from './server/routes/proxy'; // Import the proxy router function
import errorHandler from './server/middlewares/errorHandler'; // Import error handler middleware
import ApiKeyManager from './server/core/ApiKeyManager'; // Import ApiKeyManager
import RequestDispatcher from './server/core/RequestDispatcher'; // Import RequestDispatcher
import GoogleApiForwarder from './server/core/GoogleApiForwarder'; // Import GoogleApiForwarder
import { StreamHandler } from './server/core/StreamHandler'; // Import StreamHandler
// We might not need loggerMiddleware directly in extension.ts, but the errorHandler uses the logger.
// Let's keep the import for now or ensure the logger is accessible.
import { logger, loggerMiddleware } from "./server/middlewares/logger"; // 引入 logger 和 loggerMiddleware
import { eventManager, RequestStatus } from "./server/core/EventManager"; // 引入 eventManager 和 RequestStatus
import { ApiKey } from "./server/types/ApiKey"; // 引入 ApiKey 介面
import { ProxyPoolManager } from "./server/core/ProxyPoolManager"; // Import ProxyPoolManager
import { ProxyAssignmentManager } from "./server/core/ProxyAssignmentManager"; // Import ProxyAssignmentManager
import { ProxyLoadBalancer } from "./server/core/ProxyLoadBalancer"; // Import ProxyLoadBalancer
import { ProxyConfigurationManager } from "./server/core/ProxyConfigurationManager"; // Import ProxyConfigurationManager
import { ProxyErrorHandler } from "./server/core/ProxyErrorHandler"; // Import ProxyErrorHandler
import { MigrationManager } from "./server/core/MigrationManager"; // Import MigrationManager
import { RotatingProxyHealthMonitor } from "./server/core/RotatingProxyHealthMonitor"; // Import RotatingProxyHealthMonitor
import { rotatingProxyUIService } from "./ui/core/RotatingProxyUIService"; // Import RotatingProxyUIService
import { ProxyPerformanceMonitor } from "./server/core/ProxyPerformanceMonitor"; // Import ProxyPerformanceMonitor

// Import native UI components
import { ApiKeyTreeProvider } from './ui/providers/ApiKeyTreeProvider';
import { ProxyTreeProvider } from './ui/providers/ProxyTreeProvider';
import { ApiKeyCommands } from './ui/commands/ApiKeyCommands';
import { ProxyCommands } from './ui/commands/ProxyCommands';
import { ServerCommands } from './ui/commands/ServerCommands';
import { 
  statusBarManager, 
  systemMonitor, 
  createCoreIntegrationService,
  disposalManager
} from './ui/core';

let server: http.Server | undefined; // Declare server variable to manage its lifecycle
let apiKeyManager: ApiKeyManager; // Declare apiKeyManager variable to be accessible in commands
let webviewPanel: vscode.WebviewPanel | undefined; // 新增：保存 webviewPanel 引用
let proxyPoolManager: ProxyPoolManager | undefined; // Declare proxy pool manager for cleanup

// Native UI components
let apiKeyTreeProvider: ApiKeyTreeProvider | undefined;
let proxyTreeProvider: ProxyTreeProvider | undefined;
let coreIntegrationService: any;
let apiKeyCommands: ApiKeyCommands | undefined;
let proxyCommands: ProxyCommands | undefined;
let serverCommands: ServerCommands | undefined;

/**
 * Load proxies from environment variables if rotating proxy is not configured
 */
async function loadProxiesFromEnvironment(proxyPoolManager: ProxyPoolManager): Promise<void> {
	// Check if rotating proxy is configured
	if (config.USE_ROTATING_PROXY && config.ROTATING_PROXY) {
		console.log('Extension: Rotating proxy is configured, skipping individual proxy loading');
		console.log(`Extension: Using rotating proxy: ${config.ROTATING_PROXY}`);
		return;
	}
	
	// Load individual proxies from PROXY_SERVERS environment variable
	const proxyServersEnv = process.env.PROXY_SERVERS;
	if (!proxyServersEnv) {
		console.log('Extension: No PROXY_SERVERS environment variable found');
		return;
	}
	
	const proxyUrls = proxyServersEnv.split(',').map(url => url.trim()).filter(url => url.length > 0);
	if (proxyUrls.length === 0) {
		console.log('Extension: No valid proxy URLs found in PROXY_SERVERS');
		return;
	}
	
	console.log(`Extension: Loading ${proxyUrls.length} proxies from environment variables`);
	
	// Add each proxy to the pool
	for (const proxyUrl of proxyUrls) {
		try {
			const proxyId = await proxyPoolManager.addProxy(proxyUrl);
			console.log(`Extension: Added proxy ${proxyUrl} (ID: ${proxyId})`);
		} catch (error) {
			console.error(`Extension: Failed to add proxy ${proxyUrl}:`, error);
		}
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	console.log('Roo: activate function started'); // Added log to check activation

	console.log('Congratulations, your extension "api-key-aggregetor" is now active!');

	// --- Start Proxy Server Integration ---

	const app = express();
	const port = config.PORT; // 使用从 config 中获取的端口

	// 使用 SecretStorage 读取 API Keys
	const storedKeyIdsJson = await context.secrets.get("geminiApiKeysIds");
	const storedKeyIds: string[] = storedKeyIdsJson ? JSON.parse(storedKeyIdsJson) : [];
	const initialApiKeys: ApiKey[] = [];

	for (const keyId of storedKeyIds) {
		const apiKey = await context.secrets.get(keyId);
		if (apiKey) {
			initialApiKeys.push({
				key: apiKey,
				keyId: keyId,
				// status, coolingDownUntil, usedHistory 將由 ApiKeyManager 從持久化儲存中載入
				status: "available", // 這裡只是初始值，實際狀態會在 ApiKeyManager.loadKeys 中被覆蓋
				currentRequests: 0,
				lastUsed: undefined,
				usedHistory: [], // 這裡只是初始值，實際歷史會在 ApiKeyManager.loadKeys 中被覆蓋
			});
		}
	}

	if (initialApiKeys.length === 0) {
		vscode.window.showWarningMessage('No API keys found. Please run "Gemini: Add API Key" command to add keys.');
	}

	// Initialize proxy configuration manager
	const proxyConfigurationManager = new ProxyConfigurationManager(context);
	await proxyConfigurationManager.migrateLegacyConfiguration();
	const proxyConfig = await proxyConfigurationManager.loadConfiguration();

	// Initialize rotating proxy health monitor
	const rotatingProxyHealthMonitor = new RotatingProxyHealthMonitor(proxyConfigurationManager);
	
	// Start health monitoring if rotating proxy is enabled
	if (config.USE_ROTATING_PROXY && config.ROTATING_PROXY) {
		console.log('Extension: Starting rotating proxy health monitoring');
		rotatingProxyHealthMonitor.startMonitoring();
		
		// Initialize UI service with health monitor
		rotatingProxyUIService.initialize(rotatingProxyHealthMonitor);
	}
	
	// Initialize proxy management components
	proxyPoolManager = new ProxyPoolManager(eventManager, context);
	proxyPoolManager.setHealthCheckConfig(
		proxyConfig.healthCheckInterval,
		proxyConfig.maxErrorsBeforeDisable
	);
	await proxyPoolManager.initialize();
	
	const proxyLoadBalancer = new ProxyLoadBalancer(proxyConfig.loadBalancingStrategy);
	
	const proxyAssignmentManager = new ProxyAssignmentManager(
	  eventManager,
	  proxyPoolManager,
	  context
	);
	proxyAssignmentManager.setAutoAssignment(proxyConfig.autoAssignmentEnabled);
	await proxyAssignmentManager.initialize();
	
	// Initialize proxy error handler
	const proxyErrorHandler = new ProxyErrorHandler(
		eventManager,
		proxyPoolManager,
		proxyAssignmentManager
	);
	
	// Initialize performance monitor
	const proxyPerformanceMonitor = new ProxyPerformanceMonitor(eventManager);
	
	// Initialize migration manager and perform migration if needed
	const migrationManager = new MigrationManager(
		context,
		eventManager,
		proxyPoolManager,
		proxyAssignmentManager,
		proxyConfigurationManager
	);

	// Store health monitor in context for access by other components
	(context as any).rotatingProxyHealthMonitor = rotatingProxyHealthMonitor;
	
	// Check if migration is needed and perform it
	const migrationNeeded = await migrationManager.isMigrationNeeded();
	if (migrationNeeded) {
		console.log('Extension: Legacy proxy configuration detected, performing migration...');
		await migrationManager.performMigration();
	}
	
	// Load proxies from environment variables if rotating proxy is not configured
	await loadProxiesFromEnvironment(proxyPoolManager);
	
	// 傳遞 eventManager, context 和 proxy 管理組件給 ApiKeyManager
	apiKeyManager = new ApiKeyManager(
	  initialApiKeys,
	  eventManager,
	  context,
	  proxyPoolManager,
	  proxyAssignmentManager,
	  proxyLoadBalancer
	);
	await apiKeyManager.loadKeys(initialApiKeys); // 確保在啟動時載入持久化狀態

	const googleApiForwarder = new GoogleApiForwarder();
	
	// Connect health monitor to GoogleApiForwarder
	googleApiForwarder.setHealthMonitor(rotatingProxyHealthMonitor);
	
	const streamHandler = new StreamHandler();
	const requestDispatcher = new RequestDispatcher(apiKeyManager);

	// Create the proxy router
	const proxyRouter = createProxyRouter(apiKeyManager, requestDispatcher, googleApiForwarder, streamHandler, eventManager );

	// Integrate JSON body parser middleware
	app.use(express.json({ limit: '8mb' }));

	// Integrate proxy router
	app.use('/', proxyRouter);

	// 使用 loggerMiddleware
  app.use(loggerMiddleware);

	// Integrate unified error handling middleware (should be after routes)
	app.use(errorHandler); // Assuming errorHandler is adapted or can access necessary dependencies

	// Start the HTTP server
	server = http.createServer(app);

	server.listen(port, () => {
		console.log(`Proxy server is running on port ${port}`);
		vscode.window.showInformationMessage(`API Key Aggregator Proxy Server started on port ${port}`);
	}).on('error', (err: { code?: string; message?: string }) => {
		if (err.code === 'EADDRINUSE') {
			console.warn(`Port ${port} is already in use. Proxy server may be running in another VS Code window.`);
			vscode.window.showInformationMessage(`API Key Aggregator Proxy Server is already running on port ${port} in another VS Code window.`);
			// Do NOT deactivate the extension, just don't start a new server
		} else {
			console.error('Failed to start proxy server:', err);
			vscode.window.showErrorMessage(`Failed to start API Key Aggregator Proxy Server: ${err.message}`);
			// Deactivate the extension if the server fails to start for other reasons
			deactivate();
		}
	});

	// Add the server to the context subscriptions so it's disposed on deactivate
	context.subscriptions.push({
		dispose: () => {
			if (server) {
				server.close(() => {
					console.log('Proxy server stopped.');
				});
			}
		}
	});

	// --- End Proxy Server Integration ---

	// --- Initialize Native UI Components ---
	console.log('Extension: Initializing native UI components...');
	
	// Create core integration service
	coreIntegrationService = createCoreIntegrationService(
		eventManager,
		apiKeyManager,
		proxyPoolManager,
		proxyAssignmentManager
	);
	coreIntegrationService.initialize();
	
	// Initialize TreeView providers
	apiKeyTreeProvider = new ApiKeyTreeProvider();
	proxyTreeProvider = new ProxyTreeProvider();
	
	// Register TreeViews
	const apiKeyTreeView = vscode.window.createTreeView('geminiAggregator.apiKeys', {
		treeDataProvider: apiKeyTreeProvider,
		showCollapseAll: true
	});
	
	const proxyTreeView = vscode.window.createTreeView('geminiAggregator.proxies', {
		treeDataProvider: proxyTreeProvider,
		showCollapseAll: true
	});
	
	// Initialize command handlers
	apiKeyCommands = new ApiKeyCommands(coreIntegrationService);
	proxyCommands = new ProxyCommands(proxyPoolManager, proxyAssignmentManager);
	serverCommands = new ServerCommands();
	
	// Register all commands
	apiKeyCommands.registerCommands(context);
	proxyCommands.registerCommands(context);
	serverCommands.registerCommands(context);
	
	// Initialize and show status bar
	statusBarManager.show();
	
	// Start system monitoring
	systemMonitor.startMonitoring();
	
	// Register UI components with disposal manager
	disposalManager.register(apiKeyTreeView);
	disposalManager.register(proxyTreeView);
	disposalManager.register(coreIntegrationService);
	disposalManager.register(statusBarManager);
	disposalManager.register(systemMonitor);
	
	// Register cleanup tasks
	disposalManager.registerCleanupTask(() => {
		if (apiKeyCommands) apiKeyCommands.dispose();
		if (proxyCommands) proxyCommands.dispose();
		if (serverCommands) serverCommands.dispose();
		if (apiKeyTreeProvider) apiKeyTreeProvider.dispose();
		if (proxyTreeProvider) proxyTreeProvider.dispose();
	});
	
	// Add disposal manager to context subscriptions
	context.subscriptions.push(disposalManager);
	
	console.log('Extension: Native UI components initialized successfully');
	// --- End Native UI Components ---

	// Example command from the template (can be removed later)
console.log('Roo: Before registering runserver command');
	const disposable = vscode.commands.registerCommand('geminiAggregator-dev.runserver', () => {
		vscode.window.showInformationMessage('Run Server from api-key-aggregetor!');
	});
console.log('Roo: After registering runserver command');
	context.subscriptions.push(disposable);

	// Register command to add API Key
	const addApiKeyCommand = vscode.commands.registerCommand('geminiAggregator-dev.addApiKey', async () => {
		const apiKey = await vscode.window.showInputBox({
			prompt: 'Please enter your Gemini API Key',
			ignoreFocusOut: true,
			password: true
		});

		if (apiKey) {
			// Get the current counter value or initialize to 1
			const counterJson = await context.secrets.get("geminiApiKeyCounter");
			let counter = counterJson ? parseInt(counterJson, 10) : 1;

			// Generate the key ID using the counter
			const keyId = `key${counter}`;

			// Store the key securely
			await context.secrets.store(keyId, apiKey);

			// Get existing key IDs or initialize an empty array
			const existingKeyIdsJson = await context.secrets.get("geminiApiKeysIds");
			const existingKeyIds: string[] = existingKeyIdsJson ? JSON.parse(existingKeyIdsJson) : [];

			// Add the new key ID if it's not already in the list (handle potential re-adding after deletion)
			if (!existingKeyIds.includes(keyId)) {
				existingKeyIds.push(keyId);
				// Store the updated list of key IDs
				await context.secrets.store("geminiApiKeysIds", JSON.stringify(existingKeyIds));
			}


			// Increment and store the counter
			counter++;
			await context.secrets.store("geminiApiKeyCounter", counter.toString());


			vscode.window.showInformationMessage(`Gemini API Key "${keyId}" added.`);

			// Reload keys in ApiKeyManager
			const updatedApiKeys: ApiKey[] = [];
			const currentStoredKeyIdsJson = await context.secrets.get("geminiApiKeysIds");
			const currentStoredKeyIds: string[] = currentStoredKeyIdsJson ? JSON.parse(currentStoredKeyIdsJson) : [];

			for (const id of currentStoredKeyIds) {
				const key = await context.secrets.get(id);
				if (key) {
					updatedApiKeys.push({
						key: key,
						keyId: id,
						status: "available",
						currentRequests: 0,
						lastUsed: undefined,
						usedHistory: [],
					});
				}
			}
			await apiKeyManager.loadKeys(updatedApiKeys);
			console.log('API keys reloaded after adding a key.');

		} else {
			vscode.window.showWarningMessage('No API Key entered.');
		}
	});
	context.subscriptions.push(addApiKeyCommand);

	// Register command to list API Keys (showing partial key)
	const listApiKeysCommand = vscode.commands.registerCommand('geminiAggregator-dev.listApiKeys', async () => {
		const existingKeyIdsJson = await context.secrets.get("geminiApiKeysIds");
		const existingKeyIds: string[] = existingKeyIdsJson ? JSON.parse(existingKeyIdsJson) : [];

		if (existingKeyIds.length === 0) {
			vscode.window.showInformationMessage('No Gemini API Key found. Please run the "geminiAggregator-dev.addApiKey" command to add one.');
			return;
		}

		const quickPickItems: vscode.QuickPickItem[] = [];
		// Sort keys numerically based on the number in keyId (e.g., key1, key2, key10)
		existingKeyIds.sort((a, b) => {
			const numA = parseInt(a.replace('key', ''), 10);
			const numB = parseInt(b.replace('key', ''), 10);
			return numA - numB;
		});


		for (const keyId of existingKeyIds) {
			const apiKey = await context.secrets.get(keyId);
			if (apiKey) {
				// Show a partial key for identification
				const partialKey = apiKey.length > 4 ? `...${apiKey.slice(-4)}` : apiKey;
				quickPickItems.push({
					label: `API Key ID: ${keyId}`,
					description: `Key ending in: ${partialKey}`
				});
			}
		}

		vscode.window.showQuickPick(quickPickItems, {
			placeHolder: 'Configured Gemini API Keys (partial key shown)'
		});
	});
	context.subscriptions.push(listApiKeysCommand);

	// Register command to delete API Key
	const deleteApiKeyCommand = vscode.commands.registerCommand('geminiAggregator-dev.deleteApiKey', async () => {
		const existingKeyIdsJson = await context.secrets.get("geminiApiKeysIds");
		const existingKeyIds: string[] = existingKeyIdsJson ? JSON.parse(existingKeyIdsJson) : [];

		if (existingKeyIds.length === 0) {
			vscode.window.showInformationMessage('No Gemini API Key found to delete.');
			return;
		}

		const quickPickItems: vscode.QuickPickItem[] = existingKeyIds.map(keyId => ({
			label: `API Key ID: ${keyId}`,
			description: `Select to delete key ${keyId}`
		}));

		const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
			placeHolder: 'Select the Gemini API Key to delete'
		});

		if (selectedItem) {
			const keyIdToDelete = selectedItem.label.replace('API Key ID: ', '');
			await context.secrets.delete(keyIdToDelete);

			// Update the stored list of key IDs
			const updatedKeyIds = existingKeyIds.filter(id => id !== keyIdToDelete);
			await context.secrets.store("geminiApiKeysIds", JSON.stringify(updatedKeyIds));

			vscode.window.showInformationMessage(`Gemini API Key "${keyIdToDelete}" deleted.`);

			// Also delete the status data for the deleted key
			await context.secrets.delete(`apiKeyStatus_${keyIdToDelete}`);

			vscode.window.showInformationMessage(
				`API Key ${keyIdToDelete} deleted successfully!`
			);

			// Reload keys in ApiKeyManager
			const updatedApiKeys: ApiKey[] = [];
			for (const id of updatedKeyIds) {
				const key = await context.secrets.get(id);
				if (key) {
					updatedApiKeys.push({
						key: key,
						keyId: id,
						status: "available",
						currentRequests: 0,
						lastUsed: undefined,
						usedHistory: [],
					});
				}
			}
			await apiKeyManager.loadKeys(updatedApiKeys);
			console.log('API keys reloaded after deleting a key.');

		} else {
			vscode.window.showInformationMessage('Deletion cancelled.');
		}
	});
	context.subscriptions.push(deleteApiKeyCommand);

	// Register command to modify API Key
	const modifyApiKeyCommand = vscode.commands.registerCommand('geminiAggregator-dev.modifyApiKey', async () => {
		const existingKeyIdsJson = await context.secrets.get("geminiApiKeysIds");
		const existingKeyIds: string[] = existingKeyIdsJson ? JSON.parse(existingKeyIdsJson) : [];

		if (existingKeyIds.length === 0) {
			vscode.window.showInformationMessage('No Gemini API Key found to modify.');
			return;
		}

		const quickPickItems: vscode.QuickPickItem[] = existingKeyIds.map(keyId => ({
			label: `API Key ID: ${keyId}`,
			description: `Select to modify key ${keyId}`
		}));

		const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
			placeHolder: 'Select the Gemini API Key to modify'
		});

		if (selectedItem) {
			const keyIdToModify = selectedItem.label.replace('API Key ID: ', '');
			const newApiKey = await vscode.window.showInputBox({
				prompt: `Please enter the new Gemini API Key for ${keyIdToModify}`,
				ignoreFocusOut: true,
				password: true
			});

			if (newApiKey) {
				await context.secrets.store(keyIdToModify, newApiKey);
				vscode.window.showInformationMessage(`Gemini API Key "${keyIdToModify}" modified.`);

				// Reload keys in ApiKeyManager
				const updatedApiKeys: ApiKey[] = [];
				for (const id of existingKeyIds) {
					const key = await context.secrets.get(id);
					if (key) {
						updatedApiKeys.push({
							key: key,
							keyId: id,
							status: "available",
							currentRequests: 0,
							lastUsed: undefined,
							usedHistory: [],
						});
					}
				}
				await apiKeyManager.loadKeys(updatedApiKeys);
				console.log('API keys reloaded after modifying a key.');

			} else {
				vscode.window.showInformationMessage('Modification cancelled or no new key entered.');
			}
		} else {
			vscode.window.showInformationMessage('Modification cancelled.');
		}
	});
	context.subscriptions.push(modifyApiKeyCommand);

	const openPanelCommand = vscode.commands.registerCommand('geminiAggregator-dev.openPanel', () => {
		if (webviewPanel) {
			webviewPanel.reveal(vscode.ViewColumn.One);
			return;
		}
	
		webviewPanel = vscode.window.createWebviewPanel(
			'geminiAggregatorPanel', // 識別 Webview Panel 的類型
			'Gemini Aggregator Panel', // Panel 的標題
			vscode.ViewColumn.One, // 顯示 Panel 的編輯器欄位
			{
				enableScripts: true, // 啟用 JavaScript
				// 允許 Webview 載入來自 dist/webview-ui 目錄的本地資源
				localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-ui')]
			}
		);
		const panel = webviewPanel; // Keep this line for consistency if 'panel' is used elsewhere in this block

		// 獲取打包後資源的 URI
		const webviewAppPath = vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-ui', 'bundle.js');
		const webviewHtmlPath = vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-ui', 'index.html');

		const scriptUri = panel.webview.asWebviewUri(webviewAppPath);
		// panel.webview.html = `<p>testtttttttt123456</p>`; // 暫時註解掉這行，讓 fs.readFile 決定內容


		// 為了 CSP，生成一個隨機的 nonce
		const nonce = getNonce();

		// 讀取打包後的 HTML 模板
		console.log('Roo: context.extensionUri.fsPath:', context.extensionUri.fsPath);
		console.log('Roo: webviewAppPath.fsPath:', webviewAppPath.fsPath);
		console.log('Roo: webviewHtmlPath.fsPath:', webviewHtmlPath.fsPath);

		fs.readFile(webviewHtmlPath.fsPath, 'utf8', (err, data) => {
			if (err) {
				vscode.window.showErrorMessage('無法讀取 Webview HTML 檔案: ' + err.message);
				console.error('Roo: 無法讀取 Webview HTML 檔案:', err); // 添加錯誤日誌
				return;
			}
			vscode.window.showInformationMessage('已讀取 Webview HTML 檔案'); // 將 showErrorMessage 改為 showInformationMessage


			// 替換 HTML 內容中的佔位符
			let htmlContent = data
				.replace(/\{\{scriptUri\}\}/g, scriptUri.toString())
				.replace(/\{\{nonce\}\}/g, nonce)
				.replace(/\{\{cspSource\}\}/g, panel.webview.cspSource); // 確保 CSP 來源正確

			panel.webview.html = htmlContent;
		});

		// 監聽來自 Webview 的訊息
		panel.webview.onDidReceiveMessage(
			async message => {
				switch (message.command) {
					case 'getApiKeys(request)':
						// 獲取所有 API Keys 的當前狀態並發送到 Webview
						const allKeys = await apiKeyManager.getAllKeys();
						panel.webview.postMessage({
							command: "getApiKeys(response)",
							keys: allKeys,
						});
						return;
					case 'getProxies(request)':
						// Get proxies from ProxyPoolManager instead of legacy storage
						const availableProxies = proxyPoolManager?.getAllProxies() || [];
						panel.webview.postMessage({
							command: "getProxies(response)",
							proxies: availableProxies,
						});
						return;
					case 'getProxyAssignments(request)':
						// Get proxy assignments from ProxyAssignmentManager
						const assignments = proxyAssignmentManager.getAllAssignments();
						panel.webview.postMessage({
							command: "getProxyAssignments(response)",
							assignments: assignments,
						});
						return;
					case 'addProxy':
						try {
							if (!proxyPoolManager) {
								throw new Error('Proxy pool manager not initialized');
							}
							const proxyId = await proxyPoolManager.addProxy(message.url);
							panel.webview.postMessage({
								command: "addProxy(response)",
								success: true,
								proxyId: proxyId,
							});
							vscode.window.showInformationMessage(`Proxy added successfully: ${message.url}`);
						} catch (error) {
							const errorMessage = error instanceof Error ? error.message : 'Unknown error';
							panel.webview.postMessage({
								command: "addProxy(response)",
								success: false,
								error: errorMessage,
							});
							vscode.window.showErrorMessage(`Failed to add proxy: ${errorMessage}`);
							proxyErrorHandler.handleProxyError('unknown', error as Error);
						}
						return;
					case 'removeProxy':
						try {
							if (!proxyPoolManager) {
								throw new Error('Proxy pool manager not initialized');
							}
							await proxyPoolManager.removeProxy(message.proxyId);
							panel.webview.postMessage({
								command: "removeProxy(response)",
								success: true,
							});
							vscode.window.showInformationMessage(`Proxy removed successfully`);
						} catch (error) {
							const errorMessage = error instanceof Error ? error.message : 'Unknown error';
							panel.webview.postMessage({
								command: "removeProxy(response)",
								success: false,
								error: errorMessage,
							});
							vscode.window.showErrorMessage(`Failed to remove proxy: ${errorMessage}`);
						}
						return;
					case 'updateProxy':
						try {
							if (!proxyPoolManager) {
								throw new Error('Proxy pool manager not initialized');
							}
							await proxyPoolManager.updateProxy(message.proxyId, message.url);
							panel.webview.postMessage({
								command: "updateProxy(response)",
								success: true,
							});
						} catch (error) {
							panel.webview.postMessage({
								command: "updateProxy(response)",
								success: false,
								error: error instanceof Error ? error.message : 'Unknown error',
							});
						}
						return;
					case 'assignProxy':
						try {
							await proxyAssignmentManager.assignProxyToKey(message.keyId, message.proxyId, message.isManual);
							panel.webview.postMessage({
								command: "assignProxy(response)",
								success: true,
							});
						} catch (error) {
							panel.webview.postMessage({
								command: "assignProxy(response)",
								success: false,
								error: error instanceof Error ? error.message : 'Unknown error',
							});
						}
						return;
					case 'unassignProxy':
						try {
							await proxyAssignmentManager.unassignProxy(message.keyId);
							panel.webview.postMessage({
								command: "unassignProxy(response)",
								success: true,
							});
						} catch (error) {
							panel.webview.postMessage({
								command: "unassignProxy(response)",
								success: false,
								error: error instanceof Error ? error.message : 'Unknown error',
							});
						}
						return;
					case 'rebalanceProxies':
						try {
							await proxyAssignmentManager.rebalanceAssignments();
							panel.webview.postMessage({
								command: "rebalanceProxies(response)",
								success: true,
							});
						} catch (error) {
							panel.webview.postMessage({
								command: "rebalanceProxies(response)",
								success: false,
								error: error instanceof Error ? error.message : 'Unknown error',
							});
						}
						return;
					// Legacy handlers for backward compatibility
					case 'updateProxies':
						// Convert legacy proxies to new proxy system
						try {
							if (!proxyPoolManager) {
								throw new Error('Proxy pool manager not initialized');
							}
							// First, clear existing proxies that aren't in the new list
							const existingProxies = proxyPoolManager.getAllProxies();
							for (const proxy of existingProxies) {
								if (proxy.assignedKeyCount === 0 && !message.proxies.includes(proxy.url)) {
									await proxyPoolManager.removeProxy(proxy.id);
								}
							}
							
							// Then add new proxies
							for (const proxyUrl of message.proxies) {
								const existingProxy = existingProxies.find(p => p.url === proxyUrl);
								if (!existingProxy) {
									await proxyPoolManager.addProxy(proxyUrl);
								}
							}
							
							// For backward compatibility, still store in legacy format
							await context.secrets.store("geminiProxies", JSON.stringify(message.proxies));
							apiKeyManager.setProxies(message.proxies);
							
							panel.webview.postMessage({
								command: "updateProxies(response)",
								success: true,
							});
						} catch (error) {
							panel.webview.postMessage({
								command: "updateProxies(response)",
								success: false,
								error: error instanceof Error ? error.message : 'Unknown error',
							});
						}
						return;
					case 'updateApiKeyProxy':
						try {
							if (!proxyPoolManager) {
								throw new Error('Proxy pool manager not initialized');
							}
							// First, find if there's an existing proxy with this URL
							const existingProxies = proxyPoolManager.getAllProxies();
							let proxyId: string | undefined;
							
							const existingProxy = existingProxies.find(p => p.url === message.proxy);
							if (existingProxy) {
								proxyId = existingProxy.id;
							} else if (message.proxy) {
								// Create a new proxy if needed
								proxyId = await proxyPoolManager.addProxy(message.proxy);
							}
							
							// Assign or unassign the proxy
							if (proxyId) {
								await proxyAssignmentManager.assignProxyToKey(message.keyId, proxyId, true);
							} else {
								await proxyAssignmentManager.unassignProxy(message.keyId);
							}
							
							// For backward compatibility
							await apiKeyManager.updateApiKeyProxy(message.keyId, message.proxy);
							
							panel.webview.postMessage({
								command: "updateApiKeyProxy(response)",
								success: true,
							});
						} catch (error) {
							panel.webview.postMessage({
								command: "updateApiKeyProxy(response)",
								success: false,
								error: error instanceof Error ? error.message : 'Unknown error',
							});
						}
						return;
					case 'updateRotatingProxy':
						apiKeyManager.setRotatingProxy(message.isRotatingProxy);
						// If rotating proxy is enabled, disable auto-assignment
						if (message.isRotatingProxy) {
							proxyAssignmentManager.setAutoAssignment(false);
						}
						return;
				}
			},
			undefined,
			context.subscriptions
		);

		// 監聽 emit
		const apiKeyStatusUpdateListener = (apiKey: ApiKey) => {
			if (webviewPanel) { // 使用全域 webviewPanel 變數
				webviewPanel.webview.postMessage({
					command: "apiKeyStatusUpdate",
					apiKey: apiKey,
				});
			}
		};
		eventManager.on("apiKeyStatusUpdate", apiKeyStatusUpdateListener);

		const requestUpdateListener = (requestStatus: RequestStatus) => {
			if (webviewPanel) { // 使用全域 webviewPanel 變數
				webviewPanel.webview.postMessage({
					command: "requestUpdate",
					requestStatus: requestStatus,
				});
			}
		};
		eventManager.on("requestUpdate", requestUpdateListener);

		// 當 panel 關閉時清除引用
		webviewPanel.onDidDispose(
			() => {
					webviewPanel = undefined;
					// 取消 eventManager 的事件監聽
					eventManager.off("apiKeyStatusUpdate", apiKeyStatusUpdateListener);
					console.log('Roo: eventManager apiKeyStatusUpdate listener disposed.'); // 添加日誌
			},
			null,
			context.subscriptions
		);
	});
	context.subscriptions.push(openPanelCommand);
}

// 輔助函數：生成 Nonce
function getNonce() {
	   let text = '';
	   const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	   for (let i = 0; i < 32; i++) {
	       text += possible.charAt(Math.floor(Math.random() * possible.length));
	   }
	   return text;
}

// This method is called when your extension is deactivated
export async function deactivate() {
	console.log('Your extension "api-key-aggregetor" is being deactivated.');
	
	// Use disposal manager for comprehensive cleanup
	try {
		await disposalManager.dispose();
		console.log('All UI components disposed successfully via DisposalManager.');
	} catch (error) {
		console.error('Error disposing UI components via DisposalManager:', error);
	}
	
	// Clean up rotating proxy services
	try {
		rotatingProxyUIService.stop();
		console.log('Rotating proxy UI service stopped successfully.');
	} catch (error) {
		console.error('Error stopping rotating proxy UI service:', error);
	}

	const healthMonitor = (context as any)?.rotatingProxyHealthMonitor;
	if (healthMonitor) {
		try {
			healthMonitor.stopMonitoring();
			console.log('Rotating proxy health monitor stopped successfully.');
		} catch (error) {
			console.error('Error stopping rotating proxy health monitor:', error);
		}
	}

	// Clean up proxy resources
	if (proxyPoolManager) {
		try {
			proxyPoolManager.dispose();
			console.log('Proxy pool manager disposed successfully.');
		} catch (error) {
			console.error('Error disposing proxy pool manager:', error);
		}
	}
	
	// Close webview panel if open
	if (webviewPanel) {
		try {
			webviewPanel.dispose();
			webviewPanel = undefined;
			console.log('Webview panel disposed successfully.');
		} catch (error) {
			console.error('Error disposing webview panel:', error);
		}
	}
	
	// The server is closed via context.subscriptions.dispose
	console.log('Extension deactivation completed.');
}
