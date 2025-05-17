-- CreateTable
CREATE TABLE "Project" (
    "project_id" SERIAL PRIMARY KEY,
    "project_title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "inputs_general" JSONB NOT NULL,
    "inputs_description_bien" JSONB,
    "results_description_bien" JSONB,
    "inputs_renovation_bien" JSONB,
    "results_renovation_bien" JSONB,
    "inputs_dvf" JSONB,
    "results_dvf_metadata" JSONB,
    "inputs_business_plan" JSONB,
    "results_business_plan" JSONB,
    "photos" JSONB,
    "pdf_config" JSONB
);

-- CreateTable
CREATE TABLE "DvfTransaction" (
    "id" SERIAL PRIMARY KEY,
    "projectId" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DvfTransaction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("project_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DvfSeries" (
    "id" SERIAL PRIMARY KEY,
    "projectId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DvfSeries_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("project_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DvfDistribution" (
    "id" SERIAL PRIMARY KEY,
    "projectId" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DvfDistribution_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("project_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "dvfPremiumTransaction" (
    "id" SERIAL PRIMARY KEY,
    "projectId" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dvfPremiumTransaction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("project_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes
CREATE INDEX "DvfTransaction_projectId_idx" ON "DvfTransaction"("projectId");
CREATE INDEX "DvfSeries_projectId_type_idx" ON "DvfSeries"("projectId", "type");
CREATE INDEX "DvfDistribution_projectId_idx" ON "DvfDistribution"("projectId");
CREATE INDEX "dvfPremiumTransaction_projectId_idx" ON "dvfPremiumTransaction"("projectId"); 