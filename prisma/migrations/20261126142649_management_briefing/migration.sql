-- CreateTable
CREATE TABLE "Briefing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "generatedAt" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "evaluationDate" TEXT NOT NULL,
    "sectionsJson" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "narrativeSource" TEXT NOT NULL,
    "aiRunId" TEXT,
    "aiError" TEXT,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0
);
