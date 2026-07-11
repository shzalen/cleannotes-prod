-- ================================================================
-- CleanNotes RLS Security Audit Migration (S-06, S-15, S-20)
-- ================================================================
-- This migration ONLY affects cleannote_* tables.
-- It does NOT touch any other schemas or tables on this Supabase instance.
-- ================================================================

-- ================================================================
-- S-06: Ensure ALL cleannote_* RLS policies use auth.uid(), not x-user-id
-- ================================================================

-- First, drop any policies that might still use the old x-user-id header approach.
-- We drop and recreate all policies to guarantee they use auth.uid().

-- cleannote_tasks
DROP POLICY IF EXISTS "tasks_select_own" ON cleannote_tasks;
DROP POLICY IF EXISTS "tasks_insert_own" ON cleannote_tasks;
DROP POLICY IF EXISTS "tasks_update_own" ON cleannote_tasks;
DROP POLICY IF EXISTS "tasks_delete_own" ON cleannote_tasks;
DROP POLICY IF EXISTS "Enable select for own tasks" ON cleannote_tasks;
DROP POLICY IF EXISTS "Enable insert for own tasks" ON cleannote_tasks;
DROP POLICY IF EXISTS "Enable update for own tasks" ON cleannote_tasks;
DROP POLICY IF EXISTS "Enable delete for own tasks" ON cleannote_tasks;

CREATE POLICY "tasks_select_own" ON cleannote_tasks FOR SELECT TO authenticated USING (user_id = auth.uid()::text);
CREATE POLICY "tasks_insert_own" ON cleannote_tasks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "tasks_update_own" ON cleannote_tasks FOR UPDATE TO authenticated USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "tasks_delete_own" ON cleannote_tasks FOR DELETE TO authenticated USING (user_id = auth.uid()::text);

-- cleannote_deleted_tasks
DROP POLICY IF EXISTS "deleted_tasks_select_own" ON cleannote_deleted_tasks;
DROP POLICY IF EXISTS "deleted_tasks_insert_own" ON cleannote_deleted_tasks;
DROP POLICY IF EXISTS "deleted_tasks_update_own" ON cleannote_deleted_tasks;
DROP POLICY IF EXISTS "deleted_tasks_delete_own" ON cleannote_deleted_tasks;

CREATE POLICY "deleted_tasks_select_own" ON cleannote_deleted_tasks FOR SELECT TO authenticated USING (user_id = auth.uid()::text);
CREATE POLICY "deleted_tasks_insert_own" ON cleannote_deleted_tasks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "deleted_tasks_update_own" ON cleannote_deleted_tasks FOR UPDATE TO authenticated USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "deleted_tasks_delete_own" ON cleannote_deleted_tasks FOR DELETE TO authenticated USING (user_id = auth.uid()::text);

-- cleannote_todos
DROP POLICY IF EXISTS "todos_select_own" ON cleannote_todos;
DROP POLICY IF EXISTS "todos_insert_own" ON cleannote_todos;
DROP POLICY IF EXISTS "todos_update_own" ON cleannote_todos;
DROP POLICY IF EXISTS "todos_delete_own" ON cleannote_todos;

CREATE POLICY "todos_select_own" ON cleannote_todos FOR SELECT TO authenticated USING (user_id = auth.uid()::text);
CREATE POLICY "todos_insert_own" ON cleannote_todos FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "todos_update_own" ON cleannote_todos FOR UPDATE TO authenticated USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "todos_delete_own" ON cleannote_todos FOR DELETE TO authenticated USING (user_id = auth.uid()::text);

-- cleannote_memos
DROP POLICY IF EXISTS "memos_select_own" ON cleannote_memos;
DROP POLICY IF EXISTS "memos_insert_own" ON cleannote_memos;
DROP POLICY IF EXISTS "memos_update_own" ON cleannote_memos;
DROP POLICY IF EXISTS "memos_delete_own" ON cleannote_memos;

