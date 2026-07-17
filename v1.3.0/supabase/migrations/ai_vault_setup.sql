-- ============================================================
-- CleanNotepad AI Vault 安全配置
-- 
-- 部署步骤:
-- 1. 在 Supabase Dashboard → Vault 中添加密钥:
--    Name:  ai_config_secret
--    Secret: (随机生成 32 位字符串, 例: openssl rand -hex 16)
--    Description: CleanNotepad AI 加密密钥
--
-- 2. 在本文件所在的 SQL Editor 中执行以下脚本
-- ============================================================

-- RPC 函数: 安全地从 Vault 读取加密密钥
-- 只有已认证用户才能调用
CREATE OR REPLACE FUNCTION get_ai_config_secret()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _secret text;
BEGIN
  -- 验证用户已登录
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 从 Vault 读取密钥
  SELECT decrypted_secret INTO _secret
  FROM vault.decrypted_secrets
  WHERE name = 'ai_config_secret'
  LIMIT 1;

  IF _secret IS NULL THEN
    RETURN jsonb_build_object('secret', 'cleannotes-fallback-2026');
  END IF;

  RETURN jsonb_build_object('secret', _secret);
END;
$$;
