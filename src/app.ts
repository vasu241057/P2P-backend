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
const allowedOrigins = [
  "http://localhost:5173", // Local development
  "https://p2-p-frontend.vercel.app", // Your Vercel deployment
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        var msg =
          "The CORS policy for this site does not allow access from the specified Origin.";
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    optionsSuccessStatus: 200,
    credentials: true, // Allow credentials (cookies, authorization headers, etc.)
  })
);
const prisma = new PrismaClient();

app.use(express.json());

app.use("/connections", connectionRoutes);
app.use("/", (req, res) => {
  res.send("Hello World!");
});
// app.use("/file-transfer", fileTransferRoutes);

app.use(errorHandler);

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
setupWebSocket(wss);

export { server };
