import { Response } from 'express';

/**
 * 处理 Google API 的流式响应，并实时转发给客户端。
 */
export class StreamHandler {

  /**
   * 处理 Google API 的响应流 (AsyncIterable)。
   * @param googleStream 从 Google API 收到的响应流 (AsyncIterable)。
   * @param clientResponse 发送给客户端的 Express 响应对象。
   */
  public async handleStream(googleStream: AsyncIterable<unknown>, clientResponse: Response): Promise<void> {
    // 设置响应头，表明是流式响应 (Server-Sent Events)
    clientResponse.setHeader('Content-Type', 'text/event-stream');
    clientResponse.setHeader('Cache-Control', 'no-cache');
    clientResponse.setHeader('Connection', 'keep-alive');
    clientResponse.setHeader('X-Accel-Buffering', 'no'); // Nginx 等代理可能需要此头来禁用缓冲

    try {
      for await (const chunk of googleStream) {
        // 将每个数据块转换为适合 SSE 的格式并写入客户端响应流
        // Google SDK 的 generateContentStream 返回的是 GenerateContentResponse 对象
        // 这里将其转换为 JSON 字符串，客户端需要解析
        clientResponse.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      // 流结束
      clientResponse.end();
    } catch (error: unknown) {
      console.error('Error processing Google API stream:', error);
      // 处理流处理过程中的错误
      if (!clientResponse.headersSent) {
        // 如果头部未发送，发送 500 错误响应
        clientResponse.status(500).json({
          error: {
            code: 500,
            message: 'Stream processing error.',
            status: 'INTERNAL',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      } else {
        // 如果头部已发送，尝试结束响应流
        clientResponse.end();
      }
    }

    // 可选：监听客户端断开连接事件，以便及时清理 Google API 流
    // AsyncIterable 通常没有 destroy 方法，这里可能需要根据实际情况处理
    // 例如，如果底层是可销毁的 ReadableStream，可以尝试销毁
    clientResponse.on('close', () => {
        console.log('Client disconnected.');
        // 在 AsyncIterable 的情况下，没有直接的 destroy 方法
        // 如果需要取消底层操作，可能需要在 GoogleApiForwarder 中实现取消逻辑并传递给这里
    });
  }
}