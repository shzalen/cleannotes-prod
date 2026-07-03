-- Migration: cleannote_memos
-- 备忘录表（2026-06-16）

CREATE TABLE IF NOT EXISTS cleannote_memos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]',
  pinned BOOLEAN NOT NULL DEFAULT false,
  icon TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

-- 为旧表补充 icon / sort_order 列（若已存在则跳过）
ALTER TABLE cleannote_memos ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT '';
ALTER TABLE cleannote_memos ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Enable RLS
ALTER TABLE cleannote_memos ENABLE ROW LEVEL SECURITY;

-- Policy: 用户只能访问自己的备忘
CREATE POLICY "Users can access own memos"
  ON cleannote_memos
  FOR ALL
  USING (user_id = current_setting('request.headers', true)::json->>'x-user-id')
  WITH CHECK (user_id = current_setting('request.headers', true)::json->>'x-user-id');

-- 索引
CREATE INDEX IF NOT EXISTS idx_memos_user_id ON cleannote_memos(user_id);
CREATE INDEX IF NOT EXISTS idx_memos_updated_at ON cleannote_memos(updated_at);
CREATE INDEX IF NOT EXISTS idx_memos_sort_order ON cleannote_memos(sort_order);
