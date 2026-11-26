-- AlterTable
ALTER TABLE "OnboardingCase" ADD COLUMN "roadmapBaselineAt" TEXT;
ALTER TABLE "OnboardingCase" ADD COLUMN "roadmapBaselineBy" TEXT;
ALTER TABLE "OnboardingCase" ADD COLUMN "roadmapBaselineJson" TEXT;

-- CreateTable
CREATE TABLE "RoadmapItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "phase" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ownerRole" TEXT NOT NULL,
    "completionCriteria" TEXT NOT NULL,
    "relatesToKey" TEXT,
    "rationale" TEXT NOT NULL,
    "evidenceIds" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "origin" TEXT NOT NULL DEFAULT 'AI',
    "aiRunId" TEXT,
    "createdAt" TEXT NOT NULL,
    "decidedBy" TEXT,
    "decidedAt" TEXT,
    "decisionReason" TEXT
);
