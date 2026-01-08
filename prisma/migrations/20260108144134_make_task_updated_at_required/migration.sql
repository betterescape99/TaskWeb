/*
  Warnings:

  - Made the column `updatedAt` on table `task` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `task` MODIFY `updatedAt` DATETIME(3) NOT NULL;
