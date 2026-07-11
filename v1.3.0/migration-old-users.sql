-- ============================================================
-- CleanNotes 旧用户数据迁移脚本
-- ============================================================
-- 用途：将旧手机号认证用户的数据迁移到 Supabase Auth 邮箱认证用户
-- 前置条件：已执行 migration-auth-supabase.sql
-- 执行位置：Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ============================================================
-- 第一步：修复 RLS 策略名不匹配问题
-- migration-auth-supabase.sql 中 DROP POLICY 使用的名称
-- 与 migration-todos-growth.sql / migration-weekly-reports.sql
-- 中实际创建的策略名不匹配，需要补充删除
-- ============================================================

-- cleannote_todos 旧策略（实际名称是 todos_*，不是 "Users can access own todos"）
DROP POLICY IF EXISTS "todos_select" ON cleannote_todos;
DROP POLICY IF EXISTS "todos_insert" ON cleannote_todos;
DROP POLICY IF EXISTS "todos_update" ON cleannote_todos;
DROP POLICY IF EXISTS "todos_delete" ON cleannote_todos;
-- 再次尝试删除 migration-auth-supabase.sql 创建的新策略（如果存在）
DROP POLICY IF EXISTS "Users can access own todos" ON cleannote_todos;

-- cleannote_growth 旧策略（实际名称是 growth_*，不是 "Users can access own growth"）
DROP POLICY IF EXISTS "growth_select" ON cleannote_growth;
DROP POLICY IF EXISTS "growth_insert" ON cleannote_growth;
DROP POLICY IF EXISTS "growth_update" ON cleannote_growth;
DROP POLICY IF EXISTS "growth_delete" ON cleannote_growth;
DROP POLICY IF EXISTS "Users can access own growth" ON cleannote_growth;

-- cleannote_weekly_reports 旧策略（实际名称是 weekly_reports_*）
DROP POLICY IF EXISTS "weekly_reports_select" ON cleannote_weekly_reports;
DROP POLICY IF EXISTS "weekly_reports_insert" ON cleannote_weekly_reports;
DROP POLICY IF EXISTS "weekly_reports_update" ON cleannote_weekly_reports;
DROP POLICY IF EXISTS "weekly_reports_delete" ON cleannote_weekly_reports;
DROP POLICY IF EXISTS "Users can access own weekly reports" ON cleannote_weekly_reports;

-- 重新创建基于 auth.uid() 的策略（确保唯一）
CREATE POLICY "Users can access own todos" ON cleannote_todos
  FOR ALL USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can access own growth" ON cleannote_growth
  FOR ALL USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can access own weekly reports" ON cleannote_weekly_reports
  FOR ALL USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- ============================================================
-- 第二步：为 cleannote_users 添加 migrated_to 列
-- 记录旧用户已迁移到哪个新的 Supabase Auth 用户
-- ============================================================

ALTER TABLE cleannote_users ADD COLUMN IF NOT EXISTS migrated_to TEXT;

-- ============================================================
-- 第三步：创建数据迁移 RPC 函数
-- 使用 SECURITY DEFINER 绕过 RLS（新用户尚未拥有旧数据）
-- ============================================================

CREATE OR REPLACE FUNCTION migrate_user_data(p_phone TEXT)
RETURNS TABLE(success BOOLEAN, old_nickname TEXT, msg TEXT) AS $$
DECLARE
  v_old_user_id TEXT;
  v_new_user_id TEXT;
  v_old_nickname TEXT;
  v_migrated TEXT;
BEGIN
  -- 获取当前登录的 Supabase Auth 用户 ID
  v_new_user_id := auth.uid()::text;

  IF v_new_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, '未登录，无法迁移';
    RETURN;
  END IF;

  -- 检查当前用户是否已有数据（防止重复迁移）
  IF EXISTS (SELECT 1 FROM cleannote_tasks WHERE user_id = v_new_user_id LIMIT 1)
     OR EXISTS (SELECT 1 FROM cleannote_memos WHERE user_id = v_new_user_id LIMIT 1)
     OR EXISTS (SELECT 1 FROM cleannote_growth WHERE user_id = v_new_user_id LIMIT 1) THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, '当前账号已有数据，无需迁移';
    RETURN;
  END IF;

  -- 根据手机号查找旧用户
  SELECT id, nickname, migrated_to INTO v_old_user_id, v_old_nickname, v_migrated
  FROM cleannote_users WHERE phone = p_phone;

  IF v_old_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, '未找到该手机号对应的旧账号';
    RETURN;
  END IF;

  IF v_migrated IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, '该旧账号已迁移至其他邮箱';
    RETURN;
  END IF;

  -- 迁移所有数据表：将旧 user_id 替换为新 user_id
  UPDATE cleannote_tasks SET user_id = v_new_user_id WHERE user_id = v_old_user_id;
  UPDATE cleannote_deleted_tasks SET user_id = v_new_user_id WHERE user_id = v_old_user_id;
  UPDATE cleannote_ai_messages SET user_id = v_new_user_id WHERE user_id = v_old_user_id;

  -- timer_config 和 ai_config 的 user_id 是 UNIQUE，先删新用户可能存在的空行
  DELETE FROM cleannote_timer_config WHERE user_id = v_new_user_id;
  UPDATE cleannote_timer_config SET user_id = v_new_user_id WHERE user_id = v_old_user_id;

  DELETE FROM cleannote_ai_config WHERE user_id = v_new_user_id;
  UPDATE cleannote_ai_config SET user_id = v_new_user_id WHERE user_id = v_old_user_id;

  UPDATE cleannote_todos SET user_id = v_new_user_id WHERE user_id = v_old_user_id;
  UPDATE cleannote_memos SET user_id = v_new_user_id WHERE user_id = v_old_user_id;

  -- growth 表 user_id 是 PRIMARY KEY，先删新用户可能存在的空行
  DELETE FROM cleannote_growth WHERE user_id = v_new_user_id;
  UPDATE cleannote_growth SET user_id = v_new_user_id WHERE user_id = v_old_user_id;

  UPDATE cleannote_weekly_reports SET user_id = v_new_user_id WHERE user_id = v_old_user_id;

  -- 标记旧用户已迁移
  UPDATE cleannote_users SET migrated_to = v_new_user_id WHERE id = v_old_user_id;

  RETURN QUERY SELECT TRUE, v_old_nickname, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 验证
-- ============================================================
-- 执行后检查：
-- 1. SELECT proname FROM pg_proc WHERE proname = 'migrate_user_data';
--    应返回 migrate_user_data
--
-- 2. SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'cleannote_users' AND column_name = 'migrated_to';
--    应返回 migrated_to
--
-- 3. SELECT tablename, policyname FROM pg_policies
--    WHERE schemaname = 'public' AND tablename IN ('cleannote_todos', 'cleannote_growth', 'cleannote_weekly_reports');
--    每个表应只有一条策略，USING 表达式包含 auth.uid()
