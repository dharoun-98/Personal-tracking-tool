/**
 * Generates a VAPID key pair for Web Push.
 *
 * Run it with node directly — no npx, no install:
 *
 *   node docs/tooling/generate-vapid-keys.mjs
 *
 * `npx web-push generate-vapid-keys` does the same thing, but npx is a
 * PowerShell shim on Windows and is blocked outright by the default execution
 * policy. This uses only node:crypto, so it works everywhere.
 *
 * A VAPID key pair is just an ECDSA P-256 key:
 *   public  = the uncompressed point 0x04 || X || Y  (65 bytes → 87 chars)
 *   private = the 32-byte scalar `d`                 (32 bytes → 43 chars)
 * both base64url-encoded without padding.
 *
 * The private key is a secret. It never needs to leave your machine except to
 * go into your hosting provider's environment variables.
 */

import { generateKeyPairSync } from "node:crypto";

const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });

// The JWK export gives us base64url values directly, which is exactly the
// encoding VAPID wants — no manual DER offset arithmetic.
const jwk = privateKey.export({ format: "jwk" });

const fromB64Url = (value) => Buffer.from(value, "base64url");

const publicKey = Buffer.concat([
  Buffer.from([0x04]), // uncompressed point marker
  fromB64Url(jwk.x),
  fromB64Url(jwk.y),
]).toString("base64url");

const secretKey = jwk.d;

console.log(`
Your VAPID keys
===============

Add these three to your hosting environment variables.

NEXT_PUBLIC_VAPID_PUBLIC_KEY
${publicKey}

VAPID_PRIVATE_KEY
${secretKey}

VAPID_SUBJECT
mailto:you@example.com     <-- replace with a real address you control

Notes
-----
* The subject is NOT generated. It is a contact address, required by the Web
  Push spec, so push services (Google, Apple, Mozilla) can reach you if your
  notifications start misbehaving. Any mailbox you actually read is fine.
* Keep VAPID_PRIVATE_KEY secret. NEXT_PUBLIC_VAPID_PUBLIC_KEY is public by
  design and ships in the browser bundle.
* Generate once and keep them. Changing the keys invalidates every existing
  push subscription and everyone has to re-enable notifications.

Sanity check — public should be 87 chars, private 43:
  public  ${publicKey.length}
  private ${secretKey.length}
`);
