-- ============================================================
-- CleanNotes Migration: Weekly Reports
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴执行
-- ============================================================

-- 周报表
CREATE TABLE IF NOT EXISTS cleannote_weekly_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  content TEXT DEFAULT '',
  summary JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE cleannote_weekly_reports ENABLE ROW LEVEL SECURITY;

-- RLS：读写均按 user_id 过滤
CREATE POLICY "weekly_reports_select" ON cleannote_weekly_reports
  FOR SELECT USING (
    user_id = current_setting('request.headers', true)::json ->> 'x-user-id'
  );

CREATE POLICY "weekly_reports_insert" ON cleannote_weekly_reports
  FOR INSERT WITH CHECK (
    user_id = current_setting('request.headers', true)::json ->> 'x-user-id'
  );

CREATE POLICY "weekly_reports_update" ON cleannote_weekly_reports
  FOR UPDATE USING (
    user_id = current_setting('request.headers', true)::json ->> 'x-user-id'
  );

CREATE POLICY "weekly_reports_delete" ON cleannote_weekly_reports
  FOR DELETE USING (
    user_id = current_setting('request.headers', true)::json ->> 'x-user-id'
  );

-- 索引
CREATE INDEX IF NOT EXISTS idx_weekly_reports_user_id ON cleannote_weekly_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_week_start ON cleannote_weekly_reports(week_start);
