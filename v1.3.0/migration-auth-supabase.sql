-- ============================================================
-- CleanNotes 认证迁移：自定义手机号认证 → Supabase Auth 邮箱认证
-- ============================================================
-- 执行前请确保：
-- 1. Supabase Dashboard → Authentication → Providers → Email 已启用
-- 2. 建议暂时关闭 "Confirm email" 以便测试（之后可再开启）
-- 3. 此 SQL 在 Supabase SQL Editor 中执行
-- ============================================================

-- ============================================================
-- 第一步：删除旧 RLS 策略（基于 x-user-id header）
-- ============================================================

DROP POLICY IF EXISTS "Users can access own profile" ON cleannote_users;
DROP POLICY IF EXISTS "Users can access own tasks" ON cleannote_tasks;
DROP POLICY IF EXISTS "Users can access own deleted tasks" ON cleannote_deleted_tasks;
DROP POLICY IF EXISTS "Users can access own timer config" ON cleannote_timer_config;
DROP POLICY IF EXISTS "Users can access own AI messages" ON cleannote_ai_messages;
DROP POLICY IF EXISTS "Users can access own AI config" ON cleannote_ai_config;

-- Todo / Memo / Growth / Weekly Reports 表的旧策略
DROP POLICY IF EXISTS "Users can access own todos" ON cleannote_todos;
DROP POLICY IF EXISTS "Users can access own memos" ON cleannote_memos;
DROP POLICY IF EXISTS "Users can access own growth" ON cleannote_growth;
DROP POLICY IF EXISTS "Users can access own weekly reports" ON cleannote_weekly_reports;

-- ============================================================
-- 第二步：删除外键约束（引用 cleannote_users(id)）
-- 新用户由 Supabase Auth 管理，ID 不在 cleannote_users 表中
-- ============================================================

ALTER TABLE cleannote_tasks DROP CONSTRAINT IF EXISTS cleannote_tasks_user_id_fkey;
ALTER TABLE cleannote_deleted_tasks DROP CONSTRAINT IF EXISTS cleannote_deleted_tasks_user_id_fkey;
ALTER TABLE cleannote_timer_config DROP CONSTRAINT IF EXISTS cleannote_timer_config_user_id_fkey;
ALTER TABLE cleannote_ai_messages DROP CONSTRAINT IF EXISTS cleannote_ai_messages_user_id_fkey;
ALTER TABLE cleannote_ai_config DROP CONSTRAINT IF EXISTS cleannote_ai_config_user_id_fkey;
ALTER TABLE cleannote_todos DROP CONSTRAINT IF EXISTS cleannote_todos_user_id_fkey;
ALTER TABLE cleannote_memos DROP CONSTRAINT IF EXISTS cleannote_memos_user_id_fkey;
ALTER TABLE cleannote_growth DROP CONSTRAINT IF EXISTS cleannote_growth_user_id_fkey;
ALTER TABLE cleannote_weekly_reports DROP CONSTRAINT IF EXISTS cleannote_weekly_reports_user_id_fkey;

-- ============================================================
-- 第三步：创建新 RLS 策略（基于 auth.uid()）
-- ============================================================

-- cleannote_tasks
CREATE POLICY "Users can access own tasks" ON cleannote_tasks
  FOR ALL USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- cleannote_deleted_tasks
CREATE POLICY "Users can access own deleted tasks" ON cleannote_deleted_tasks
  FOR ALL USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- cleannote_timer_config
CREATE POLICY "Users can access own timer config" ON cleannote_timer_config
  FOR ALL USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- cleannote_ai_messages
CREATE POLICY "Users can access own AI messages" ON cleannote_ai_messages
  FOR ALL USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- cleannote_ai_config
CREATE POLICY "Users can access own AI config" ON cleannote_ai_config
  FOR ALL USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- cleannote_todos
CREATE POLICY "Users can access own todos" ON cleannote_todos
  FOR ALL USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- cleannote_memos
CREATE POLICY "Users can access own memos" ON cleannote_memos
  FOR ALL USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- cleannote_growth
CREATE POLICY "Users can access own growth" ON cleannote_growth
  FOR ALL USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- cleannote_weekly_reports
CREATE POLICY "Users can access own weekly reports" ON cleannote_weekly_reports
  FOR ALL USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- ============================================================
-- 第四步：cleannote_users 表处理
-- 保留表但不再用于认证，仅作历史数据参考
-- 添加新策略允许已认证用户读取自己的旧记录（如果有）
-- ============================================================

CREATE POLICY "Users can access own old profile" ON cleannote_users
  FOR ALL USING (id = auth.uid()::text)
  WITH CHECK (id = auth.uid()::text);

-- ============================================================
-- 第五步：Storage bucket RLS 更新
-- ============================================================
-- 如果 cleannote_attachments bucket 存在，更新其 RLS 策略
-- 改为基于 auth.uid() 而非 x-user-id header

-- 注意：Storage RLS 需要在 Supabase Dashboard → Storage 中配置
-- 建议策略：
--   SELECT: bucket_id = 'cleannote_attachments'
--   INSERT: bucket_id = 'cleannote_attachments' AND auth.uid()::text = (storage.foldername(name))[1]
--   UPDATE: bucket_id = 'cleannote_attachments' AND auth.uid()::text = (storage.foldername(name))[1]
--   DELETE: bucket_id = 'cleannote_attachments' AND auth.uid()::text = (storage.foldername(name))[1]

-- ============================================================
-- 迁移完成验证
-- ============================================================
-- 执行以下查询验证策略已更新：
--   SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
--
-- 预期结果：所有策略的 USING 表达式应包含 auth.uid()
-- 不应再出现 current_setting('request.headers') 或 x-user-id
