-- ============================================================
-- CleanNotes Migration: Todos + Growth Supabase 同步
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴执行
-- ============================================================

-- 1. 待办事项表
CREATE TABLE IF NOT EXISTS cleannote_todos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES cleannote_users(id),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  estimated_start TEXT,          -- YYYY-MM-DD
  estimated_end TEXT,            -- YYYY-MM-DD
  linked_task_id TEXT,           -- 转任务后关联的任务 ID
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE cleannote_todos ENABLE ROW LEVEL SECURITY;

-- RLS：读写均按 user_id 过滤
CREATE POLICY "todos_select" ON cleannote_todos
  FOR SELECT USING (
    user_id = current_setting('request.headers', true)::json ->> 'x-user-id'
  );

CREATE POLICY "todos_insert" ON cleannote_todos
  FOR INSERT WITH CHECK (
    user_id = current_setting('request.headers', true)::json ->> 'x-user-id'
  );

CREATE POLICY "todos_update" ON cleannote_todos
  FOR UPDATE USING (
    user_id = current_setting('request.headers', true)::json ->> 'x-user-id'
  );

CREATE POLICY "todos_delete" ON cleannote_todos
  FOR DELETE USING (
    user_id = current_setting('request.headers', true)::json ->> 'x-user-id'
  );

-- 索引
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON cleannote_todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_updated_at ON cleannote_todos(updated_at);

-- ============================================================

-- 2. 养成系统表（每用户一行，JSONB 存储完整数据）
CREATE TABLE IF NOT EXISTS cleannote_growth (
  user_id TEXT PRIMARY KEY REFERENCES cleannote_users(id),
  state_json JSONB NOT NULL DEFAULT '{}',        -- GrowthState
  xp_events_json JSONB NOT NULL DEFAULT '[]',    -- XpEvent[]
  achievements_json JSONB NOT NULL DEFAULT '[]',  -- AchievementRecord[]
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE cleannote_growth ENABLE ROW LEVEL SECURITY;

CREATE POLICY "growth_select" ON cleannote_growth
  FOR SELECT USING (
    user_id = current_setting('request.headers', true)::json ->> 'x-user-id'
  );

CREATE POLICY "growth_insert" ON cleannote_growth
  FOR INSERT WITH CHECK (
    user_id = current_setting('request.headers', true)::json ->> 'x-user-id'
  );

CREATE POLICY "growth_update" ON cleannote_growth
  FOR UPDATE USING (
    user_id = current_setting('request.headers', true)::json ->> 'x-user-id'
  );

CREATE POLICY "growth_delete" ON cleannote_growth
  FOR DELETE USING (
    user_id = current_setting('request.headers', true)::json ->> 'x-user-id'
  );
