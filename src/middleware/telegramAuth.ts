import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

interface TelegramUserPayload {
  id?: number;
  username?: string;
}

function safeCompareHex(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return crypto.timingSafeEqual(left, right);
}

function parseUser(rawUser: string | null): TelegramUserPayload | null {
  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser) as TelegramUserPayload;
  } catch {
    return null;
  }
}

function verifyTelegramInitData(initData: string, botToken: string): TelegramUserPayload | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');

  if (!hash) {
    return null;
  }

  params.delete('hash');

  const dataCheckString = Array.from(params.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expectedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (!safeCompareHex(expectedHash, hash)) {
    return null;
  }

  const maxAgeSeconds = Number(process.env.TELEGRAM_INITDATA_MAX_AGE_SEC || '86400');
  const authDateRaw = params.get('auth_date');

  if (authDateRaw && Number.isFinite(maxAgeSeconds) && maxAgeSeconds > 0) {
    const authDate = Number(authDateRaw);

    if (!Number.isNaN(authDate)) {
      const now = Math.floor(Date.now() / 1000);
      if (now - authDate > maxAgeSeconds) {
        return null;
      }
    }
  }

  return parseUser(params.get('user'));
}

export function telegramAuthMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const requireAuth = process.env.REQUIRE_TELEGRAM_AUTH === 'true';
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const initDataHeader = req.header('x-telegram-init-data');

    if (!botToken) {
      if (requireAuth) {
        res.status(500).json({ message: 'Telegram auth is enabled but TELEGRAM_BOT_TOKEN is not configured' });
        return;
      }

      next();
      return;
    }

    if (!initDataHeader) {
      if (requireAuth) {
        res.status(401).json({ message: 'Missing Telegram initData' });
        return;
      }

      next();
      return;
    }

    const telegramUser = verifyTelegramInitData(initDataHeader, botToken);

    if (!telegramUser || !telegramUser.id) {
      res.status(401).json({ message: 'Invalid Telegram initData signature' });
      return;
    }

    res.locals.telegramUserId = String(telegramUser.id);
    next();
  };
}
