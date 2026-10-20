/*
  Warnings:

  - A unique constraint covering the columns `[transactionId]` on the table `bills` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "bills" ADD COLUMN     "transactionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "bills_transactionId_key" ON "bills"("transactionId");

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
