/**
 * Cryptographic helpers for SHA-256 hash-indexed secret authorization codes.
 * Plaintext secret codes are never persisted in Firestore; only their 64-char
 * SHA-256 hex digest (document ID) and a masked display hint are stored.
 */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeSecretCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export async function hashSecretCode(raw: string): Promise<string> {
  const normalized = normalizeSecretCode(raw);
  const bytes = new TextEncoder().encode(normalized);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateRandomSecretCode(): string {
  const randomBytes = new Uint8Array(8);
  window.crypto.getRandomValues(randomBytes);
  const chars = Array.from(randomBytes).map(
    (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]
  );
  return `DCR231-${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}`;
}

export function maskSecretCode(raw: string): string {
  const normalized = normalizeSecretCode(raw);
  if (normalized.length <= 4) {
    return '••••';
  }
  const tail = normalized.slice(-4);
  if (normalized.startsWith('DCR231-')) {
    return `DCR231-••••-${tail}`;
  }
  return `••••••-${tail}`.slice(0, 32);
}
