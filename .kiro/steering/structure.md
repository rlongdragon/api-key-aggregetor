# Project Structure

## Root Directory

- **src/**: Main source code directory
- **out/**: Compiled TypeScript output (generated)
- **dist/**: Distribution files including bundled webview UI
- **scripts/**: Build and setup scripts
- **node_modules/**: Dependencies (generated)

## Source Code Organization

### Extension Entry Point
- **src/extension.ts**: Main VS Code extension entry point, handles activation/deactivation and command registration

### Server Architecture
- **src/server/**: Express.js proxy server implementation
  - **config/**: Configuration management (port, proxy settings)
  - **core/**: Core business logic classes
  - **middlewares/**: Express middleware (logging, error handling)
  - **routes/**: HTTP route handlers
  - **types/**: TypeScript type definitions

### Core Components
- **src/server/core/ApiKeyManager.ts**: Manages API key lifecycle and selection
- **src/server/core/ProxyPoolManager.ts**: Manages proxy server pool
- **src/server/core/ProxyAssignmentManager.ts**: Handles proxy-to-key assignments
- **src/server/core/RequestDispatcher.ts**: Routes requests to appropriate handlers
- **src/server/core/GoogleApiForwarder.ts**: Forwards requests to Google Gemini API
- **src/server/core/StreamHandler.ts**: Handles streaming responses

### WebView UI
- **src/webview-ui/**: React-based management interface
  - **src/**: React components and application logic
  - **public/**: Static HTML template
  - **webpack.config.js**: Bundling configuration

### Testing
- **src/test/**: Test files
  - **integration/**: Integration tests
  - **proxy-*.test.ts**: Proxy-specific tests
  - **extension.test.ts**: Extension functionality tests

## Configuration Files

- **package.json**: Extension manifest, dependencies, and VS Code contribution points
- **tsconfig.json**: TypeScript compilation settings
- **eslint.config.mjs**: Code linting rules
- **.env**: Environment variables for testing (not committed)
- **.gitignore**: Git ignore patterns

## Build Artifacts

- **out/**: Compiled TypeScript files
- **dist/webview-ui/**: Bundled React application for webview

## Key Conventions

- TypeScript files use PascalCase for classes and camelCase for functions/variables
- Core business logic separated into focused manager classes
- Event-driven architecture using EventManager for component communication
- Persistent storage via VS Code SecretStorage API
- Modular proxy system with dedicated assignment per API key