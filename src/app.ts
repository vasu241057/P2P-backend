import express from "express";
import { PrismaClient } from "@prisma/client";
import http from "http";
import { WebSocketServer } from "ws";
import connectionRoutes from "./routes/connectionRoutes";
// import fileTransferRoutes from "./routes/fileTransferRoutes";
import { setupWebSocket } from "./services/websocketService";
import { errorHandler } from "./middlewares/errorHandler";

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

app.use("/connections", connectionRoutes);
// app.use("/file-transfer", fileTransferRoutes);

app.use(errorHandler);

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
setupWebSocket(wss);

export { server };
