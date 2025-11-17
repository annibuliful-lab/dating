-- Fix ProfileImage table to add default for id and updatedAt
ALTER TABLE "ProfileImage" 
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
