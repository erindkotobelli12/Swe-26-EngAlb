-- AlterTable
ALTER TABLE "User" ADD COLUMN "personId" TEXT;

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "role" TEXT NOT NULL,
    "projectId" TEXT,
    "isSimulated" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    CONSTRAINT "Person_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Dependency" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT,
    "caseId" TEXT,
    "fromType" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toType" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'REQUIRES',
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "origin" TEXT NOT NULL DEFAULT 'TEMPLATE',
    "rationale" TEXT NOT NULL,
    "evidenceIds" TEXT NOT NULL DEFAULT '[]',
    "excerpts" TEXT NOT NULL DEFAULT '[]',
    "aiRunId" TEXT,
    "confirmedBy" TEXT,
    "confirmedAt" TEXT,
    "createdAt" TEXT,
    CONSTRAINT "Dependency_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "OnboardingCase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agent" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "inputRefs" TEXT NOT NULL DEFAULT '[]',
    "employeeId" TEXT,
    "output" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TEXT NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AccessRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "application" TEXT NOT NULL,
    "requiredScope" TEXT NOT NULL,
    "requestDate" TEXT,
    "owner" TEXT,
    "ownerPersonId" TEXT,
    "handlerRole" TEXT,
    "approverRole" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL,
    "blockerReason" TEXT,
    "evidenceId" TEXT,
    "requestEvidenceId" TEXT,
    "usableConfirmedAt" TEXT,
    "usableEvidenceId" TEXT,
    "lastUpdate" TEXT,
    "nextFollowUp" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccessRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AccessRequest" ("application", "blockerReason", "employeeId", "evidenceId", "id", "lastUpdate", "nextFollowUp", "owner", "requestDate", "requiredScope", "status") SELECT "application", "blockerReason", "employeeId", "evidenceId", "id", "lastUpdate", "nextFollowUp", "owner", "requestDate", "requiredScope", "status" FROM "AccessRequest";
DROP TABLE "AccessRequest";
ALTER TABLE "new_AccessRequest" RENAME TO "AccessRequest";
CREATE TABLE "new_ActionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT,
    "employeeId" TEXT,
    "findingId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ownerRole" TEXT,
    "ownerName" TEXT,
    "ownerPersonId" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "evidenceIds" TEXT NOT NULL DEFAULT '[]',
    "draft" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'HUMAN',
    "createdBy" TEXT,
    "createdAt" TEXT,
    "resolvedAt" TEXT,
    CONSTRAINT "ActionItem_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "OnboardingCase" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ActionItem_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ActionItem_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ActionItem" ("caseId", "description", "draft", "dueDate", "employeeId", "evidenceIds", "findingId", "id", "ownerName", "ownerRole", "priority", "resolvedAt", "status", "title") SELECT "caseId", "description", "draft", "dueDate", "employeeId", "evidenceIds", "findingId", "id", "ownerName", "ownerRole", "priority", "resolvedAt", "status", "title" FROM "ActionItem";
DROP TABLE "ActionItem";
ALTER TABLE "new_ActionItem" RENAME TO "ActionItem";
CREATE TABLE "new_AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT,
    "actorLabel" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "employeeId" TEXT,
    "before" TEXT,
    "after" TEXT,
    "evidenceIds" TEXT NOT NULL DEFAULT '[]',
    "details" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL,
    CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AuditLog" ("action", "actorId", "details", "entityId", "entityType", "id", "timestamp") SELECT "action", "actorId", "details", "entityId", "entityType", "id", "timestamp" FROM "AuditLog";
