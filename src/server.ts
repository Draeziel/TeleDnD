import express from 'express';
import { createServer } from 'http';
import { app, startServer } from './app';

const PORT = process.env.PORT || 3000;

const server = createServer(app);

server.listen(PORT, async () => {
  await startServer();
  console.log(`Server is running on http://localhost:${PORT}`);
});