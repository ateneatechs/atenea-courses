// Fail fast at startup rather than silently signing/verifying tokens with a
// guessable literal — a missing JWT_SECRET must never be a "fallback" string
// baked into the source code.
const secret = process.env.JWT_SECRET;

if (!secret || secret.length < 32) {
  throw new Error(
    'JWT_SECRET is missing or too short (must be set to a random string of at least 32 characters). ' +
    'Generate one with: openssl rand -hex 32'
  );
}

export const JWT_SECRET = secret;
