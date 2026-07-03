-- ================================================================
-- Supabase Storage: cleannote_attachments bucket
-- 用于备忘录的图片和文件上传
-- ================================================================

-- 1. 创建 Storage Bucket（在 Supabase Dashboard → Storage 中手动创建，或通过 SQL）
--    Bucket Name: cleannote_attachments
--    Public bucket: YES (勾选)
--    文件大小限制: 10MB (建议)

-- 如果通过 SQL 创建（需要 storage 扩展权限）:
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'cleannote_attachments',
--   'cleannote_attachments',
--   true,
--   10485760,  -- 10MB
--   ARRAY['image/*', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip', 'application/x-rar-compressed']
-- );

-- 2. RLS Policy — 允许已认证用户上传自己的文件
-- (通过 x-user-id header 识别用户)

-- 允许用户读取公开文件（public bucket 默认允许）
CREATE POLICY "Allow public read on cleannote_attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'cleannote_attachments');

-- 允许用户上传文件到自己的目录
CREATE POLICY "Allow user upload to own memo folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'cleannote_attachments'
  AND (storage.foldername(name))[1] = 'memo'
  AND (storage.foldername(name))[2] = (current_setting('request.headers')::json->>'x-user-id')
);

-- 允许用户删除自己的文件
CREATE POLICY "Allow user delete own attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'cleannote_attachments'
  AND (storage.foldername(name))[2] = (current_setting('request.headers')::json->>'x-user-id')
);
