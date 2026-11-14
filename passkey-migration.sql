-- Passkey table for Better Auth Passkey plugin
-- Better Auth with Kysely + CamelCasePlugin expects snake_case columns with underscores
-- user.id is UUID, so user_id must be UUID
CREATE TABLE IF NOT EXISTS passkey (
    id TEXT PRIMARY KEY,
    name TEXT,
    public_key TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL,
    counter INTEGER NOT NULL,
    device_type TEXT NOT NULL,
    backed_up BOOLEAN NOT NULL,
    aaguid TEXT,
    transports TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS passkey_user_id_idx ON passkey(user_id);

-- Enable RLS
ALTER TABLE passkey ENABLE ROW LEVEL SECURITY;

-- Users can only see their own passkeys
CREATE POLICY "Users can view their own passkeys" ON passkey
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own passkeys
CREATE POLICY "Users can insert their own passkeys" ON passkey
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own passkeys
CREATE POLICY "Users can update their own passkeys" ON passkey
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own passkeys
CREATE POLICY "Users can delete their own passkeys" ON passkey
    FOR DELETE USING (auth.uid() = user_id);