DROP TABLE "AuditLog";
ALTER TABLE "new_AuditLog" RENAME TO "AuditLog";
CREATE TABLE "new_Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
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
    CONSTRAINT "Employee_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("id", "lastUpdate", "manager", "movement", "name", "projectId", "role", "startDate", "technicalLeadId", "trackerStatus") SELECT "id", "lastUpdate", "manager", "movement", "name", "projectId", "role", "startDate", "technicalLeadId", "trackerStatus" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE TABLE "new_Evidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceType" TEXT NOT NULL,
    "author" TEXT,
    "senderRole" TEXT,
    "senderPersonId" TEXT,
    "recipients" TEXT NOT NULL DEFAULT '[]',
    "authorityLevel" TEXT,
    "timestamp" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "employeeId" TEXT,
    "projectId" TEXT,
    "caseId" TEXT,
    "title" TEXT NOT NULL,
    "sourceRef" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "inReplyToId" TEXT,
    "isRequest" BOOLEAN NOT NULL DEFAULT false,
    "ingestedAt" TEXT,
    "ingestedBy" TEXT,
    "isSimulated" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Evidence_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Evidence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Evidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "OnboardingCase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Evidence" ("author", "caseId", "content", "employeeId", "id", "projectId", "sourceRef", "sourceType", "timestamp", "title") SELECT "author", "caseId", "content", "employeeId", "id", "projectId", "sourceRef", "sourceType", "timestamp", "title" FROM "Evidence";
DROP TABLE "Evidence";
ALTER TABLE "new_Evidence" RENAME TO "Evidence";
CREATE TABLE "new_EvidenceClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evidenceId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "extractedValue" TEXT NOT NULL,
    "editedValue" TEXT,
    "excerpt" TEXT NOT NULL,
    "excerptVerified" BOOLEAN NOT NULL DEFAULT false,
    "effectiveDate" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'AI',
    "aiRunId" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewReason" TEXT,
    "reviewerId" TEXT,
    "reviewedAt" TEXT,
    "appliedChange" TEXT,
    CONSTRAINT "EvidenceClaim_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_EvidenceClaim" ("effectiveDate", "entity", "evidenceId", "excerpt", "extractedValue", "field", "id", "reviewStatus", "reviewedAt", "reviewerId") SELECT "effectiveDate", "entity", "evidenceId", "excerpt", "extractedValue", "field", "id", "reviewStatus", "reviewedAt", "reviewerId" FROM "EvidenceClaim";
DROP TABLE "EvidenceClaim";
ALTER TABLE "new_EvidenceClaim" RENAME TO "EvidenceClaim";
CREATE TABLE "new_Finding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "fingerprint" TEXT,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "origin" TEXT NOT NULL DEFAULT 'RULE',
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "evidenceIds" TEXT NOT NULL DEFAULT '[]',
    "facts" TEXT NOT NULL DEFAULT '[]',
    "assumptions" TEXT NOT NULL DEFAULT '[]',
    "rootCauses" TEXT NOT NULL DEFAULT '[]',
    "recommendedActions" TEXT NOT NULL DEFAULT '[]',
    "affectedEntities" TEXT NOT NULL DEFAULT '[]',
    "ownerRole" TEXT,
    "aiRunId" TEXT,
    "aiAnalysis" TEXT,
    "firstDetectedAt" TEXT,
    "lastDetectedAt" TEXT,
    "resolvedAt" TEXT,
    "resolvedBy" TEXT,
    "resolutionType" TEXT,
    "resolution" TEXT,
    "resolutionEvidenceId" TEXT,
    CONSTRAINT "Finding_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "OnboardingCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Finding" ("caseId", "description", "evidenceIds", "id", "resolution", "resolvedAt", "severity", "status", "title", "type") SELECT "caseId", "description", "evidenceIds", "id", "resolution", "resolvedAt", "severity", "status", "title", "type" FROM "Finding";
DROP TABLE "Finding";
ALTER TABLE "new_Finding" RENAME TO "Finding";
CREATE UNIQUE INDEX "Finding_caseId_fingerprint_key" ON "Finding"("caseId", "fingerprint");
CREATE TABLE "new_KTActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL DEFAULT 'CORE',
    "owner" TEXT,
    "ownerPersonId" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "stageBasis" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "evidenceId" TEXT,
    "completionDate" TEXT,
    "validation" TEXT NOT NULL DEFAULT 'PENDING',
    "requiredForReady" BOOLEAN NOT NULL DEFAULT true,
    "requiredApps" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "origin" TEXT NOT NULL DEFAULT 'EVIDENCE',
    "originNote" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KTActivity_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_KTActivity" ("completionDate", "description", "employeeId", "evidenceId", "id", "owner", "requiredForReady", "scope", "stage", "title", "validation") SELECT "completionDate", "description", "employeeId", "evidenceId", "id", "owner", "requiredForReady", "scope", "stage", "title", "validation" FROM "KTActivity";
