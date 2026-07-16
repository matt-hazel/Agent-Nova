-- CreateTable
CREATE TABLE "DispatchEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dispatchId" TEXT NOT NULL,
    "remoteEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" DATETIME NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DispatchEvent_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "Dispatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DispatchEvent_remoteEventId_key" ON "DispatchEvent"("remoteEventId");

-- CreateIndex
CREATE INDEX "DispatchEvent_dispatchId_processedAt_idx" ON "DispatchEvent"("dispatchId", "processedAt");
