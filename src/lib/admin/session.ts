import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

/* ==================================================================== *
 * Admin session.
 *
 * A single shared password, exactly as asked for — the WordPress model. It is
 * deliberately NOT Supabase auth: the admin needs to get in when the app's
 * auth is what's broken.
 *
 * The cookie is an HMAC over its own expiry, so it can't be forged or
 * extended without the secret, and it carries no data worth stealing.
 * ==================================================================== */

const COOKIE = "ptt_admin";
const TTL_MS = 8 * 60 * 60 * 1000; // Eight hours: one working day, not forever.

interface AdminConfig {
  password: string;
  secret: string;
}

function readConfig(): AdminConfig | null {
  const password = process.env.ADMIN_PASSWORD?.trim();
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  // Refuse to run on a short secret rather than pretend to be secure.
  if (!password || !secret || secret.length < 24) return null;
  return { password, secret };
}

export function isAdminConfigured(): boolean {
  return readConfig() !== null;
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Still burn a comparison so length isn't leaked by timing.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/** Checks a submitted password. Returns false when admin isn't configured. */
export function verifyPassword(submitted: string): boolean {
  const config = readConfig();
  if (!config) return false;
  return safeEqual(submitted, config.password);
}

export async function createAdminSession(): Promise<void> {
  const config = readConfig();
  if (!config) return;

  const expiry = String(Date.now() + TTL_MS);
  // The nonce means two sessions issued in the same millisecond differ, so a
  // leaked cookie can't be confused with a freshly minted one.
  const nonce = randomBytes(8).toString("hex");
  const body = `${expiry}.${nonce}`;
  const token = `${body}.${sign(body, config.secret)}`;

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function destroyAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const config = readConfig();
  if (!config) return false;

  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expiry, nonce, signature] = parts;

  if (!safeEqual(signature, sign(`${expiry}.${nonce}`, config.secret))) return false;

  const expiresAt = Number(expiry);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}
