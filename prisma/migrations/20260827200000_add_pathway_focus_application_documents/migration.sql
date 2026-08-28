ALTER TABLE "User" ADD COLUMN "pathway" TEXT NOT NULL DEFAULT 'education';
ALTER TABLE "User" ADD COLUMN "focus" TEXT NOT NULL DEFAULT 'exploring';
ALTER TABLE "Opportunity" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'education';
ALTER TABLE "Opportunity" ADD COLUMN "focuses" TEXT[] NOT NULL DEFAULT ARRAY['exploring']::TEXT[];
ALTER TABLE "Application" ADD COLUMN "cvUrl" TEXT;
ALTER TABLE "Application" ADD COLUMN "certificateUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
