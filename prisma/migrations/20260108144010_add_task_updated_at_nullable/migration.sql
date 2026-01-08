-- AlterTable
ALTER TABLE `task` ADD COLUMN `updatedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Task_userId_updatedAt_idx` ON `Task`(`userId`, `updatedAt`);
