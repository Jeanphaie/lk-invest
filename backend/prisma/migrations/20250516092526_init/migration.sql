/*
  Warnings:

  - The primary key for the `DvfDistribution` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `DvfSeries` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `DvfTransaction` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "DvfDistribution" DROP CONSTRAINT "DvfDistribution_projectId_fkey";

-- DropForeignKey
ALTER TABLE "DvfSeries" DROP CONSTRAINT "DvfSeries_projectId_fkey";

-- DropForeignKey
ALTER TABLE "DvfTransaction" DROP CONSTRAINT "DvfTransaction_projectId_fkey";

-- DropIndex
DROP INDEX "DvfDistribution_projectId_idx";

-- DropIndex
DROP INDEX "DvfSeries_projectId_type_idx";

-- DropIndex
DROP INDEX "DvfTransaction_projectId_idx";

-- DropIndex
DROP INDEX "dvfPremiumTransaction_projectId_idx";

-- AlterTable
ALTER TABLE "DvfDistribution" DROP CONSTRAINT "DvfDistribution_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "DvfDistribution_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "DvfDistribution_id_seq";

-- AlterTable
ALTER TABLE "DvfSeries" DROP CONSTRAINT "DvfSeries_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "DvfSeries_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "DvfSeries_id_seq";

-- AlterTable
ALTER TABLE "DvfTransaction" DROP CONSTRAINT "DvfTransaction_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "DvfTransaction_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "DvfTransaction_id_seq";

-- AlterTable
ALTER TABLE "dvfPremiumTransaction" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "DVF" (
    "id" SERIAL NOT NULL,
    "primary_key" TEXT NOT NULL,
    "id_mutation" TEXT NOT NULL,
    "date_mutation" TEXT NOT NULL,
    "nature_mutation" TEXT NOT NULL,
    "valeur_fonciere" DOUBLE PRECISION,
    "adresse_numero" TEXT,
    "adresse_nom_voie" TEXT,
    "code_postal" TEXT,
    "nom_commune" TEXT,
    "id_parcelle" TEXT,
    "lot1_numero" TEXT,
    "lot2_numero" TEXT,
    "lot3_numero" TEXT,
    "nombre_lots" INTEGER,
    "type_local" TEXT,
    "surface_reelle_bati" DOUBLE PRECISION,
    "nombre_pieces_principales" INTEGER,
    "surface_terrain" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "latitude" DOUBLE PRECISION,
    "prix_m2" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DVF_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DVF_primary_key_key" ON "DVF"("primary_key");

-- CreateIndex
CREATE INDEX "DVF_code_postal_idx" ON "DVF"("code_postal");

-- CreateIndex
CREATE INDEX "DVF_latitude_longitude_idx" ON "DVF"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "DVF_date_mutation_idx" ON "DVF"("date_mutation");

-- AddForeignKey
ALTER TABLE "DvfTransaction" ADD CONSTRAINT "DvfTransaction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DvfSeries" ADD CONSTRAINT "DvfSeries_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DvfDistribution" ADD CONSTRAINT "DvfDistribution_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;
