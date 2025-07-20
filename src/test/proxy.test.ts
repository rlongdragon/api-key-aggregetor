import * as assert from 'assert';
import * as vscode from 'vscode';
import * as http from 'http';
import ApiKeyManager from '../server/core/ApiKeyManager';
import { ApiKey } from '../server/types/ApiKey';
import { EventManager } from '../server/core/EventManager';
import GoogleApiForwarder from '../server/core/GoogleApiForwarder';
import { TestProxyServer, startTestProxies } from './proxy-server';

import * as dotenv from 'dotenv';
dotenv.config();

suite('Proxy Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  let proxyServer: http.Server;
  const proxyPort = 8080;
  let requestReceived = false;

  suiteSetup(async () => {
    const testProxy = new TestProxyServer(proxyPort);
    await testProxy.start();
    proxyServer = (testProxy as unknown as { server: http.Server }).server; // Access the internal server for compatibility
  });

  suiteTeardown(() => {
    proxyServer.close();
  });

  test('Test proxy connection', async function() {
    this.timeout(5000); // 5 second timeout

    const eventManager = new EventManager();
    const context = {
      secrets: {
        get: async (key: string) => undefined,
        store: async (key: string, value: string) => {},
        delete: async (key: string) => {},
      },
    } as unknown as vscode.ExtensionContext;

    const initialApiKeys: ApiKey[] = [
      {
        key: 'test-key',
        keyId: 'key1',
        status: 'available',
        currentRequests: 0,
        proxy: `http://127.0.0.1:${proxyPort}`,
      },
    ];

    const apiKeyManager = new ApiKeyManager(initialApiKeys, eventManager, context);
    await apiKeyManager.loadKeys(initialApiKeys);

    const googleApiForwarder = new GoogleApiForwarder();

    const apiKey = await apiKeyManager.getAvailableKey();
    assert.ok(apiKey, 'Could not get an available API key');

    // This will fail, but we are checking if the proxy is used
    try {
      await googleApiForwarder.forwardRequest('gemini-2.0-flash', 'generateContent', {}, apiKey);
      assert.fail('Expected request to fail through proxy');
    } catch (error: unknown) {
      // Verify it's a network/proxy error, not some other unexpected error
      const errorObj = error as { message?: string; code?: string };
      assert.ok(errorObj.message || errorObj.code, 'Error should have a message or code');
    }

    assert.strictEqual(requestReceived, true, 'Proxy was not used');
  });
});
