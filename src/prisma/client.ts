// prisma/client.ts

import { PrismaClient } from "@prisma/client";

const isProduction = process.env.NODE_ENV === "production";
console.log(isProduction);

declare global {
  var prisma: PrismaClient | undefined;
}

let prisma: PrismaClient;
if (isProduction) {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

export default prisma;
