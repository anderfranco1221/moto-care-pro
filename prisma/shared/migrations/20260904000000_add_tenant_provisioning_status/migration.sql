-- CreateEnum
CREATE TYPE "ProvisioningStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- AlterTable
-- Existing tenants predate per-tenant schema provisioning tracking; their
-- schemas were created by the old inline flow, so treat them as READY rather
-- than forcing a re-provision on first login.
ALTER TABLE "Tenant" ADD COLUMN     "provisioningStatus" "ProvisioningStatus" NOT NULL DEFAULT 'PENDING';
UPDATE "Tenant" SET "provisioningStatus" = 'READY';
