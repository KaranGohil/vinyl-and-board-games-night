import { randomBytes, timingSafeEqual } from "node:crypto";

/** A random, URL-safe secret (used for host links and participant sessions). */
export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Compares two secrets without leaking timing information. */
export function tokensMatch(expected: string, provided: string | undefined): boolean {
  if (!provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}
