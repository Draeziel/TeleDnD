import axios from 'axios';
import { getTelegramWebApp } from '../telegram/webApp';
import { getTelegramUserId } from '../telegram/webApp';

type RetryableRequestConfig = {
  __retryCount?: number;
  __retryDelayMs?: number;
};

const baseURL = import.meta.env.VITE_API_URL || '/api';

export const http = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

http.interceptors.request.use((config) => {
  const initData = getTelegramWebApp()?.initData;
  const telegramUserId = getTelegramUserId();

  if (initData) {
    config.headers = config.headers || {};
    config.headers['x-telegram-init-data'] = initData;
  } else if (telegramUserId) {
    config.headers = config.headers || {};
    config.headers['x-telegram-user-id'] = telegramUserId;
  }

  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = (error?.config || {}) as RetryableRequestConfig & {
      method?: string;
      url?: string;
      timeout?: number;
    };

    const requestMethod = String(config.method || 'get').toUpperCase();
    const isIdempotentRead = requestMethod === 'GET' || requestMethod === 'HEAD';
    const status = error?.response?.status as number | undefined;
    const isTimeout = error?.code === 'ECONNABORTED';
    const isNetwork = !error?.response;
    const isRetryableStatus = status === 429 || (typeof status === 'number' && status >= 500);
    const shouldRetry = isIdempotentRead && (isNetwork || isTimeout || isRetryableStatus);

    const maxRetries = 3;
    config.__retryCount = config.__retryCount ?? 0;

    if (shouldRetry && config.__retryCount < maxRetries) {
      config.__retryCount += 1;
      const baseDelayMs = 350;
      const jitterMs = Math.floor(Math.random() * 120);
      const nextDelayMs = Math.min(baseDelayMs * (2 ** (config.__retryCount - 1)) + jitterMs, 2500);
      config.__retryDelayMs = nextDelayMs;

      await new Promise((resolve) => setTimeout(resolve, nextDelayMs));
      return http.request(config);
    }

    const requestId = error?.response?.data?.requestId || error?.response?.headers?.['x-request-id'];
    if (requestId) {
      (error as any).requestId = requestId;
    }

    (error as any).isNetworkError = isNetwork || isTimeout;

    return Promise.reject(error);
  }
);
