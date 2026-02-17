import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import characterRoutes from './routes/characterRoutes';
import draftRoutes from './routes/draftRoutes';
import errorHandler from './middleware/errorHandler';

const app = express();
const prisma = new PrismaClient();

app.use(express.json());
app.use(cors());
app.use('/api/characters', characterRoutes(prisma));
app.use('/api/drafts', draftRoutes(prisma));
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