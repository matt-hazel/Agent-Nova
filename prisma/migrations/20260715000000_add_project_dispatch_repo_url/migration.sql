-- AlterTable
ALTER TABLE "Project" ADD COLUMN "repoUrl" TEXT;

-- AlterTable
ALTER TABLE "Dispatch" ADD COLUMN "repoUrl" TEXT;

-- Data migration: dispatches that had selfRepo = true targeted Nova's own repo
UPDATE "Dispatch" SET "repoUrl" = 'https://github.com/matt-hazel/Agent-Nova.git' WHERE "selfRepo" = 1;

-- SQLite doesn't support DROP COLUMN directly in older versions, but modern
-- SQLite (3.35+, which better-sqlite3 ships) does support it.
ALTER TABLE "Dispatch" DROP COLUMN "selfRepo";
