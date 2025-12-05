-- CreateEnum (if not exists)
DO $$ BEGIN
    CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add role column (if not exists)
DO $$ BEGIN
    ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Update existing admin users (if isAdmin column exists)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'isAdmin') THEN
        UPDATE "User" SET "role" = 'ADMIN' WHERE "isAdmin" = true;
    END IF;
END $$;

-- CreateIndex (optional, for better query performance)
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");

-- Drop verificationType column
ALTER TABLE "User" DROP COLUMN IF EXISTS "verificationType";

-- Drop isAdmin column
ALTER TABLE "User" DROP COLUMN IF EXISTS "isAdmin";

-- Drop VerificationType enum (only if no other tables use it)
DROP TYPE IF EXISTS "VerificationType";