DROP TABLE "KTActivity";
ALTER TABLE "new_KTActivity" RENAME TO "KTActivity";
CREATE TABLE "new_KnowledgeResource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "projectId" TEXT,
    "owner" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "applicableRoles" TEXT NOT NULL DEFAULT '[]',
    "copyAllowed" BOOLEAN NOT NULL DEFAULT true,
    "sourceEvidenceId" TEXT,
    CONSTRAINT "KnowledgeResource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_KnowledgeResource" ("applicableRoles", "description", "id", "location", "owner", "projectId", "title") SELECT "applicableRoles", "description", "id", "location", "owner", "projectId", "title" FROM "KnowledgeResource";
DROP TABLE "KnowledgeResource";
ALTER TABLE "new_KnowledgeResource" RENAME TO "KnowledgeResource";
CREATE TABLE "new_OnboardingCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
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
    "lastRecomputedAt" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OnboardingCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_OnboardingCase" ("assessedStatus", "assessmentAt", "assessmentReason", "employeeId", "expectedReadyAt", "id", "ktOwnerId", "readinessReviewAt", "riskFlags", "validatedStatus") SELECT "assessedStatus", "assessmentAt", "assessmentReason", "employeeId", "expectedReadyAt", "id", "ktOwnerId", "readinessReviewAt", "riskFlags", "validatedStatus" FROM "OnboardingCase";
DROP TABLE "OnboardingCase";
ALTER TABLE "new_OnboardingCase" RENAME TO "OnboardingCase";
CREATE UNIQUE INDEX "OnboardingCase_employeeId_key" ON "OnboardingCase"("employeeId");
CREATE TABLE "new_ReadinessAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "evidenceIds" TEXT NOT NULL DEFAULT '[]',
    "gatesJson" TEXT NOT NULL DEFAULT '[]',
    "trigger" TEXT,
    "timestamp" TEXT NOT NULL,
    CONSTRAINT "ReadinessAssessment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ReadinessAssessment" ("employeeId", "evidenceIds", "explanation", "id", "status", "timestamp") SELECT "employeeId", "evidenceIds", "explanation", "id", "status", "timestamp" FROM "ReadinessAssessment";
DROP TABLE "ReadinessAssessment";
ALTER TABLE "new_ReadinessAssessment" RENAME TO "ReadinessAssessment";
CREATE TABLE "new_ReadinessValidation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "validatedLevel" TEXT,
    "reviewerRole" TEXT,
    "reviewerName" TEXT,
    "reviewerId" TEXT,
    "evidenceId" TEXT,
    "evidenceIds" TEXT NOT NULL DEFAULT '[]',
    "comment" TEXT,
    "timestamp" TEXT,
    CONSTRAINT "ReadinessValidation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "OnboardingCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ReadinessValidation" ("caseId", "comment", "evidenceId", "id", "reviewerName", "reviewerRole", "state", "timestamp") SELECT "caseId", "comment", "evidenceId", "id", "reviewerName", "reviewerRole", "state", "timestamp" FROM "ReadinessValidation";
DROP TABLE "ReadinessValidation";
ALTER TABLE "new_ReadinessValidation" RENAME TO "ReadinessValidation";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Dependency_employeeId_fromType_fromId_toType_toId_key" ON "Dependency"("employeeId", "fromType", "fromId", "toType", "toId");

-- CreateIndex
CREATE INDEX "AIRun_agent_inputHash_idx" ON "AIRun"("agent", "inputHash");
