import axios from 'axios';
import { getTelegramWebApp } from '../telegram/webApp';

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

  if (initData) {
    config.headers = config.headers || {};
    config.headers['x-telegram-init-data'] = initData;
  }

  return config;
});
