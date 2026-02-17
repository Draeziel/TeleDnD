import { useEffect, useMemo, useState } from 'react';
import {
  getTelegramUserId,
  getTestTelegramUserId,
  initTelegramWebApp,
  setTestTelegramUserId,
} from '../telegram/webApp';

export function useTelegram() {
  const [isTelegram, setIsTelegram] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [testUserId, setTestUserId] = useState(getTestTelegramUserId());

  useEffect(() => {
    const result = initTelegramWebApp();
    setIsTelegram(result.isTelegram);
    setUserId(getTelegramUserId());
  }, []);

  const saveTestUserId = (value: string) => {
    setTestTelegramUserId(value);
    setTestUserId(value);
    setUserId(getTelegramUserId());
  };

  return useMemo(
    () => ({
      isTelegram,
      userId,
      testUserId,
      saveTestUserId,
    }),
    [isTelegram, userId, testUserId]
  );
}