CREATE POLICY "memos_select_own" ON cleannote_memos FOR SELECT TO authenticated USING (user_id = auth.uid()::text);
CREATE POLICY "memos_insert_own" ON cleannote_memos FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "memos_update_own" ON cleannote_memos FOR UPDATE TO authenticated USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "memos_delete_own" ON cleannote_memos FOR DELETE TO authenticated USING (user_id = auth.uid()::text);

-- cleannote_weekly_reports
DROP POLICY IF EXISTS "weekly_reports_select_own" ON cleannote_weekly_reports;
DROP POLICY IF EXISTS "weekly_reports_insert_own" ON cleannote_weekly_reports;
DROP POLICY IF EXISTS "weekly_reports_update_own" ON cleannote_weekly_reports;
DROP POLICY IF EXISTS "weekly_reports_delete_own" ON cleannote_weekly_reports;

CREATE POLICY "weekly_reports_select_own" ON cleannote_weekly_reports FOR SELECT TO authenticated USING (user_id = auth.uid()::text);
CREATE POLICY "weekly_reports_insert_own" ON cleannote_weekly_reports FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "weekly_reports_update_own" ON cleannote_weekly_reports FOR UPDATE TO authenticated USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "weekly_reports_delete_own" ON cleannote_weekly_reports FOR DELETE TO authenticated USING (user_id = auth.uid()::text);

-- cleannote_growth
DROP POLICY IF EXISTS "growth_select_own" ON cleannote_growth;
DROP POLICY IF EXISTS "growth_insert_own" ON cleannote_growth;
DROP POLICY IF EXISTS "growth_update_own" ON cleannote_growth;
DROP POLICY IF EXISTS "growth_delete_own" ON cleannote_growth;

CREATE POLICY "growth_select_own" ON cleannote_growth FOR SELECT TO authenticated USING (user_id = auth.uid()::text);
CREATE POLICY "growth_insert_own" ON cleannote_growth FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "growth_update_own" ON cleannote_growth FOR UPDATE TO authenticated USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "growth_delete_own" ON cleannote_growth FOR DELETE TO authenticated USING (user_id = auth.uid()::text);

-- cleannote_ai_messages
DROP POLICY IF EXISTS "ai_messages_select_own" ON cleannote_ai_messages;
DROP POLICY IF EXISTS "ai_messages_insert_own" ON cleannote_ai_messages;
DROP POLICY IF EXISTS "ai_messages_update_own" ON cleannote_ai_messages;
DROP POLICY IF EXISTS "ai_messages_delete_own" ON cleannote_ai_messages;

CREATE POLICY "ai_messages_select_own" ON cleannote_ai_messages FOR SELECT TO authenticated USING (user_id = auth.uid()::text);
CREATE POLICY "ai_messages_insert_own" ON cleannote_ai_messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "ai_messages_update_own" ON cleannote_ai_messages FOR UPDATE TO authenticated USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "ai_messages_delete_own" ON cleannote_ai_messages FOR DELETE TO authenticated USING (user_id = auth.uid()::text);

-- cleannote_ai_config
DROP POLICY IF EXISTS "ai_config_select_own" ON cleannote_ai_config;
DROP POLICY IF EXISTS "ai_config_insert_own" ON cleannote_ai_config;
DROP POLICY IF EXISTS "ai_config_update_own" ON cleannote_ai_config;
DROP POLICY IF EXISTS "ai_config_delete_own" ON cleannote_ai_config;

CREATE POLICY "ai_config_select_own" ON cleannote_ai_config FOR SELECT TO authenticated USING (user_id = auth.uid()::text);
CREATE POLICY "ai_config_insert_own" ON cleannote_ai_config FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "ai_config_update_own" ON cleannote_ai_config FOR UPDATE TO authenticated USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "ai_config_delete_own" ON cleannote_ai_config FOR DELETE TO authenticated USING (user_id = auth.uid()::text);

-- cleannote_timer_config
DROP POLICY IF EXISTS "timer_config_select_own" ON cleannote_timer_config;
DROP POLICY IF EXISTS "timer_config_insert_own" ON cleannote_timer_config;
DROP POLICY IF EXISTS "timer_config_update_own" ON cleannote_timer_config;
DROP POLICY IF EXISTS "timer_config_delete_own" ON cleannote_timer_config;

