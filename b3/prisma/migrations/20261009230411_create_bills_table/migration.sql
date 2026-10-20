/*
  Warnings:

  - You are about to drop the column `barcode` on the `bills` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `bills` table. All the data in the column will be lost.
  - You are about to drop the column `installments` on the `bills` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `bills` table. All the data in the column will be lost.
  - You are about to drop the column `paid` on the `bills` table. All the data in the column will be lost.
  - You are about to drop the column `paidAt` on the `bills` table. All the data in the column will be lost.
  - You are about to drop the column `recurrence` on the `bills` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `bills` table. All the data in the column will be lost.
  - Added the required column `amount` to the `bills` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `bills` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `bills` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `bills` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `dueDate` on the `bills` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "bills" DROP COLUMN "barcode",
DROP COLUMN "category",
DROP COLUMN "installments",
DROP COLUMN "name",
DROP COLUMN "paid",
DROP COLUMN "paidAt",
DROP COLUMN "recurrence",
DROP COLUMN "value",
ADD COLUMN     "amount" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "dueDate",
ADD COLUMN     "dueDate" TIMESTAMP(3) NOT NULL;
