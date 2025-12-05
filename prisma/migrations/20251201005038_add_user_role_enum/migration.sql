-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

-- Update existing admin users
UPDATE "User" SET "role" = 'ADMIN' WHERE "isAdmin" = true;

-- CreateIndex (optional, for better query performance)
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");

