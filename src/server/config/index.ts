import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// Conditionally import vscode only when available
let vscode: typeof import('vscode') | null = null;
try {
  vscode = require('vscode');
} catch (error) {
  // vscode module not available (e.g., in test environment)
  vscode = null;
}

// 定义配置接口
interface Config {
  PORT: number;
  KEY_COOL_DOWN_DURATION_MS: number;
  LOG_LEVEL: string;
  DISPATCH_STRATEGY: string;
  apiKeys: string[]; // 添加 apiKeys 属性
  ROTATING_PROXY?: string; // 添加旋转代理支持
  USE_ROTATING_PROXY: boolean; // 是否使用旋转代理模式
}

// 从环境变量中解析配置
const config: Config = {
  PORT: parseInt(process.env.PORT || '3146', 10),
  KEY_COOL_DOWN_DURATION_MS: parseInt(process.env.KEY_COOL_DOWN_DURATION_MS || '60000', 10),
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  DISPATCH_STRATEGY: process.env.DISPATCH_STRATEGY || 'round_robin',
  // 从 VS Code 配置中获取 API Keys (如果可用)
  apiKeys: vscode ? (vscode.workspace.getConfiguration('geminiAggregator-dev').get('apiKeys') || []) : [],
  // 旋转代理配置
  ROTATING_PROXY: process.env.ROTATING_PROXY,
  USE_ROTATING_PROXY: Boolean(process.env.ROTATING_PROXY && process.env.ROTATING_PROXY.trim() !== ''),
};

// 导出配置对象
export default config;