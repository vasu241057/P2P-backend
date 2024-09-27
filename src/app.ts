import express from "express";
import { PrismaClient } from "@prisma/client";
import http from "http";
import { WebSocketServer } from "ws";
import connectionRoutes from "./routes/connectionRoutes";
// import fileTransferRoutes from "./routes/fileTransferRoutes";
import { setupWebSocket } from "./services/websocketService";
import { errorHandler } from "./middlewares/errorHandler";
import cors from "cors";

const app = express();
app.use(
  cors({
    origin: "http://localhost:5173", // Replace with your frontend's actual origin if different
    optionsSuccessStatus: 200,
  })
);
const prisma = new PrismaClient();

app.use(express.json());

app.use("/connections", connectionRoutes);
// app.use("/file-transfer", fileTransferRoutes);

app.use(errorHandler);

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
setupWebSocket(wss);

export { server };
