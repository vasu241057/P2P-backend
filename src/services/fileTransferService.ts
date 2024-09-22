// import { WebSocket } from "ws";

// export function sendFileChunk(ws: WebSocket, chunk: Buffer) {
//   ws.send(chunk);
// }

// export function receiveFileChunk(
//   ws: WebSocket,
//   callback: (chunk: Buffer) => void
// ) {
//   ws.on("message", (message) => {
//     const chunk = Buffer.from(message);
//     callback(chunk);
//   });
// }
