-- Keep custom application names, support settings, and existing account data.
ALTER TABLE "AppSettings" ALTER COLUMN "name" SET DEFAULT 'أذنك';
UPDATE "AppSettings" SET "name" = 'أذنك' WHERE "id" = 'main' AND "name" = 'Istima';
