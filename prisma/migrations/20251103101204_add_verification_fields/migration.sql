-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('ADMIN', 'USER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "verificationType" "VerificationType";
ALTER TABLE "User" ADD COLUMN "verifiedAt" TIMESTAMPTZ(6);
ALTER TABLE "User" ADD COLUMN "verifiedBy" UUID;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

