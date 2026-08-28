ALTER TABLE "User" ADD COLUMN "pathway" TEXT NOT NULL DEFAULT 'education';
ALTER TABLE "User" ADD COLUMN "focus" TEXT NOT NULL DEFAULT 'exploring';
ALTER TABLE "Opportunity" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'education';
ALTER TABLE "Opportunity" ADD COLUMN "focuses" TEXT[] NOT NULL DEFAULT ARRAY['exploring']::TEXT[];
ALTER TABLE "Application" ADD COLUMN "cvUrl" TEXT;
ALTER TABLE "Application" ADD COLUMN "certificateUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "LessonProgress" (
	"id" TEXT NOT NULL,
	"tutorialId" TEXT NOT NULL,
	"progress" INTEGER NOT NULL DEFAULT 0,
	"completedAt" TIMESTAMP(3),
	"userId" TEXT NOT NULL,
	"updatedAt" TIMESTAMP(3) NOT NULL,
	CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id"),
	CONSTRAINT "LessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LessonProgress_userId_tutorialId_key" ON "LessonProgress"("userId", "tutorialId");
