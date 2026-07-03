-- ============================================================
-- CleanNotes Database Schema (v3 — incremental sync + user isolation)
-- ============================================================
-- 所有表名以 cleannote_ 开头
-- 用户数据按 user_id 隔离
-- 支持增量写入（单记录 upsert/delete）
-- RLS 策略按 user_id 过滤（需前端传 x-user-id header）
-- ============================================================

-- 1. 用户表
CREATE TABLE IF NOT EXISTS cleannote_users (
  id            TEXT PRIMARY KEY,           -- UUID
  phone         TEXT UNIQUE NOT NULL,       -- 手机号（唯一标识）
  nickname      TEXT NOT NULL DEFAULT '',   -- 昵称
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 任务表
CREATE TABLE IF NOT EXISTS cleannote_tasks (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES cleannote_users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority     TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date     TEXT,
  start_time   TEXT,
  tags         JSONB NOT NULL DEFAULT '[]',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at   TIMESTAMPTZ,
  in_progress_at TIMESTAMPTZ
);

-- 3. 已删除任务表（回收站）
CREATE TABLE IF NOT EXISTS cleannote_deleted_tasks (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES cleannote_users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority     TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date     TEXT,
  start_time   TEXT,
  tags         JSONB NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at   TIMESTAMPTZ,
  in_progress_at TIMESTAMPTZ,
  deleted_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. 上下班倒计时配置（每用户一行）
CREATE TABLE IF NOT EXISTS cleannote_timer_config (
  id         INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  user_id    TEXT NOT NULL UNIQUE REFERENCES cleannote_users(id) ON DELETE CASCADE,
  work_start TEXT NOT NULL DEFAULT '09:00',
  work_end   TEXT NOT NULL DEFAULT '18:00',
  work_days  JSONB NOT NULL DEFAULT '[1,2,3,4,5]'
);

-- 5. AI 对话记录
CREATE TABLE IF NOT EXISTS cleannote_ai_messages (
  id        TEXT PRIMARY KEY,
  user_id   TEXT NOT NULL REFERENCES cleannote_users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content   TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. AI API 配置（每用户一行）
CREATE TABLE IF NOT EXISTS cleannote_ai_config (
  id      INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  user_id TEXT NOT NULL UNIQUE REFERENCES cleannote_users(id) ON DELETE CASCADE,
  api_url TEXT NOT NULL DEFAULT '',
  api_key TEXT NOT NULL DEFAULT '',
  model   TEXT NOT NULL DEFAULT ''
);

-- ============================================================
-- 索引（提升按用户查询性能）
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON cleannote_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_deleted_tasks_user_id ON cleannote_deleted_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_user_id ON cleannote_ai_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_timer_config_user_id ON cleannote_timer_config(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_config_user_id ON cleannote_ai_config(user_id);

-- ============================================================
-- RLS 策略：按 user_id 过滤（通过自定义 header x-user-id）
-- ============================================================
-- 安全说明：
--   当前使用 anon key + x-user-id header 过滤，安全性取决于
--   客户端正确传递 user_id。后续可升级为 Supabase Auth + JWT。
-- ============================================================

-- 先删除旧策略（如果存在）
DROP POLICY IF EXISTS "Allow anon full access on cleannote_users" ON cleannote_users;
DROP POLICY IF EXISTS "Allow anon full access on cleannote_tasks" ON cleannote_tasks;
DROP POLICY IF EXISTS "Allow anon full access on cleannote_timer_config" ON cleannote_timer_config;
DROP POLICY IF EXISTS "Allow anon full access on cleannote_ai_messages" ON cleannote_ai_messages;
DROP POLICY IF EXISTS "Allow anon full access on cleannote_ai_config" ON cleannote_ai_config;

-- 启用 RLS
ALTER TABLE cleannote_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleannote_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleannote_deleted_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleannote_timer_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleannote_ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleannote_ai_config ENABLE ROW LEVEL SECURITY;

-- 新策略：按 x-user-id header 过滤（users 表用 id 匹配）
CREATE POLICY "Users can access own profile" ON cleannote_users
  FOR ALL USING (id = current_setting('request.headers', true)::json ->> 'x-user-id')
  WITH CHECK (id = current_setting('request.headers', true)::json ->> 'x-user-id');

CREATE POLICY "Users can access own tasks" ON cleannote_tasks
  FOR ALL USING (user_id = current_setting('request.headers', true)::json ->> 'x-user-id')
  WITH CHECK (user_id = current_setting('request.headers', true)::json ->> 'x-user-id');

CREATE POLICY "Users can access own deleted tasks" ON cleannote_deleted_tasks
  FOR ALL USING (user_id = current_setting('request.headers', true)::json ->> 'x-user-id')
  WITH CHECK (user_id = current_setting('request.headers', true)::json ->> 'x-user-id');

CREATE POLICY "Users can access own timer config" ON cleannote_timer_config
  FOR ALL USING (user_id = current_setting('request.headers', true)::json ->> 'x-user-id')
  WITH CHECK (user_id = current_setting('request.headers', true)::json ->> 'x-user-id');

CREATE POLICY "Users can access own AI messages" ON cleannote_ai_messages
  FOR ALL USING (user_id = current_setting('request.headers', true)::json ->> 'x-user-id')
  WITH CHECK (user_id = current_setting('request.headers', true)::json ->> 'x-user-id');

CREATE POLICY "Users can access own AI config" ON cleannote_ai_config
  FOR ALL USING (user_id = current_setting('request.headers', true)::json ->> 'x-user-id')
  WITH CHECK (user_id = current_setting('request.headers', true)::json ->> 'x-user-id');

-- ============================================================
-- 迁移脚本（如果从 v2 升级）
-- ============================================================
-- 1. 补建 deleted_tasks 表（上面已包含）
-- 2. 修复 ai_messages role 约束（上面已包含 'system'）
-- 3. 如果旧约束存在，需要先删除再重建：
--    ALTER TABLE cleannote_ai_messages DROP CONSTRAINT IF EXISTS cleannote_ai_messages_role_check;
--    ALTER TABLE cleannote_ai_messages ADD CONSTRAINT cleannote_ai_messages_role_check
--      CHECK (role IN ('user', 'assistant', 'system'));

-- ============================================================
-- 迁移脚本（v4 → v5：新增 in_progress_at 字段，用于任务执行耗时追踪）
-- ============================================================
-- 已在建表语句中添加 in_progress_at 列（新建数据库无需执行以下语句）
-- 如果从 v4 旧数据库升级，请在 Supabase SQL Editor 中执行：
--
--   ALTER TABLE cleannote_tasks ADD COLUMN IF NOT EXISTS in_progress_at TIMESTAMPTZ;
--   ALTER TABLE cleannote_deleted_tasks ADD COLUMN IF NOT EXISTS in_progress_at TIMESTAMPTZ;
--
-- 这两个语句是幂等的（IF NOT EXISTS），可以安全地多次执行。
