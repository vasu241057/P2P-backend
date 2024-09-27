import { WebSocketServer, WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import prisma from "../prisma/client";

// Map to store connections based on passcode
const passcodeConnections = new Map<string, WebSocket[]>();

export function setupWebSocket(wss: WebSocketServer) {
  wss.on("connection", (ws) => {
    let totalChunks: number | null = null;

    const connectionId = uuidv4();
    (ws as any).id = connectionId;
    console.log("websocket open");
    console.log("Connection ID:", (ws as any).id);

    ws.on("message", async (message) => {
      try {
        const parsedMessage = JSON.parse(message.toString());

        if (parsedMessage.type === "SET_PASSCODE") {
          const currentPasscode = parsedMessage.passcode;

          if (!passcodeConnections.has(currentPasscode)) {
            passcodeConnections.set(currentPasscode, []);
          }
          passcodeConnections.get(currentPasscode)?.push(ws);
          // Attach passcode to the WebSocket object
          (ws as any).passcode = currentPasscode;
          console.log(`User connected with passcode: ${currentPasscode}`);

          // Notify existing connections with the same passcode that a new peer has connected
          const existingConnections = passcodeConnections.get(currentPasscode);
          if (existingConnections) {
            existingConnections.forEach((connection) => {
              if (connection !== ws) {
                console.log(
                  `Notifying existing connection with passcode: ${currentPasscode}`
                );
                connection.send(
                  JSON.stringify({
                    type: "NEW_USER_CONNECTED",
                    passcode: currentPasscode,
                  })
                );
              }
            });
          }
        }

        if (parsedMessage.type === "TRANSFER_FILE") {
          const targetPasscode = parsedMessage.targetPasscode;
          const fileName = parsedMessage.fileName;
          const fileSize = parsedMessage.fileSize;
          const totalChunks = parsedMessage.totalChunks;
          const fileType = parsedMessage.fileType;

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
              passcode: targetPasscode,
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
                    fileType,
                    totalChunks,
                  })
                );
              } else if (connection == ws) {
                connection.send(
                  JSON.stringify({
                    type: "FILE_TRANSFER_INIT_RECEIVED",
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
          const base64ChunkData = parsedMessage.chunkData;
          const transferId = parsedMessage.transferId;
          const chunkNumber = parsedMessage.chunkNumber;

          try {
            // Test decoding a small portion of the base64 string
            atob(base64ChunkData.slice(0, 10));
          } catch (error) {
            console.error("Invalid base64 data received:", error);
            ws.send(
              JSON.stringify({
                type: "ERROR",
                message: "Invalid chunk data received",
              })
            );
            return;
          }

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
                    chunkData: base64ChunkData,
                  })
                );
              }
            });

            // Update the FileTransfer status to 'completed' if all chunks have been sent
            if (totalChunks) {
              if (chunkNumber === totalChunks - 1) {
                console.log("File transfer completed");
                await prisma.fileTransfer.update({
                  where: { id: transferId },
                  data: { status: "completed" },
                });
              }
            }
          }
        }

        // Handle more message types as needed
      } catch (error) {
        console.error("Error handling WebSocket message:", error);
        // Optionally, send an error message back to the client
        ws.send(
          JSON.stringify({ type: "ERROR", message: "An error occurred" })
        );
      }
    });

    ws.on("close", () => {
      console.log("Connection closed for ID:", (ws as any).id);
      const passcode = (ws as any).passcode;
      console.log("closing request came");

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
