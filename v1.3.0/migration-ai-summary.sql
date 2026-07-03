-- ============================================================
-- CleanNotes Migration: Add ai_summary + ai_summary_status columns to weekly reports
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴执行
-- ============================================================

ALTER TABLE cleannote_weekly_reports
  ADD COLUMN IF NOT EXISTS ai_summary TEXT DEFAULT NULL;

ALTER TABLE cleannote_weekly_reports
  ADD COLUMN IF NOT EXISTS ai_summary_status TEXT DEFAULT NULL
  CHECK (ai_summary_status IN ('generating', 'success', 'failed'));
