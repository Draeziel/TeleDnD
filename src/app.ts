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
import { responseMetaMiddleware } from './middleware/responseMeta';
import logger from './utils/logger';

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
app.use(responseMetaMiddleware());
app.get('/healthz', (_req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'rpg-character-service',
        env: process.env.NODE_ENV || 'development',
        uptimeSec: Math.floor(process.uptime()),
        now: new Date().toISOString(),
    });
});

app.get('/readyz', async (_req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.status(200).json({
            status: 'ready',
            checks: {
                database: 'ok',
            },
            now: new Date().toISOString(),
        });
    } catch {
        res.status(503).json({
            status: 'not_ready',
            checks: {
                database: 'error',
            },
            now: new Date().toISOString(),
        });
    }
});

app.use('/api', apiLimiter);
app.use('/api/characters', characterRoutes(prisma));
app.use('/api/drafts', telegramAuthMiddleware());
app.use('/api/drafts', draftRoutes(prisma));
app.use('/api/sessions', telegramAuthMiddleware());
app.use('/api/sessions', sessionRoutes(prisma));
app.use(errorHandler);

function parsePositiveInt(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }

    return Math.floor(parsed);
}

function startSessionEventsCleanupTask(prismaClient: PrismaClient) {
    const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
    const enabledEnv = process.env.SESSION_EVENTS_CLEANUP_ENABLED;
    const enabled = enabledEnv ? enabledEnv === 'true' : nodeEnv !== 'test';

    if (!enabled) {
        logger.info('session_events_cleanup_disabled');
        return;
    }

    const retentionDays = parsePositiveInt(process.env.SESSION_EVENTS_RETENTION_DAYS, 30);
    const intervalMinutes = parsePositiveInt(process.env.SESSION_EVENTS_CLEANUP_INTERVAL_MIN, 60);
    const intervalMs = intervalMinutes * 60 * 1000;

    const runCleanup = async () => {
        const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

        try {
            const result = await prismaClient.sessionEvent.deleteMany({
                where: {
                    createdAt: {
                        lt: cutoff,
                    },
                },
            });

            logger.info('session_events_cleanup_run', {
                retentionDays,
                deletedCount: result.count,
                cutoff: cutoff.toISOString(),
            });
        } catch (error) {
            logger.error('session_events_cleanup_error', {
                retentionDays,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    };

    const timer = setInterval(() => {
        void runCleanup();
    }, intervalMs);

    timer.unref?.();

    logger.info('session_events_cleanup_started', {
        retentionDays,
        intervalMinutes,
    });

    void runCleanup();
}

const startServer = async () => {
    try {
        await prisma.$connect();

        const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
        const isProduction = nodeEnv === 'production';
        const requireAuthEnv = process.env.REQUIRE_TELEGRAM_AUTH;
        const requireAuth = requireAuthEnv ? requireAuthEnv === 'true' : isProduction;
        const fallbackEnv = process.env.ALLOW_TELEGRAM_USER_ID_FALLBACK;
        const allowFallback = !isProduction && (fallbackEnv ? fallbackEnv === 'true' : true);

        logger.info('startup_ready', {
            env: nodeEnv,
            requireTelegramAuth: requireAuth,
            allowTelegramUserIdFallback: allowFallback,
        });

        if (!isProduction && allowFallback) {
            logger.warn('startup_security_notice', {
                message: 'x-telegram-user-id fallback is enabled; use only in dev/test',
            });
        }

        startSessionEventsCleanupTask(prisma);
    } catch (error) {
        logger.error('database_connection_error', {
            error: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
    }
};

export { app, startServer };