-- Pre-boarding checklist items per employee (HR- or Line-Manager-owned). No credentials are stored.
-- CreateTable
CREATE TABLE "PreboardingItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "templateKey" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "ownerRole" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "blockerReason" TEXT,
    "note" TEXT,
    "dueDate" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "evidenceId" TEXT,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    CONSTRAINT "PreboardingItem_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PreboardingItem_employeeId_templateKey_key" ON "PreboardingItem"("employeeId", "templateKey");

