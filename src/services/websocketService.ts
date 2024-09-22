import { WebSocketServer, WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import prisma from "../prisma/client";

// Map to store connections based on passcode
const passcodeConnections = new Map<string, WebSocket[]>();

export function setupWebSocket(wss: WebSocketServer) {
  wss.on("connection", (ws) => {
    let totalChunks: number | null = null;

    ws.on("message", async (message) => {
      const parsedMessage = JSON.parse(message.toString());

      if (parsedMessage.type === "SET_PASSCODE") {
        const currentPasscode = parsedMessage.passcode;

        if (!passcodeConnections.has(currentPasscode)) {
          passcodeConnections.set(currentPasscode, []);
        }
        passcodeConnections.get(currentPasscode)?.push(ws);
        console.log(`User connected with passcode: ${currentPasscode}`);
      }

      if (parsedMessage.type === "TRANSFER_FILE") {
        const targetPasscode = parsedMessage.targetPasscode;
        const fileName = parsedMessage.fileName;
        const fileSize = parsedMessage.fileSize;
        const totalChunks = parsedMessage.totalChunks;

        const senderConnection = await prisma.connection.findUnique({
          where: { passcode: targetPasscode },
        });

        if (!senderConnection) {
          ws.send(
            JSON.stringify({
              type: "ERROR",
              message: "Sender connection not found",
            })
          );
          return;
        }

        // Create a new FileTransfer record in the database
        const transferId = uuidv4();
        await prisma.fileTransfer.create({
          data: {
            id: transferId,
            fileName,
            fileSize,
            totalChunks,
            status: "in_progress",
            Passcode: targetPasscode, // Add senderPasscode
            // Add receiverPasscode
            connection: {
              connect: { id: senderConnection.id },
            },
          },
        });

        // Forward the file transfer initiation message to the target
        const targetConnections = passcodeConnections.get(targetPasscode);
        if (targetConnections) {
          targetConnections.forEach((connection) => {
            if (connection !== ws) {
              connection.send(
                JSON.stringify({
                  type: "FILE_TRANSFER_INIT",
                  transferId,
                  fileName,
                  fileSize,
                  totalChunks,
                })
              );
            }
          });
        } else {
          ws.send(
            JSON.stringify({ type: "ERROR", message: "Target not connected" })
          );

          // Update the FileTransfer status to 'failed' if the target is not connected
          await prisma.fileTransfer.update({
            where: { id: transferId },
            data: { status: "failed" },
          });
        }
      }

      if (parsedMessage.type === "FILE_CHUNK") {
        const targetPasscode = parsedMessage.targetPasscode;
        const chunkData = parsedMessage.chunkData;
        const transferId = parsedMessage.transferId;
        const chunkNumber = parsedMessage.chunkNumber;

        // Forward the file chunk to the target
        const targetConnections = passcodeConnections.get(targetPasscode);
        if (targetConnections) {
          targetConnections.forEach((connection) => {
            if (connection !== ws) {
              connection.send(
                JSON.stringify({
                  type: "FILE_CHUNK_RECEIVED",
                  transferId,
                  chunkNumber,
                  chunkData,
                })
              );
            }
          });

          // Update the FileTransfer status to 'completed' if all chunks have been sent
          if (chunkNumber === totalChunks) {
            await prisma.fileTransfer.update({
              where: { id: transferId },
              data: { status: "completed" },
            });
          }
        }
      }

      // Handle more message types as needed
    });

    ws.on("close", () => {
      const passcode = (ws as any).passcode; // Retrieve passcode from WebSocket object

      if (passcode && passcodeConnections.has(passcode)) {
        const connections = passcodeConnections.get(passcode);
        if (connections) {
          const updatedConnections = connections.filter((conn) => conn !== ws);
          if (updatedConnections.length > 0) {
            passcodeConnections.set(passcode, updatedConnections);
          } else {
            passcodeConnections.delete(passcode);
          }
        }
      }
      console.log(`Connection closed for passcode: ${passcode}`);
    });
  });
}

export function getConnection(passcode: string): WebSocket[] | null {
  return passcodeConnections.get(passcode) || null;
}
