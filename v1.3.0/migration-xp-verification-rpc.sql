-- ================================================================
-- S6.1: Server-side XP Verification RPC
-- ================================================================
-- Creates a PostgreSQL function that validates task completion and
-- calculates XP on the server side, preventing client-side tampering.
--
-- IMPORTANT: This only accesses cleannote_* tables and does NOT affect
-- any other databases or schemas on the Supabase instance.
--
-- The function uses auth.uid() from the JWT for user identification,
-- so users cannot claim XP for other users' tasks.
-- ================================================================

-- Drop existing function if it exists (safe re-run)
DROP FUNCTION IF EXISTS cleannote_calculate_xp(TEXT);

CREATE OR REPLACE FUNCTION cleannote_calculate_xp(p_task_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task RECORD;
  v_state JSONB;
  v_streak_days INT;
  v_total_xp INT := 0;
  v_breakdown JSONB := '[]'::JSONB;
  v_completed_hour INT;
  v_today TEXT;
  v_user_id TEXT;
BEGIN
  -- Get user ID from JWT context
  v_user_id := auth.uid()::text;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Verify task belongs to user and is completed
  SELECT priority, due_date, completed_at, status
  INTO v_task
  FROM cleannote_tasks
  WHERE id = p_task_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Task not found');
  END IF;

  IF v_task.status != 'done' THEN
    RETURN jsonb_build_object('error', 'Task not completed');
  END IF;

  -- Get streak days from growth state
  SELECT state_json INTO v_state
  FROM cleannote_growth
  WHERE user_id = v_user_id;

  v_streak_days := COALESCE((v_state->>'streakDays')::INT, 0);

  -- Base completion XP
  v_breakdown := v_breakdown || jsonb_build_array(
    jsonb_build_object('source', 'complete', 'xp', 10)
  );
  v_total_xp := v_total_xp + 10;

  -- High priority bonus
  IF v_task.priority = 'high' THEN
    v_breakdown := v_breakdown || jsonb_build_array(
      jsonb_build_object('source', 'priority', 'xp', 5)
    );
    v_total_xp := v_total_xp + 5;
  END IF;

  -- Night bonus (0-6 AM, based on completed_at hour)
  IF v_task.completed_at IS NOT NULL THEN
    v_completed_hour := EXTRACT(HOUR FROM v_task.completed_at::TIMESTAMPTZ AT TIME ZONE 'UTC');
    IF v_completed_hour < 6 THEN
      v_breakdown := v_breakdown || jsonb_build_array(
        jsonb_build_object('source', 'night', 'xp', 3)
      );
      v_total_xp := v_total_xp + 3;
    END IF;
  END IF;

  -- Deadline day completion bonus
  v_today := to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  IF v_task.due_date IS NOT NULL AND v_task.due_date = v_today THEN
    v_breakdown := v_breakdown || jsonb_build_array(
      jsonb_build_object('source', 'deadline', 'xp', 5)
    );
    v_total_xp := v_total_xp + 5;
  END IF;

  -- Streak bonus
  IF v_streak_days > 0 THEN
    v_breakdown := v_breakdown || jsonb_build_array(
      jsonb_build_object('source', 'streak', 'xp', v_streak_days * 2)
    );
    v_total_xp := v_total_xp + v_streak_days * 2;
  END IF;

  RETURN jsonb_build_object(
    'totalXp', v_total_xp,
    'breakdown', v_breakdown
  );
END;
$$;

-- Grant execute to authenticated users only
REVOKE ALL ON FUNCTION cleannote_calculate_xp(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleannote_calculate_xp(TEXT) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION cleannote_calculate_xp(TEXT) IS
  'CleanNotes: Server-side XP verification. Validates task completion and calculates XP breakdown. Only accesses cleannote_* tables.';
