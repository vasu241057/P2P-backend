// import { Request, Response } from "express";

// export const getFileTransferStatus = async (req: Request, res: Response) => {
//   const { transferId } = req.params;
//   const fileTransfer = await prisma.fileTransfer.findUnique({
//     where: { id: transferId },
//   });

//   if (!fileTransfer) {
//     return res.status(404).json({ message: "Transfer not found" });
//   }

//   return res.json({ status: fileTransfer.status });
// };

// export const restartTransfer = async (req: Request, res: Response) => {
//   const { transferId } = req.params;
//   const fileTransfer = await prisma.fileTransfer.update({
//     where: { id: transferId },
//     data: { status: "restarted" },
//   });

//   return res.json({ message: "Transfer restarted", fileTransfer });
// };
