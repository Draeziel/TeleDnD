import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import logger from '../utils/logger';

function normalizePath(path: string) {
  return path || '/';
}

function getRoutePattern(req: Request) {
  const routePath = (req as any).route?.path;
  if (!routePath) {
    return undefined;
  }

  return `${req.baseUrl || ''}${routePath}`;
}

export function requestLoggingMiddleware() {
  const slowMs = Number(process.env.REQUEST_SLOW_MS || '1200');

  return (req: Request, res: Response, next: NextFunction) => {
    const startedAt = Date.now();
    const providedRequestId = req.header('x-request-id');
    const requestId = providedRequestId && providedRequestId.trim() ? providedRequestId.trim() : crypto.randomUUID();

    res.locals.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    const method = req.method;
    const path = normalizePath(req.originalUrl || req.url);

    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      const contentLength = res.getHeader('content-length');
      const routePattern = getRoutePattern(req);

      const logPayload = {
        requestId,
        method,
        path,
        routePattern,
        statusCode: res.statusCode,
        durationMs,
        contentLength: contentLength ? String(contentLength) : undefined,
        userAgent: req.get('user-agent') || undefined,
        ip: req.ip,
        hasTelegramInitData: Boolean(req.header('x-telegram-init-data')),
      };

      logger.info('http_request', logPayload);

      if (Number.isFinite(slowMs) && durationMs >= slowMs) {
        logger.warn('http_request_slow', {
          ...logPayload,
          thresholdMs: slowMs,
        });
      }
    });

    next();
  };
}

export default requestLoggingMiddleware;
