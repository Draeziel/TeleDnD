import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
    const requestId = (res.locals as any).requestId;
    logger.error('unhandled_error', {
        requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        message: err.message,
        stack: err.stack,
    });

    res.status((err as any).status || 500).json({
        message: err.message || 'Internal Server Error',
        requestId,
        error: process.env.NODE_ENV === 'development' ? err : {},
    });
};

export default errorHandler;