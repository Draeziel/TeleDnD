import axios from 'axios';
import { getTelegramWebApp } from '../telegram/webApp';
import { getTelegramUserId } from '../telegram/webApp';

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
