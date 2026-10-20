/*
  Warnings:

  - You are about to drop the column `currentValue` on the `goals` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `goals` table. All the data in the column will be lost.
  - You are about to drop the column `targetValue` on the `goals` table. All the data in the column will be lost.
  - The `deadline` column on the `goals` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `targetAmount` to the `goals` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `goals` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `goals` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "goals" DROP COLUMN "currentValue",
DROP COLUMN "name",
DROP COLUMN "targetValue",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "currentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "targetAmount" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "deadline",
ADD COLUMN     "deadline" TIMESTAMP(3);
