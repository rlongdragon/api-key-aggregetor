import { Router, Request, Response, NextFunction } from 'express';
import ApiKeyManager from '../core/ApiKeyManager';
import RequestDispatcher from '../core/RequestDispatcher';
import GoogleApiForwarder, { GoogleApiError } from '../core/GoogleApiForwarder';
import { StreamHandler } from '../core/StreamHandler';
import config from '../config';
// Removed import of GenerateContentResponse as we're now using @google/genai
import { eventManager, RequestStatus, EventManager } from "../core/EventManager"; // 引入 eventManager, RequestStatus 和 EventManager

// 修改为导出一个函数，接受依赖作为参数
export default function createProxyRouter(
  apiKeyManager: ApiKeyManager,
  requestDispatcher: RequestDispatcher,
  googleApiForwarder: GoogleApiForwarder,
  streamHandler: StreamHandler,
  eventManager: EventManager // 新增参数
): Router {
  const router = Router();

  // 定义代理路由，匹配 Gemini API 的 generateContent 路径
  // 定义代理路由，匹配 Gemini API 的 models/{model}:{method} 路径
  // 使用正则表达式捕获 model 和 method
  router.post(/^\/v1beta\/models\/([^:]+):([^:]+)$/, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestId = Date.now().toString() + Math.random().toString(36).substring(2, 9); // 生成唯一請求 ID
    let apiKey = null;
    let requestStatus: RequestStatus = {
        requestId: requestId,
        keyId: 'unknown', // 初始未知，稍後更新
        modelId: req.params[0],
        methodName: req.params[1],
        status: 'pending',
        startTime: Date.now(),
    };

    try {
      // 从正则表达式捕获组中提取 modelId 和 methodName
      const modelId = req.params[0]; // 第一个捕获组是 modelId
      const methodName = req.params[1]; // 第二个捕获组是 methodName
      const requestBody = req.body; // 获取请求体

      // 验证方法名是否是 generateContent 或 streamGenerateContent
      if (methodName !== 'generateContent' && methodName !== 'streamGenerateContent') {
         console.warn(`ProxyRoute: 不支持的 API 方法: ${methodName}`);
         res.status(400).json({
            error: {
               code: 400,
               message: `Bad Request: Unsupported API method "${methodName}". Only "generateContent" and "streamGenerateContent" are supported.`,
               status: 'INVALID_ARGUMENT',
            },
         });
         requestStatus.status = "failed";
         requestStatus.endTime = Date.now();
         requestStatus.errorMessage = `Unsupported API method "${methodName}"`;
         eventManager.emitRequestUpdate(requestStatus); // 發送失敗狀態
         return; // 结束请求处理
      }


      // 1. 获取可用 API Key
      console.log('ProxyRoute: Calling requestDispatcher.selectApiKey()...');
      apiKey = await requestDispatcher.selectApiKey();
      if (apiKey) {
        requestStatus.keyId = apiKey.keyId; // 更新 keyId
        eventManager.emitRequestUpdate(requestStatus); // 發送 pending 狀態
        // 不需要再次發送 requestUpdate，因為 pending 狀態已經發送，後續會直接更新為 success/failed/cooling_down
      }
      console.log('ProxyRoute: requestDispatcher.selectApiKey() returned:', apiKey ? 'a key' : 'no key');

      if (!apiKey) {
        // 没有可用 Key
        console.warn('ProxyRoute: 没有可用的 API Key，返回 503。');
        res.status(503).json({
          error: {
            code: 503,
            message: 'Service Unavailable: No available API keys.',
            status: 'UNAVAILABLE',
          },
        });
        requestStatus.status = "failed";
        requestStatus.endTime = Date.now();
        requestStatus.errorMessage = 'No available API keys.';
        eventManager.emitRequestUpdate(requestStatus); // 發送失敗狀態
        return; // 结束请求处理
      }

      console.info(`ProxyRoute: 使用 Key ${apiKey.key} 处理请求。`);
      // 可选：增加 Key 的当前请求计数
      // apiKeyManager.incrementRequestCount(apiKey.key);

      // 2. 转发请求到 Google API
      // 调用 forwardRequest 时传递 modelId, methodName 和 requestBody
      const forwardResult = await googleApiForwarder.forwardRequest(modelId, methodName, requestBody, apiKey);

      // 可选：减少 Key 的当前请求计数 (无论成功或失败，请求结束时都应减少)
      if (apiKey) {
        apiKeyManager.decrementRequestCount(apiKey.key);
      }


      if (forwardResult.error) {
        // 处理转发过程中发生的错误
        const err = forwardResult.error;
        console.error(`ProxyRoute: 转发请求时发生错误 (${apiKey.key}):`, err.message);
        requestStatus.endTime = Date.now();
        requestStatus.errorMessage = err.message;

        if (err.isRateLimitError) {
          // 如果是速率限制错误，标记 Key 冷却
          apiKeyManager.markAsCoolingDown(apiKey!.key, config.KEY_COOL_DOWN_DURATION_MS);
          // TODO: 实现可选的重试逻辑
          requestStatus.status = "cooling_down";
          requestStatus.coolDownDuration = config.KEY_COOL_DOWN_DURATION_MS;
          eventManager.emitRequestUpdate(requestStatus); // 發送冷卻狀態
          // 目前将错误传递给错误处理中间件
          next(err);
        } else if (err.statusCode === 401 || err.statusCode === 403) {
           // 认证错误，标记 Key 为 disabled (如果需要持久化状态，这里需要更多逻辑)
           // apiKeyManager.markAsDisabled(apiKey.key); // 假设有一个 markAsDisabled 方法
           console.error(`ProxyRoute: Key ${apiKey.key} 认证失败。`);
           requestStatus.status = "failed";
           eventManager.emitRequestUpdate(requestStatus); // 發送失敗狀態
           next(err); // 将错误传递给错误处理中间件
        }
        else {
          // 其他 Google API 错误，将错误传递给错误处理中间件
          requestStatus.status = "failed";
          eventManager.emitRequestUpdate(requestStatus); // 發送失敗狀態
          next(err);
        }

      } else if (forwardResult.stream) {
        // 处理流式响应
        console.info(`ProxyRoute: 处理流式响应 (${apiKey.key})`);
        // 调用 StreamHandler 处理流
        // 处理 AsyncIterable 并将其内容发送到响应
        // 设置响应头为 Server-Sent Events
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // 处理 AsyncIterable 并将其内容格式化为 SSE 发送
        console.info(`ProxyRoute: 开始处理流式数据 (${apiKey.key})`);
        for await (const chunk of forwardResult.stream) {
          // 将 chunk 转换为 JSON 字符串
          const data = JSON.stringify(chunk);
          // 格式化为 SSE 事件
          res.write(`data: ${data}\n\n`);
        }
        console.info(`ProxyRoute: 流式数据处理完毕 (${apiKey.key})`);
        // 流处理完毕，发送一个结束事件 (可选，取决于客户端如何处理)
        // res.write('event: end\ndata: {}\n\n');
        requestStatus.status = "success";
        requestStatus.endTime = Date.now();
        eventManager.emitRequestUpdate(requestStatus); // 發送成功狀態
        // 新增：更新金鑰使用歷史
        if (apiKey) {
          await apiKeyManager.addKeyHistoryEntry(apiKey.key, {
            date: Date.now(),
            rate: 15,
            serverCurrentTime: Date.now(), // 新增：記錄伺服器當前時間
          }); // 暫定 rate 為 1
        }
        res.end(); // 结束响应

      } else if (forwardResult.response) {
        // 处理非流式响应
        console.info(`ProxyRoute: 处理非流式响应 (${apiKey.key})`);
        // 直接将 Google API 返回的响应体发送给客户端
        requestStatus.status = "success";
        requestStatus.endTime = Date.now();
        eventManager.emitRequestUpdate(requestStatus); // 發送成功狀態
        // 新增：更新金鑰使用歷史
        if (apiKey) {
          await apiKeyManager.addKeyHistoryEntry(apiKey.key, {
            date: Date.now(),
            rate: 15,
            serverCurrentTime: Date.now(), // 新增：記錄伺服器當前時間
          }); // 暫定 rate 為 15
        }
        res.json(forwardResult.response);
      } else {
         // 未知情况
         console.error(`ProxyRoute: 未知转发结果 (${apiKey.key})`);
         res.status(500).json({
            error: {
              code: 500,
              message: 'Unknown forwarding result.',
              status: 'INTERNAL',
            },
         });
         requestStatus.status = "failed";
         requestStatus.endTime = Date.now();
         requestStatus.errorMessage = 'Unknown forwarding result.';
         eventManager.emitRequestUpdate(requestStatus); // 發送失敗狀態
      }

    } catch (error: unknown) {
      // 捕获其他潜在错误 (如 KeyManager 或 Dispatcher 错误)
      requestStatus.status = 'failed';
      requestStatus.endTime = Date.now();
      requestStatus.errorMessage = (error as any).message || 'Unknown error';
      eventManager.emitRequestUpdate(requestStatus); // 發送失敗狀態
      console.error('ProxyRoute: 处理请求时发生未捕获的错误:', error);
      next(error); // 传递给错误处理中间件
    }
  });

  return router; // 返回配置好的 router
}