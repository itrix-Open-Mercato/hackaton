/**
 * Returns the JWT token saved by global-setup.ts.
 * Use this in API integration tests instead of calling getAuthToken(request)
 * to avoid hammering /api/auth/login and triggering rate limiting.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TOKEN_FILE = path.join(__dirname, '..', '.auth', 'token.txt')

export function getCachedToken(): string {
  return readFileSync(TOKEN_FILE, 'utf-8').trim()
}
