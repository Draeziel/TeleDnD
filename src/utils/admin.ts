export function getAdminTelegramIds(): Set<string> {
  const raw = process.env.TELEGRAM_ADMIN_IDS || '';

  return new Set(
    raw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => /^\d+$/.test(value))
  );
}

export function isTelegramAdmin(telegramUserId: string): boolean {
  return getAdminTelegramIds().has(telegramUserId);
}
