-- DropForeignKey
ALTER TABLE "DvfTransaction" DROP CONSTRAINT "DvfTransaction_projectId_fkey";

-- AddForeignKey
ALTER TABLE "DvfTransaction" ADD CONSTRAINT "DvfTransaction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("project_id") ON DELETE CASCADE ON UPDATE CASCADE;
