-- Briefings are scoped to their author and optionally one project.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Briefing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL DEFAULT 'ALL',
    "generatedAt" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "generatedById" TEXT,
    "evaluationDate" TEXT NOT NULL,
    "sectionsJson" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "narrativeSource" TEXT NOT NULL,
    "aiRunId" TEXT,
    "aiError" TEXT,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_Briefing" ("aiError", "aiRunId", "evaluationDate", "generatedAt", "generatedBy", "id", "narrativeSource", "rejectedCount", "role", "sectionsJson", "snapshotJson") SELECT "aiError", "aiRunId", "evaluationDate", "generatedAt", "generatedBy", "id", "narrativeSource", "rejectedCount", "role", "sectionsJson", "snapshotJson" FROM "Briefing";
DROP TABLE "Briefing";
ALTER TABLE "new_Briefing" RENAME TO "Briefing";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

