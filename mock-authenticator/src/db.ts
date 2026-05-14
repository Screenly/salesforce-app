import { Database } from 'bun:sqlite'

const db = new Database('auth.db')

db.run(`
  CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    instance_url TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`)

export interface StoredTokens {
  access_token: string
  refresh_token: string
  instance_url: string
}

export function saveTokens(tokens: StoredTokens): void {
  db.run('DELETE FROM tokens')
  db.run(
    'INSERT INTO tokens (access_token, refresh_token, instance_url) VALUES (?, ?, ?)',
    [tokens.access_token, tokens.refresh_token, tokens.instance_url]
  )
}

export function loadTokens(): StoredTokens | null {
  return (
    db
      .query<StoredTokens, []>(
        'SELECT access_token, refresh_token, instance_url FROM tokens LIMIT 1'
      )
      .get() ?? null
  )
}

export function clearTokens(): void {
  db.run('DELETE FROM tokens')
}
