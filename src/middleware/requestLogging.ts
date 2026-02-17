import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import logger from '../utils/logger';

function normalizePath(path: string) {
  return path || '/';
}

export function requestLoggingMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startedAt = Date.now();
    const providedRequestId = req.header('x-request-id');
    const requestId = providedRequestId && providedRequestId.trim() ? providedRequestId.trim() : crypto.randomUUID();

    (res.locals as any).requestId = requestId;
    res.setHeader('x-request-id', requestId);

    const method = req.method;
    const path = normalizePath(req.originalUrl || req.url);

    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      const contentLength = res.getHeader('content-length');

      logger.info('http_request', {
        requestId,
        method,
        path,
        statusCode: res.statusCode,
        durationMs,
        contentLength: contentLength ? String(contentLength) : undefined,
        userAgent: req.get('user-agent') || undefined,
        ip: req.ip,
      });
    });

    next();
  };
}

export default requestLoggingMiddleware;
