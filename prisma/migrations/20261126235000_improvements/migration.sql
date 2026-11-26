-- Improvements the PMO creates and approves from insights or briefings; owned and updated by an Additional Manager.
-- CreateTable
CREATE TABLE "Improvement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "refs" TEXT NOT NULL DEFAULT '[]',
    "ownerPersonId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "createdById" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TEXT,
    "dueDate" TEXT,
    "outcomeNote" TEXT,
    "updatedAt" TEXT
);

