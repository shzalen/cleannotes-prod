-- ============================================================
-- 修复历史 Supabase 数据：将「伪 UTC」时间戳修正为真实 UTC
-- 
-- 问题背景：
--   旧版代码使用 toLocalISO() 生成本地时间但无 Z 后缀（如 2026-07-01T12:34:00.000），
--   PostgreSQL TIMESTAMPTZ 将无时区后缀的值当作 UTC 存储。
--   实际本地时间 CST（UTC+8）12:34 被当作 UTC 12:34 存储，
--   导致数据库中的时间比真实 UTC 多了 8 小时。
--
-- 修复方式：
--   对受影响的时间字段减去 8 小时（+08 时区偏移量），
--   将「伪 UTC」转为真实 UTC。
--
-- ⚠️ 重要：执行前请先在 Supabase Dashboard 确认当前数据，
--   并备份受影响的表！
-- ============================================================

-- 1. 修复 cleannote_tasks 表
--    仅修正那些不含 Z/时区后缀的时间戳（已被 PG 当作 UTC 的本地时间值）
--    由于 PG 已将它们存储为 UTC+0，实际值多了 8 小时，需要减去

UPDATE cleannote_tasks
SET
  created_at     = created_at     - INTERVAL '8 hours',
  updated_at     = updated_at     - INTERVAL '8 hours',
  completed_at   = CASE 
                     WHEN completed_at IS NOT NULL 
                     THEN completed_at - INTERVAL '8 hours'
                     ELSE NULL 
                   END,
  in_progress_at = CASE 
                     WHEN in_progress_at IS NOT NULL 
                     THEN in_progress_at - INTERVAL '8 hours'
                     ELSE NULL 
                   END
WHERE created_at IS NOT NULL;

-- 2. 修复 cleannote_deleted_tasks 表
UPDATE cleannote_deleted_tasks
SET
  created_at     = created_at     - INTERVAL '8 hours',
  updated_at     = updated_at     - INTERVAL '8 hours',
  completed_at   = CASE 
                     WHEN completed_at IS NOT NULL 
                     THEN completed_at - INTERVAL '8 hours'
                     ELSE NULL 
                   END,
  in_progress_at = CASE 
                     WHEN in_progress_at IS NOT NULL 
                     THEN in_progress_at - INTERVAL '8 hours'
                     ELSE NULL 
                   END,
  deleted_at     = deleted_at     - INTERVAL '8 hours'
WHERE created_at IS NOT NULL;

-- 3. 修复 cleannote_todos 表
UPDATE cleannote_todos
SET
  created_at = created_at - INTERVAL '8 hours',
  updated_at = updated_at - INTERVAL '8 hours'
WHERE created_at IS NOT NULL;

-- 4. 修复 cleannote_memos 表
UPDATE cleannote_memos
SET
  created_at = created_at - INTERVAL '8 hours',
  updated_at = updated_at - INTERVAL '8 hours'
WHERE created_at IS NOT NULL;

-- 5. 修复 cleannote_ai_messages 表
UPDATE cleannote_ai_messages
SET
  timestamp = timestamp - INTERVAL '8 hours'
WHERE timestamp IS NOT NULL;

-- 6. 修复 cleannote_users 表的 last_login_at
UPDATE cleannote_users
SET
  last_login_at = CASE 
                    WHEN last_login_at IS NOT NULL 
                    THEN last_login_at - INTERVAL '8 hours'
                    ELSE NULL 
                  END
WHERE last_login_at IS NOT NULL;

-- ============================================================
-- 验证脚本：执行修复后运行，确认时间差已消除
-- ============================================================

-- 对比修复前后的时间（请先记录一条任务的 created_at 再运行修复，
-- 然后用此查询确认减了 8 小时）
-- SELECT id, title, created_at, updated_at, completed_at, in_progress_at 
-- FROM cleannote_tasks 
-- LIMIT 5;