CREATE POLICY "timer_config_select_own" ON cleannote_timer_config FOR SELECT TO authenticated USING (user_id = auth.uid()::text);
CREATE POLICY "timer_config_insert_own" ON cleannote_timer_config FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "timer_config_update_own" ON cleannote_timer_config FOR UPDATE TO authenticated USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "timer_config_delete_own" ON cleannote_timer_config FOR DELETE TO authenticated USING (user_id = auth.uid()::text);

-- ================================================================
-- S-15: Harden migrate_user_data RPC — add migration lock
-- ================================================================
-- Add a column to track if data has already been migrated, preventing
-- repeated calls with arbitrary phone numbers.

DO $$
BEGIN
  -- Add migrated_at column to cleannote_users if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cleannote_users' AND column_name = 'migrated_at'
  ) THEN
    ALTER TABLE cleannote_users ADD COLUMN migrated_at TIMESTAMPTZ;
  END IF;
END $$;

-- Update the migrate_user_data function to mark migrated accounts
-- and reject already-migrated accounts
CREATE OR REPLACE FUNCTION migrate_user_data(p_phone TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_user RECORD;
  v_new_user_id TEXT;
  v_result JSON;
BEGIN
  -- Get the calling user's ID
  v_new_user_id := auth.uid()::text;

  IF v_new_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Find the old user by phone
  SELECT * INTO v_old_user FROM cleannote_users WHERE phone = p_phone LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Old account not found');
  END IF;

  -- S-15: Reject if already migrated
  IF v_old_user.migrated_at IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Already migrated');
  END IF;

  -- Mark as migrated BEFORE copying data (prevent race conditions)
  UPDATE cleannote_users SET migrated_at = now() WHERE id = v_old_user.id;

  -- Copy tasks
  INSERT INTO cleannote_tasks (id, user_id, title, description, status, priority, due_date, start_date, start_time, tags, created_at, updated_at, completed_at, in_progress_at)
  SELECT id, v_new_user_id, title, description, status, priority, due_date, start_date, start_time, tags, created_at, updated_at, completed_at, in_progress_at
  FROM cleannote_tasks WHERE user_id = v_old_user.id
  ON CONFLICT (id) DO NOTHING;

  -- Copy deleted tasks
  INSERT INTO cleannote_deleted_tasks (id, user_id, title, description, status, priority, due_date, start_date, start_time, tags, created_at, updated_at, completed_at, in_progress_at, deleted_at)
  SELECT id, v_new_user_id, title, description, status, priority, due_date, start_date, start_time, tags, created_at, updated_at, completed_at, in_progress_at, deleted_at
  FROM cleannote_deleted_tasks WHERE user_id = v_old_user.id
  ON CONFLICT (id) DO NOTHING;

  -- Copy memos
  INSERT INTO cleannote_memos (id, user_id, title, content, tags, pinned, icon, sort_order, created_at, updated_at)
  SELECT id, v_new_user_id, title, content, tags, pinned, icon, sort_order, created_at, updated_at
  FROM cleannote_memos WHERE user_id = v_old_user.id
  ON CONFLICT (id) DO NOTHING;

  -- Copy todos
  INSERT INTO cleannote_todos (id, user_id, title, description, estimated_start, estimated_end, linked_task_id, importance, created_at, updated_at)
  SELECT id, v_new_user_id, title, description, estimated_start, estimated_end, linked_task_id, importance, created_at, updated_at
  FROM cleannote_todos WHERE user_id = v_old_user.id
  ON CONFLICT (id) DO NOTHING;

  RETURN json_build_object('success', true, 'message', 'Migration completed');
END;
$$;

-- ================================================================
-- Verification query — run this to confirm all policies use auth.uid()
-- ================================================================
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename LIKE 'cleannote_%'
-- ORDER BY tablename, policyname;
