-- Organizations migration: extend Tenant and add User/Membership/Invitation
-- This migration is crafted to match Prisma schema additions

-- 1) Extend Tenant
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;

-- 2) User table
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY,
  "authProviderId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Uniques for User
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'User_authProviderId_key'
  ) THEN
    CREATE UNIQUE INDEX "User_authProviderId_key" ON "User"("authProviderId");
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'User_email_key'
  ) THEN
    CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
  END IF;
END $$;

-- 3) Membership table
CREATE TABLE IF NOT EXISTS "Membership" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tenantId" BIGINT NOT NULL,
  "role" VARCHAR(20) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes Membership
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Membership_tenantId_idx'
  ) THEN
    CREATE INDEX "Membership_tenantId_idx" ON "Membership"("tenantId");
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Membership_userId_tenantId_key'
  ) THEN
    CREATE UNIQUE INDEX "Membership_userId_tenantId_key" ON "Membership"("userId", "tenantId");
  END IF;
END $$;

-- 4) Invitation table
CREATE TABLE IF NOT EXISTS "Invitation" (
  "id" TEXT PRIMARY KEY,
  "tenantId" BIGINT NOT NULL,
  "email" TEXT NOT NULL,
  "role" VARCHAR(20) NOT NULL,
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes Invitation
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Invitation_token_key'
  ) THEN
    CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Invitation_tenantId_idx'
  ) THEN
    CREATE INDEX "Invitation_tenantId_idx" ON "Invitation"("tenantId");
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Invitation_email_idx'
  ) THEN
    CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");
  END IF;
END $$;

-- 5) Tenant.slug unique (allows multiple NULLs)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Tenant_slug_key'
  ) THEN
    CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
  END IF;
END $$;

-- 6) FKs
DO $$ BEGIN
  -- Tenant.createdByUserId -> User.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'Tenant' AND constraint_name = 'Tenant_createdByUserId_fkey'
  ) THEN
    ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  -- Membership FKs
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'Membership' AND constraint_name = 'Membership_userId_fkey'
  ) THEN
    ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'Membership' AND constraint_name = 'Membership_tenantId_fkey'
  ) THEN
    ALTER TABLE "Membership" ADD CONSTRAINT "Membership_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- Invitation FKs
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'Invitation' AND constraint_name = 'Invitation_tenantId_fkey'
  ) THEN
    ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'Invitation' AND constraint_name = 'Invitation_createdByUserId_fkey'
  ) THEN
    ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
