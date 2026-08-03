-- AI agent credentials and preferences.
--
-- Secrets live in `ai_vault`, encrypted client-side with AES-GCM under a key
-- derived from the account password (PBKDF2-SHA256). The server never sees the
-- plaintext OpenAI key or Codex refresh token, so a leaked service_role key or
-- a database backup exposes ciphertext rather than a live credential.
--
-- Shape: {"v": 1, "salt": "<base64>", "iv": "<base64>", "ciphertext": "<base64>"}
--
-- Preferences are NOT secret, so they stay as plain columns — readable and
-- editable without unlocking the vault, which matters because the settings
-- panel has to render before the user has typed a password.

alter table dietea.profiles
  add column if not exists ai_vault jsonb,
  add column if not exists ai_model text not null default 'gpt-5.6-terra',
  add column if not exists ai_provider text not null default 'apikey'
    check (ai_provider in ('apikey', 'codex')),
  add column if not exists ai_reasoning_effort text not null default 'medium'
    check (ai_reasoning_effort in ('low', 'medium', 'high'));

comment on column dietea.profiles.ai_vault is
  'Client-side encrypted credential vault (AES-GCM). Never contains plaintext.';
