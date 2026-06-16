-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "templateBackgroundPath" TEXT,
ADD COLUMN     "templateLayout" JSONB,
ADD COLUMN     "templatePreviewPath" TEXT;
