# Product Overview

## Gemini API Key Aggregator Proxy Plus

A VS Code extension that aggregates multiple Google Gemini API keys with dedicated proxy support to bypass rate limits and improve concurrency for AI-powered extensions like Cline, Roo Code, and Continue.

## Core Features

- **Multi-API Key Management**: Add, modify, and delete multiple Gemini API keys with automatic round-robin distribution
- **Advanced Proxy System**: Dedicated proxy per API key with automatic load balancing and health monitoring
- **Real-time Management**: Live proxy status updates, performance monitoring, and interactive management panel
- **VS Code Integration**: Seamless integration with VS Code SecretStorage and command palette

## Target Users

Developers using AI-powered VS Code extensions who need to:
- Bypass Google Gemini API rate limits
- Improve request concurrency and reliability
- Manage multiple API keys efficiently
- Use proxy servers for geographic distribution or network requirements

## Architecture

The extension runs an embedded Express.js proxy server on port 3146 that:
- Intercepts API requests from AI extensions
- Distributes requests across multiple API keys
- Routes requests through assigned proxy servers
- Provides a React-based management interface via VS Code webview