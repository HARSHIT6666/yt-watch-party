import dns from 'dns'
dns.setServers(['1.1.1.1' ,'8.8.8.8'])

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { connectDatabase } from './config/db.js';
import { registerRoomHandlers } from './sockets/roomHandlers.js';
import { findRoom, publicState } from './services/roomService.js';

const app = express();
const server = http.createServer(app);
const clientUrl = process.env.CLIENT_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173';
const allowedOrigins = [...new Set([clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'])];

const io = new Server(server, { cors: { origin: allowedOrigins, methods: ['GET', 'POST'] } });

app.use(cors({ origin: allowedOrigins })); app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/api/rooms/:roomId', async (req, res) => { const room = await findRoom(req.params.roomId.toUpperCase());
     if (!room) 
        return res.status(404).json({ message: 'Room not found' });
    res.json(publicState(room)); });
io.on('connection', socket => registerRoomHandlers(io, socket));



const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');

app.use(express.static(clientDist));
app.get('*', (req, res, next) => req.path.startsWith('/api') ? next() : res.sendFile(path.join(clientDist, 'index.html')));

await connectDatabase(process.env.MONGODB_URI);
const port = process.env.PORT || 5000;

server.listen(port, () => console.log(`YT Watch Party server listening on ${port}`));
