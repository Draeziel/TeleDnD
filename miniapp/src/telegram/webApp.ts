import type { TelegramWebApp } from '../types/telegram';

const TEST_TELEGRAM_USER_ID_KEY = 'miniapp_test_telegram_user_id';

export function getTelegramWebApp(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp;
}

export function initTelegramWebApp(): { isTelegram: boolean } {
  const webApp = getTelegramWebApp();

  if (!webApp) {
    return { isTelegram: false };
  }

  webApp.ready();
  webApp.expand();
  return { isTelegram: true };
}

export function getTelegramUserId(): string | null {
  const fromTelegram = getTelegramWebApp()?.initDataUnsafe?.user?.id;

  if (fromTelegram) {
    return String(fromTelegram);
  }

  try {
    return localStorage.getItem(TEST_TELEGRAM_USER_ID_KEY);
  } catch {
    return null;
  }
}

export function setTestTelegramUserId(userId: string): void {
  try {
    localStorage.setItem(TEST_TELEGRAM_USER_ID_KEY, userId);
  } catch {
    return;
  }
}

export function getTestTelegramUserId(): string {
  try {
    return localStorage.getItem(TEST_TELEGRAM_USER_ID_KEY) || '';
  } catch {
    return '';
  }
}

export function showConfirm(message: string): Promise<boolean> {
  const webApp = getTelegramWebApp();

  if (webApp?.showConfirm) {
    return new Promise((resolve) => {
      webApp.showConfirm?.(message, (confirmed) => resolve(Boolean(confirmed)));
    });
  }

  return Promise.resolve(window.confirm(message));
}
