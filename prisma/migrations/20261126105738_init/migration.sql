-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "employeeId" TEXT,
    CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "movement" TEXT NOT NULL,
    "projectId" TEXT,
    "manager" TEXT,
    "trackerStatus" TEXT NOT NULL,
    "lastUpdate" TEXT NOT NULL,
    "role" TEXT,
    "technicalLeadId" TEXT,
    CONSTRAINT "Employee_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "OnboardingCase" (
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
    CONSTRAINT "OnboardingCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccessRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "application" TEXT NOT NULL,
    "requiredScope" TEXT NOT NULL,
    "requestDate" TEXT,
    "owner" TEXT,
    "status" TEXT NOT NULL,
    "blockerReason" TEXT,
    "evidenceId" TEXT,
    "lastUpdate" TEXT,
    "nextFollowUp" TEXT,
    CONSTRAINT "AccessRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KTActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "owner" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "evidenceId" TEXT,
    "completionDate" TEXT,
    "validation" TEXT NOT NULL DEFAULT 'PENDING',
    "requiredForReady" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "KTActivity_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceType" TEXT NOT NULL,
    "author" TEXT,
    "timestamp" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "employeeId" TEXT,
    "projectId" TEXT,
    "caseId" TEXT,
    "title" TEXT NOT NULL,
    "sourceRef" TEXT,
    CONSTRAINT "Evidence_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Evidence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Evidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "OnboardingCase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvidenceClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evidenceId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "extractedValue" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "effectiveDate" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewedAt" TEXT,
    CONSTRAINT "EvidenceClaim_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "evidenceIds" TEXT NOT NULL DEFAULT '[]',
    "resolvedAt" TEXT,
    "resolution" TEXT,
    CONSTRAINT "Finding_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "OnboardingCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT,
    "employeeId" TEXT,
    "findingId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ownerRole" TEXT,
    "ownerName" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "evidenceIds" TEXT NOT NULL DEFAULT '[]',
    "draft" TEXT,
    "resolvedAt" TEXT,
    CONSTRAINT "ActionItem_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "OnboardingCase" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ActionItem_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ActionItem_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReadinessAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "evidenceIds" TEXT NOT NULL DEFAULT '[]',
    "timestamp" TEXT NOT NULL,
    CONSTRAINT "ReadinessAssessment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReadinessValidation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewerRole" TEXT,
    "reviewerName" TEXT,
    "evidenceId" TEXT,
    "comment" TEXT,
    "timestamp" TEXT,
    CONSTRAINT "ReadinessValidation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "OnboardingCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KnowledgeResource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "projectId" TEXT,
    "owner" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "applicableRoles" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "KnowledgeResource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL,
    CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingCase_employeeId_key" ON "OnboardingCase"("employeeId");
