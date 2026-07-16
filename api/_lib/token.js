const TOKEN_VERSION = "v1";
const TOKEN_AUDIENCE = "surge-early-access";
const CONSENT_VERSION = "early-access-v1";
const TOKEN_TTL_MS = 24 * 60 * 60 * 1_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** @param {Uint8Array} bytes */
function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

/** @param {string} value */
function fromBase64Url(value) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

/** @param {Uint8Array} bytes @returns {ArrayBuffer} */
function asArrayBuffer(bytes) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

/** @param {string} encoded */
async function importKey(encoded) {
  const bytes = fromBase64Url(encoded);
  if (bytes.byteLength !== 32) throw new Error("Invalid token key");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** @param {string} encoded */
async function keyIdentifier(encoded) {
  const digest = await crypto.subtle.digest("SHA-256", fromBase64Url(encoded));
  return toBase64Url(new Uint8Array(digest).slice(0, 8));
}

/**
 * @param {{email: string, mode: string}} signup
 * @param {string} encodedKey
 * @param {{now?: number, randomBytes?: Uint8Array}} [options]
 */
export async function encryptSignupToken(signup, encodedKey, options = {}) {
  const now = options.now ?? Date.now();
  const iv = options.randomBytes ?? crypto.getRandomValues(new Uint8Array(12));
  if (iv.byteLength !== 12) throw new Error("Invalid token IV");

  const claims = {
    aud: TOKEN_AUDIENCE,
    email: signup.email,
    mode: signup.mode,
    consentVersion: CONSENT_VERSION,
    exp: now + TOKEN_TTL_MS,
  };
  const key = await importKey(encodedKey);
  const kid = await keyIdentifier(encodedKey);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: asArrayBuffer(iv), additionalData: encoder.encode(TOKEN_VERSION) },
    key,
    encoder.encode(JSON.stringify(claims)),
  );

  return `${TOKEN_VERSION}.${kid}.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`;
}

/**
 * @param {string} token
 * @param {string[]} encodedKeys
 * @param {{now?: number, expectedMode: string}} options
 */
export async function decryptSignupToken(token, encodedKeys, options) {
  const [version, kid, encodedIv, encodedCiphertext, unexpected] = token.split(".");
  if (version !== TOKEN_VERSION || !kid || !encodedIv || !encodedCiphertext || unexpected) {
    throw new Error("Invalid confirmation token");
  }

  const iv = fromBase64Url(encodedIv);
  const ciphertext = fromBase64Url(encodedCiphertext);
  if (iv.byteLength !== 12 || ciphertext.byteLength < 17) throw new Error("Invalid confirmation token");

  let plaintext = null;
  for (const encodedKey of encodedKeys.filter(Boolean)) {
    try {
      if ((await keyIdentifier(encodedKey)) !== kid) continue;
      const key = await importKey(encodedKey);
      plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv, additionalData: encoder.encode(TOKEN_VERSION) },
        key,
        ciphertext,
      );
      break;
    } catch {
      // Try the previous key during the documented rotation window.
    }
  }
  if (!plaintext) throw new Error("Invalid confirmation token");

  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(decoder.decode(plaintext));
  } catch {
    throw new Error("Invalid confirmation token");
  }

  if (!isClaims(parsed)) throw new Error("Invalid confirmation token");
  const now = options.now ?? Date.now();
  if (parsed.exp < now || parsed.mode !== options.expectedMode) {
    throw new Error("Invalid confirmation token");
  }

  return {
    email: parsed.email,
    mode: parsed.mode,
    consentVersion: parsed.consentVersion,
    exp: parsed.exp,
  };
}

/**
 * @typedef {{aud: string, email: string, mode: string, consentVersion: string, exp: number}} Claims
 */

/** @param {unknown} value @returns {value is Claims} */
function isClaims(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      "aud" in value &&
      value.aud === TOKEN_AUDIENCE &&
      "email" in value &&
      typeof value.email === "string" &&
      "mode" in value &&
      typeof value.mode === "string" &&
      "consentVersion" in value &&
      value.consentVersion === CONSENT_VERSION &&
      "exp" in value &&
      typeof value.exp === "number",
  );
}
