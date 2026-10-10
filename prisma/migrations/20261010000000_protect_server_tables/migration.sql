-- Application data is accessed only through the Next.js/Socket.io servers.
-- Supabase's public Data API must not expose passwords, test keys or sessions.
-- Table owners (the Prisma connection) retain access; no browser policies exist.
DO $$
DECLARE
  app_table text;
  api_role text;
BEGIN
  FOREACH app_table IN ARRAY ARRAY[
    'User', 'AuthToken', 'Unit', 'Question', 'Attempt', 'Room',
    'Participant', 'Answer', 'PointEntry', 'Report', 'RateLimit',
    'ReviewConfig', 'QuestionRevision', 'AppSettings', '_prisma_migrations'
  ] LOOP
    IF to_regclass(format('public.%I', app_table)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', app_table);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', app_table);
      FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        -- These roles exist on Supabase, but not on ordinary local PostgreSQL.
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
          EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', app_table, api_role);
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END $$;
