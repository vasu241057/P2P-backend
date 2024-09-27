import { Request, Response } from "express";
import { Connection } from "@prisma/client";
import prisma from "../prisma/client";
import { generatePasscodeService } from "../utils";
import { getConnection } from "../services/websocketService";

// Generate and return passcode
export const generatePasscode = async (req: Request, res: Response) => {
  const passcode = generatePasscodeService();
  const connection: Connection = await prisma.connection.create({
    data: { passcode },
  });

  return res.json({ passcode: connection.passcode });
};

// Connect user via passcode
export const connectUser = async (req: Request, res: Response) => {
  const { passcode } = req.params;

  // Check if passcode is valid in the database
  const connection = await prisma.connection.findUnique({
    where: { passcode },
  });

  if (!connection) {
    return res.status(404).json({ message: "Invalid passcode" });
  }

  // Check WebSocket connections for the given passcode
  const wsConnections = getConnection(passcode);

  if (!wsConnections || wsConnections.length === 0) {
    return res
      .status(400)
      .json({ message: "No active connections for this passcode" });
  }

  // If valid, return success (WebSocket will handle further communication)
  return res.status(200).json({ message: "Connected", passcode });
};
