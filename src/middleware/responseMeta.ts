import { Request, Response, NextFunction } from 'express';

export function responseMetaMiddleware() {
  return (_req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = ((body: unknown) => {
      const requestId = res.locals.requestId;

      if (
        requestId &&
        body !== null &&
        typeof body === 'object' &&
        !Array.isArray(body) &&
        !(body instanceof Date) &&
        !(body instanceof Buffer)
      ) {
        const objectBody = body as Record<string, unknown>;

        if (objectBody.requestId === undefined) {
          return originalJson({
            ...objectBody,
            requestId,
          });
        }
      }

      return originalJson(body);
    }) as Response['json'];

    next();
  };
}

export default responseMetaMiddleware;
