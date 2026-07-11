-- ================================================================
-- Supabase Storage RLS 更新：从 x-user-id 迁移到 auth.uid()
-- 配合 Supabase Auth 邮箱+密码认证（JWT Bearer token）
-- ================================================================

-- 1. 删除旧的 RLS 策略（基于 x-user-id header）
DROP POLICY IF EXISTS "Allow public read on cleannote_attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow user upload to own memo folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow user delete own attachments" ON storage.objects;

-- 2. 创建新的 RLS 策略（基于 auth.uid()）

-- 允许所有人读取公开文件（public bucket）
CREATE POLICY "Allow public read on cleannote_attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'cleannote_attachments');

-- 允许已认证用户上传文件到自己的目录 (memo/{userId}/...)
CREATE POLICY "Allow user upload to own memo folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'cleannote_attachments'
  AND (storage.foldername(name))[1] = 'memo'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- 允许用户删除自己的文件
CREATE POLICY "Allow user delete own attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'cleannote_attachments'
  AND (storage.foldername(name))[2] = auth.uid()::text
);
