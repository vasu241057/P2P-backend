-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('in_progress', 'completed', 'failed', 'restarted');

-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL,
    "passcode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileTransfer" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "passcode" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "totalChunks" INTEGER NOT NULL,
    "status" "TransferStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "FileTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Connection_passcode_key" ON "Connection"("passcode");

-- AddForeignKey
ALTER TABLE "FileTransfer" ADD CONSTRAINT "FileTransfer_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
