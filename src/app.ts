import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import characterRoutes from './routes/characterRoutes';
import draftRoutes from './routes/draftRoutes';
import sessionRoutes from './routes/sessionRoutes';
import errorHandler from './middleware/errorHandler';
import { telegramAuthMiddleware } from './middleware/telegramAuth';
import { requestLoggingMiddleware } from './middleware/requestLogging';

const app = express();
const prisma = new PrismaClient();

const apiRateLimitWindowMs = Number(process.env.API_RATE_LIMIT_WINDOW_MS || 60_000);
const apiRateLimitMax = Number(process.env.API_RATE_LIMIT_MAX || 120);

const apiLimiter = rateLimit({
    windowMs: apiRateLimitWindowMs,
    max: apiRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many requests. Please try again later.',
    },
});

app.set('trust proxy', 1);
app.use(express.json());
app.use(cors());
app.use(requestLoggingMiddleware());
app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.use('/api', apiLimiter);
app.use('/api/characters', characterRoutes(prisma));
app.use('/api/drafts', telegramAuthMiddleware());
app.use('/api/drafts', draftRoutes(prisma));
app.use('/api/sessions', telegramAuthMiddleware());
app.use('/api/sessions', sessionRoutes(prisma));
app.use(errorHandler);

const startServer = async () => {
    try {
        await prisma.$connect();
        console.log('Connected to the database');
    } catch (error) {
        console.error('Database connection error:', error);
        process.exit(1);
    }
};

export { app, startServer };