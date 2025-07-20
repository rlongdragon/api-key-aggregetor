# Technology Stack

## Core Technologies

- **TypeScript**: Primary language for extension and server code
- **Node.js**: Runtime environment (version 20.x recommended)
- **Express.js**: HTTP server framework for the proxy server
- **React**: Frontend framework for the webview UI
- **VS Code Extension API**: Integration with VS Code ecosystem

## Build System

- **TypeScript Compiler**: Main compilation with `tsc`
- **Webpack**: Bundling for React webview UI
- **ESLint**: Code linting with TypeScript rules
- **ts-loader**: TypeScript loading for Webpack

## Key Dependencies

### Server/Extension
- `@google/genai`: Google Gemini API client
- `express`: HTTP server framework
- `pino`: Structured logging
- `dotenv`: Environment variable management
- `https-proxy-agent`, `socks-proxy-agent`: Proxy support
- `ngrok`: Tunneling support

### WebView UI
- `react`, `react-dom`: UI framework
- `webpack`: Module bundler
- `css-loader`, `style-loader`: CSS processing

## Common Commands

### Development
```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode (auto-recompile)
npm run watch

# Lint code
npm run lint
```

### Testing
```bash
# Setup test environment
npm run test:setup

# Run all tests
npm test

# Run proxy tests with real data
npm run test:proxy

# Run integration tests
npm run test:integration
```

### Building
```bash
# Prepare for publishing
npm run vscode:prepublish

# Package extension
vsce package
```

## Configuration Files

- `tsconfig.json`: TypeScript configuration with Node16 modules
- `eslint.config.mjs`: ESLint rules for TypeScript
- `package.json`: Extension manifest and dependencies
- `src/webview-ui/webpack.config.js`: Webpack config for React UI
- `.env`: Environment variables for testing (not committed)