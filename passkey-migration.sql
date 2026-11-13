-- Passkey table for Better Auth Passkey plugin
CREATE TABLE IF NOT EXISTS passkey (
    id TEXT PRIMARY KEY,
    name TEXT,
    publicKey TEXT NOT NULL,
    userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    credentialID TEXT NOT NULL,
    counter INTEGER NOT NULL,
    deviceType TEXT NOT NULL,
    backedUp BOOLEAN NOT NULL,
    transports TEXT,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS passkey_userId_idx ON passkey(userId);

-- Enable RLS
ALTER TABLE passkey ENABLE ROW LEVEL SECURITY;

-- Users can only see their own passkeys
CREATE POLICY "Users can view their own passkeys" ON passkey
    FOR SELECT USING (auth.uid() = userId);

-- Users can insert their own passkeys
CREATE POLICY "Users can insert their own passkeys" ON passkey
    FOR INSERT WITH CHECK (auth.uid() = userId);

-- Users can update their own passkeys
CREATE POLICY "Users can update their own passkeys" ON passkey
    FOR UPDATE USING (auth.uid() = userId);

-- Users can delete their own passkeys
CREATE POLICY "Users can delete their own passkeys" ON passkey
    FOR DELETE USING (auth.uid() = userId);