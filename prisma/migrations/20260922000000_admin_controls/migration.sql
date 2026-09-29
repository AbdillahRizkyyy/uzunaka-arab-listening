ALTER TABLE "User" ADD COLUMN "disabledAt" TIMESTAMP(3);
ALTER TABLE "Unit" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Question" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "QuestionRevision" (
 "id" TEXT NOT NULL PRIMARY KEY, "questionId" TEXT NOT NULL, "version" INTEGER NOT NULL,
 "data" JSONB NOT NULL, "editorId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "QuestionRevision_questionId_version_key" ON "QuestionRevision"("questionId", "version");
CREATE TABLE "AppSettings" (
 "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'main', "name" TEXT NOT NULL DEFAULT 'Istima',
 "tagline" TEXT NOT NULL DEFAULT 'Selangkah lebih dekat untuk memahami.', "supportEmail" TEXT NOT NULL DEFAULT ''
);
