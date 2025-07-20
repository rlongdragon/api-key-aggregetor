#!/usr/bin/env node

import * as http from 'http';
import * as https from 'https';
import * as url from 'url';

/**
 * Simple HTTP proxy server for testing
 * This creates a basic proxy that can be used for testing when real proxies aren't available
 */
class TestProxyServer {
  private server: http.Server;
  private port: number;
  private requestCount: number = 0;
  private errorRate: number = 0; // 0-1, probability of returning an error

  constructor(port: number, errorRate: number = 0) {
    this.port = port;
    this.errorRate = errorRate;
    this.server = http.createServer();
    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.on('request', (req, res) => {
      this.handleRequest(req, res);
    });

    this.server.on('connect', (req, clientSocket, head) => {
      this.handleConnect(req, clientSocket, head);
    });
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    this.requestCount++;
    console.log(`[Proxy:${this.port}] HTTP Request #${this.requestCount}: ${req.method} ${req.url}`);

    // Simulate random errors
    if (Math.random() < this.errorRate) {
      console.log(`[Proxy:${this.port}] Simulating error for request #${this.requestCount}`);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Proxy Error: Simulated failure');
      return;
    }

    if (!req.url) {
      res.writeHead(400);
      res.end('Bad Request');
      return;
    }

    const parsedUrl = url.parse(req.url);
    const targetHost = parsedUrl.hostname;
    const targetPort = parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80);
    const targetPath = parsedUrl.path;

    if (!targetHost) {
      res.writeHead(400);
      res.end('Bad Request: No target host');
      return;
    }

    // Forward the request
    const options = {
      hostname: targetHost,
      port: targetPort,
      path: targetPath,
      method: req.method,
      headers: { ...req.headers }
    };

    // Remove proxy-specific headers
    delete options.headers['proxy-connection'];
    delete options.headers['proxy-authorization'];

    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    const proxyReq = protocol.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error(`[Proxy:${this.port}] Request error:`, err.message);
      res.writeHead(500);
      res.end('Proxy Error: ' + err.message);
    });

    req.pipe(proxyReq);
  }

  private handleConnect(req: http.IncomingMessage, clientSocket: NodeJS.Socket, head: Buffer) {
    this.requestCount++;
    console.log(`[Proxy:${this.port}] CONNECT Request #${this.requestCount}: ${req.url}`);

    // Simulate random errors
    if (Math.random() < this.errorRate) {
      console.log(`[Proxy:${this.port}] Simulating CONNECT error for request #${this.requestCount}`);
      clientSocket.write('HTTP/1.1 500 Proxy Error\r\n\r\n');
      clientSocket.end();
      return;
    }

    if (!req.url) {
      clientSocket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      clientSocket.end();
      return;
    }

    const [hostname, port] = req.url.split(':');
    const targetPort = parseInt(port) || 443;

    const serverSocket = new (require('net').Socket)();
    
    serverSocket.connect(targetPort, hostname, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      serverSocket.write(head);
      serverSocket.pipe(clientSocket);
      clientSocket.pipe(serverSocket);
    });

    serverSocket.on('error', (err: Error) => {
      console.error(`[Proxy:${this.port}] CONNECT error:`, err.message);
      clientSocket.write('HTTP/1.1 500 Connection Error\r\n\r\n');
      clientSocket.end();
    });

    clientSocket.on('error', (err: Error) => {
      console.error(`[Proxy:${this.port}] Client socket error:`, err.message);
      serverSocket.destroy();
    });
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, () => {
        console.log(`🔗 Test proxy server started on port ${this.port}`);
        console.log(`   Error rate: ${(this.errorRate * 100).toFixed(1)}%`);
        resolve();
      });

      this.server.on('error', (err) => {
        console.error(`❌ Failed to start proxy server on port ${this.port}:`, err.message);
        reject(err);
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        console.log(`🛑 Test proxy server on port ${this.port} stopped`);
        console.log(`   Total requests handled: ${this.requestCount}`);
        resolve();
      });
    });
  }

  public getStats() {
    return {
      port: this.port,
      requestCount: this.requestCount,
      errorRate: this.errorRate
    };
  }
}

/**
 * Start multiple test proxy servers
 */
async function startTestProxies(ports: number[] = [8080, 8081, 8082], errorRates: number[] = [0, 0.1, 0.2]) {
  const proxies: TestProxyServer[] = [];
  
  console.log('🚀 Starting test proxy servers...\n');
  
  for (let i = 0; i < ports.length; i++) {
    const port = ports[i];
    const errorRate = errorRates[i] || 0;
    
    try {
      const proxy = new TestProxyServer(port, errorRate);
      await proxy.start();
      proxies.push(proxy);
    } catch (error) {
      console.error(`Failed to start proxy on port ${port}:`, error);
    }
  }
  
  if (proxies.length > 0) {
    console.log(`\n✅ Started ${proxies.length} test proxy servers`);
    console.log('📋 Proxy URLs for testing:');
    proxies.forEach(proxy => {
      const stats = proxy.getStats();
      console.log(`   http://localhost:${stats.port} (error rate: ${(stats.errorRate * 100).toFixed(1)}%)`);
    });
    
    console.log('\n💡 Add these to your .env file as PROXY_SERVERS:');
    const proxyUrls = proxies.map(proxy => `http://localhost:${proxy.getStats().port}`);
    console.log(`PROXY_SERVERS=${proxyUrls.join(',')}`);
  }
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down test proxy servers...');
    
    for (const proxy of proxies) {
      await proxy.stop();
    }
    
    console.log('✅ All proxy servers stopped');
    process.exit(0);
  });
  
  return proxies;
}

// Run proxy servers if this file is executed directly
if (require.main === module) {
  const ports = process.argv.slice(2).map(p => parseInt(p)).filter(p => !isNaN(p));
  const defaultPorts = ports.length > 0 ? ports : [8080, 8081, 8082];
  
  startTestProxies(defaultPorts).catch(console.error);
}

export { TestProxyServer, startTestProxies };