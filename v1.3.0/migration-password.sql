-- ============================================================
-- CleanNotes 迁移脚本：为 cleannote_users 增加密码凭据字段
-- 版本：v1.3.0 → 支持密码登录
-- ============================================================
-- 适用场景：已部署的旧数据库（cleannote_users 表尚未含密码字段）
-- 新建数据库无需执行（supabase-schema.sql 已包含这两列）
-- 语句幂等（IF NOT EXISTS），可安全多次执行
-- ============================================================

ALTER TABLE cleannote_users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,  -- PBKDF2-HMAC-SHA256 派生哈希（base64）
  ADD COLUMN IF NOT EXISTS password_salt TEXT;  -- 每用户随机盐（base64，16 字节）

-- 说明：
-- - 密码由客户端使用 Web Crypto（PBKDF2-HMAC-SHA256，210,000 次迭代）计算后上传哈希，
--   服务端仅存储哈希与盐，无法还原明文密码。
-- - 历史账号（password_hash 为 NULL）在首次使用「密码登录」时会被要求设置密码。
