ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PARENT';

CREATE TABLE "LearnerLink" (
  "id" TEXT NOT NULL,
  "parentId" TEXT NOT NULL,
  "learnerId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LearnerLink_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LearnerLink_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LearnerLink_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "LearnerLink_parentId_learnerId_key" ON "LearnerLink"("parentId", "learnerId");
CREATE INDEX "LearnerLink_learnerId_status_idx" ON "LearnerLink"("learnerId", "status");