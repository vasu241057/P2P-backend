import { WebSocketServer, WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import prisma from "../prisma/client";

interface ExtendedWebSocket extends WebSocket {
  id: string;
  passcode?: string;
}

// Map to store connections based on passcode
const passcodeConnections = new Map<string, ExtendedWebSocket[]>();

export function setupWebSocket(wss: WebSocketServer) {
  wss.on("connection", (ws: ExtendedWebSocket) => {
    ws.id = uuidv4();
    console.log("WebSocket connection opened. ID:", ws.id);

    ws.on("message", async (message) => {
      try {
        const parsedMessage = JSON.parse(message.toString());

        switch (parsedMessage.type) {
          case "SET_PASSCODE":
            handleSetPasscode(ws, parsedMessage.passcode);
            break;
          case "TRANSFER_FILE":
            await handleTransferFile(ws, parsedMessage);
            break;
          case "FILE_CHUNK":
            await handleFileChunk(ws, parsedMessage);
            break;
          default:
            console.warn("Unknown message type:", parsedMessage.type);
        }
      } catch (error) {
        console.error("Error handling WebSocket message:", error);
        ws.send(
          JSON.stringify({ type: "ERROR", message: "An error occurred" })
        );
      }
    });

    ws.on("close", () => handleConnectionClose(ws));
  });
}

function handleSetPasscode(ws: ExtendedWebSocket, passcode: string) {
  if (!passcodeConnections.has(passcode)) {
    passcodeConnections.set(passcode, []);
  }
  passcodeConnections.get(passcode)?.push(ws);
  ws.passcode = passcode;
  console.log(`User connected with passcode: ${passcode}`);

  notifyExistingConnections(passcode, ws);
}

function notifyExistingConnections(
  passcode: string,
  newConnection: ExtendedWebSocket
) {
  const existingConnections = passcodeConnections.get(passcode);
  if (existingConnections) {
    existingConnections.forEach((connection) => {
      if (connection !== newConnection) {
        connection.send(
          JSON.stringify({
            type: "NEW_USER_CONNECTED",
            passcode: passcode,
          })
        );
      }
    });
  }
}

async function handleTransferFile(ws: ExtendedWebSocket, message: any) {
  const { targetPasscode, fileName, fileSize, totalChunks, fileType } = message;

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

  const targetConnections = passcodeConnections.get(targetPasscode);
  if (targetConnections) {
    targetConnections.forEach((connection) => {
      connection.send(
        JSON.stringify({
          type:
            connection === ws
              ? "FILE_TRANSFER_INIT_RECEIVED"
              : "FILE_TRANSFER_INIT",
          transferId,
          fileName,
          fileSize,
          fileType,
          totalChunks,
        })
      );
    });
  } else {
    ws.send(JSON.stringify({ type: "ERROR", message: "Target not connected" }));
    await prisma.fileTransfer.update({
      where: { id: transferId },
      data: { status: "failed" },
    });
  }
}

async function handleFileChunk(ws: ExtendedWebSocket, message: any) {
  const { targetPasscode, chunkData, transferId, chunkNumber } = message;

  try {
    // Test decoding a small portion of the base64 string
    atob(chunkData.slice(0, 10));
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

    const transfer = await prisma.fileTransfer.findUnique({
      where: { id: transferId },
    });

    if (transfer && chunkNumber === transfer.totalChunks - 1) {
      console.log("File transfer completed");
      await prisma.fileTransfer.update({
        where: { id: transferId },
        data: { status: "completed" },
      });
    }
  }
}

function handleConnectionClose(ws: ExtendedWebSocket) {
  console.log("Connection closed for ID:", ws.id);
  if (ws.passcode && passcodeConnections.has(ws.passcode)) {
    const connections = passcodeConnections.get(ws.passcode);
    if (connections) {
      const updatedConnections = connections.filter((conn) => conn !== ws);
      if (updatedConnections.length > 0) {
        passcodeConnections.set(ws.passcode, updatedConnections);
      } else {
        passcodeConnections.delete(ws.passcode);
      }
    }
  }
  console.log(`Connection closed for passcode: ${ws.passcode}`);
}

export function getConnection(passcode: string): ExtendedWebSocket[] | null {
  return passcodeConnections.get(passcode) || null;
}
