-- Organisation model: per-project role assignments, onboarding phases, Employee ↔ Person link.
-- The former MANAGEMENT role is replaced by ADDITIONAL_MANAGER (data migrated at the end of this file).

-- CreateTable
CREATE TABLE "ProjectAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "reportsToPersonId" TEXT,
    "assignedById" TEXT NOT NULL,
    "assignedAt" TEXT NOT NULL,
    "startDate" TEXT,
    "endDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "movement" TEXT,
    "endReason" TEXT,
    "isSimulated" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ProjectAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProjectAssignment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProjectAssignment_reportsToPersonId_fkey" FOREIGN KEY ("reportsToPersonId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "employeeId" TEXT,
    "personId" TEXT,
    CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("email", "employeeId", "id", "name", "personId", "role") SELECT "email", "employeeId", "id", "name", "personId", "role" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");
CREATE UNIQUE INDEX "User_personId_key" ON "User"("personId");
CREATE TABLE "new_Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "personId" TEXT,
    "startDate" TEXT NOT NULL,
    "movement" TEXT NOT NULL,
    "projectId" TEXT,
    "manager" TEXT,
    "lineManagerId" TEXT,
    "trackerStatus" TEXT NOT NULL,
    "lastUpdate" TEXT NOT NULL,
    "role" TEXT,
    "technicalLeadId" TEXT,
    "isSimulated" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Employee_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Employee_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("id", "isSimulated", "lastUpdate", "lineManagerId", "manager", "movement", "name", "projectId", "role", "startDate", "technicalLeadId", "trackerStatus", "updatedAt") SELECT "id", "isSimulated", "lastUpdate", "lineManagerId", "manager", "movement", "name", "projectId", "role", "startDate", "technicalLeadId", "trackerStatus", "updatedAt" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_personId_key" ON "Employee"("personId");
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "startDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isSimulated" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TEXT
);
INSERT INTO "new_Project" ("id", "name") SELECT "id", "name" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE TABLE "new_OnboardingCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'ONBOARDING',
    "phaseChangedAt" TEXT,
    "phaseChangedBy" TEXT,
    "assessedStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "validatedStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "riskFlags" TEXT NOT NULL DEFAULT '[]',
    "assessmentReason" TEXT,
    "assessmentAt" TEXT,
    "ktOwnerId" TEXT,
    "expectedReadyAt" TEXT,
    "readinessReviewAt" TEXT,
    "gatesJson" TEXT NOT NULL DEFAULT '[]',
    "reliability" TEXT,
    "roadmapBaselineJson" TEXT,
    "roadmapBaselineAt" TEXT,
    "roadmapBaselineBy" TEXT,
    "lastRecomputedAt" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OnboardingCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_OnboardingCase" ("assessedStatus", "assessmentAt", "assessmentReason", "employeeId", "expectedReadyAt", "gatesJson", "id", "ktOwnerId", "lastRecomputedAt", "readinessReviewAt", "reliability", "riskFlags", "roadmapBaselineAt", "roadmapBaselineBy", "roadmapBaselineJson", "updatedAt", "validatedStatus") SELECT "assessedStatus", "assessmentAt", "assessmentReason", "employeeId", "expectedReadyAt", "gatesJson", "id", "ktOwnerId", "lastRecomputedAt", "readinessReviewAt", "reliability", "riskFlags", "roadmapBaselineAt", "roadmapBaselineBy", "roadmapBaselineJson", "updatedAt", "validatedStatus" FROM "OnboardingCase";
DROP TABLE "OnboardingCase";
ALTER TABLE "new_OnboardingCase" RENAME TO "OnboardingCase";
CREATE UNIQUE INDEX "OnboardingCase_employeeId_key" ON "OnboardingCase"("employeeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ProjectAssignment_projectId_role_status_idx" ON "ProjectAssignment"("projectId", "role", "status");

-- CreateIndex
CREATE INDEX "ProjectAssignment_personId_status_idx" ON "ProjectAssignment"("personId", "status");


-- Data migration: MANAGEMENT → ADDITIONAL_MANAGER (accounts, people and stored briefings).
UPDATE "User" SET "role" = 'ADDITIONAL_MANAGER' WHERE "role" = 'MANAGEMENT';
UPDATE "Person" SET "role" = 'ADDITIONAL_MANAGER' WHERE "role" = 'MANAGEMENT';
UPDATE "Briefing" SET "role" = 'ADDITIONAL_MANAGER' WHERE "role" = 'MANAGEMENT';

-- Data migration: cases whose tracker status is pre-onboarding start in the PRE_BOARDING phase.
UPDATE "OnboardingCase" SET "phase" = 'PRE_BOARDING'
WHERE "employeeId" IN (SELECT "id" FROM "Employee" WHERE lower(replace(replace("trackerStatus", '-', ''), ' ', '')) = 'preonboarding');
