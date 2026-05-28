const MAGIC = [0x52, 0x43, 0x52, 0x59];
const LEGACY_MAGIC = [0x42, 0x4c, 0x45, 0x4e];
const VERSION = 1;
const KDF_SCRYPT = 1;
const PAYLOAD_TEXT = 1;
const PAYLOAD_BYTES = 2;
const PAYLOAD_INT = 3;
const SCRYPT_LOG_N = 14;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SALT_LEN = 16;
const NONCE_LEN = 12;
const TAG_LEN = 16;
const HEADER_LEN = 12;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });
const asciiDecoder = new TextDecoder("ascii", { fatal: true });
const VALID_FORMATS = new Set(["bin", "hex", "ascii", "ternary"]);
const HEX = "0123456789abcdef";

export async function encryptText(value, password, outputFormat = "hex") {
  return encryptPayload(textEncoder.encode(value), password, PAYLOAD_TEXT, outputFormat);
}

export async function decryptText(value, password, inputFormat = "hex") {
  const payload = await decryptPayload(value, password, inputFormat, PAYLOAD_TEXT);
  return textDecoder.decode(payload);
}

export async function encryptInteger(value, password, outputFormat = "hex") {
  const normalized = BigInt(String(value).trim()).toString();
  return encryptPayload(asciiBytes(normalized), password, PAYLOAD_INT, outputFormat);
}

export async function decryptInteger(value, password, inputFormat = "hex") {
  const payload = await decryptPayload(value, password, inputFormat, PAYLOAD_INT);
  return BigInt(asciiDecoder.decode(payload)).toString();
}

export async function encryptBytes(value, password, outputFormat = "hex") {
  return encryptPayload(value, password, PAYLOAD_BYTES, outputFormat);
}

export async function decryptBytes(value, password, inputFormat = "hex") {
  return decryptPayload(value, password, inputFormat, PAYLOAD_BYTES);
}

export function textToBytes(value) {
  return textEncoder.encode(value);
}

export function bytesToHex(bytes) {
  return encodePackage(bytes, "hex");
}

export function hexToBytes(value) {
  return decodePackage(value, "hex");
}

export function assertSupported() {
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error("This browser does not support Web Crypto.");
  }
}

async function encryptPayload(payload, password, payloadType, outputFormat) {
  validateFormat(outputFormat);
  validatePassword(password);
  assertSupported();

  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LEN));
  const key = await deriveKey(password, salt, SCRYPT_LOG_N, SCRYPT_R, SCRYPT_P);
  const header = makeHeader(payloadType, salt.length, nonce.length);
  const aad = concatBytes(header, salt, nonce);
  const ciphertext = chacha20Xor(key, nonce, 1, payload);
  const tag = poly1305Tag(makePoly1305Key(key, nonce), buildMacData(aad, ciphertext));
  return encodePackage(concatBytes(aad, ciphertext, tag), outputFormat);
}

async function decryptPayload(value, password, inputFormat, expectedPayloadType) {
  validateFormat(inputFormat);
  validatePassword(password);
  assertSupported();

  const packageBytes = decodePackage(value, inputFormat);
  const parsed = parsePackage(packageBytes);
  if (parsed.payloadType !== expectedPayloadType) {
    throw new Error("Encrypted payload type does not match the selected input type.");
  }

  const key = await deriveKey(password, parsed.salt, parsed.logN, parsed.r, parsed.p);
  const expectedTag = poly1305Tag(makePoly1305Key(key, parsed.nonce), buildMacData(parsed.aad, parsed.ciphertext));
  if (!equalBytes(expectedTag, parsed.tag)) {
    throw new Error("Decryption failed. Check the password, format, and encrypted input.");
  }
  return chacha20Xor(key, parsed.nonce, 1, parsed.ciphertext);
}

function makeHeader(payloadType, saltLen, nonceLen) {
  return new Uint8Array([
    ...MAGIC,
    VERSION,
    payloadType,
    KDF_SCRYPT,
    SCRYPT_LOG_N,
    SCRYPT_R,
    SCRYPT_P,
    saltLen,
    nonceLen
  ]);
}

function parsePackage(packageBytes) {
  if (packageBytes.length < HEADER_LEN + TAG_LEN) {
    throw new Error("Encrypted input is too short.");
  }

  if (!matchesMagic(packageBytes, MAGIC) && !matchesMagic(packageBytes, LEGACY_MAGIC)) {
    throw new Error("Encrypted input is not an Rcrypt package.");
  }

  const version = packageBytes[4];
  const payloadType = packageBytes[5];
  const kdf = packageBytes[6];
  const logN = packageBytes[7];
  const r = packageBytes[8];
  const p = packageBytes[9];
  const saltLen = packageBytes[10];
  const nonceLen = packageBytes[11];

  if (version !== VERSION) throw new Error(`Unsupported Rcrypt version: ${version}.`);
  if (![PAYLOAD_TEXT, PAYLOAD_BYTES, PAYLOAD_INT].includes(payloadType)) throw new Error("Unsupported payload type.");
  if (kdf !== KDF_SCRYPT) throw new Error("Unsupported key derivation function.");
  if (logN < 1 || logN > 30 || r === 0 || p === 0) throw new Error("Invalid Scrypt parameters.");
  if (saltLen === 0 || nonceLen !== NONCE_LEN) throw new Error("Invalid salt or nonce length.");

  const saltStart = HEADER_LEN;
  const saltEnd = saltStart + saltLen;
  const nonceEnd = saltEnd + nonceLen;
  if (packageBytes.length < nonceEnd + TAG_LEN) {
    throw new Error("Encrypted input is incomplete.");
  }

  return {
    payloadType,
    logN,
    r,
    p,
    salt: packageBytes.slice(saltStart, saltEnd),
    nonce: packageBytes.slice(saltEnd, nonceEnd),
    aad: packageBytes.slice(0, nonceEnd),
    ciphertext: packageBytes.slice(nonceEnd, packageBytes.length - TAG_LEN),
    tag: packageBytes.slice(packageBytes.length - TAG_LEN)
  };
}

function matchesMagic(packageBytes, magic) {
  for (let i = 0; i < magic.length; i += 1) {
    if (packageBytes[i] !== magic[i]) return false;
  }
  return true;
}

async function deriveKey(password, salt, logN, r, p) {
  const passwordBytes = textEncoder.encode(password);
  return scrypt(passwordBytes, salt, logN, r, p, 32);
}

async function scrypt(passwordBytes, salt, logN, r, p, dkLen) {
  const N = 2 ** logN;
  if ((N & (N - 1)) !== 0 || N <= 1) {
    throw new Error("Scrypt N must be a power of two greater than 1.");
  }

  const blockLen = 128 * r;
  const B = await pbkdf2Sha256(passwordBytes, salt, p * blockLen);
  for (let i = 0; i < p; i += 1) {
    const start = i * blockLen;
    const block = B.slice(start, start + blockLen);
    sMix(block, N, r);
    B.set(block, start);
  }
  return pbkdf2Sha256(passwordBytes, B, dkLen);
}

async function pbkdf2Sha256(passwordBytes, salt, byteLength) {
  const key = await crypto.subtle.importKey("raw", passwordBytes, "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 1 },
    key,
    byteLength * 8
  );
  return new Uint8Array(bits);
}

function sMix(block, N, r) {
  const blockLen = 128 * r;
  let X = block.slice();
  const V = new Uint8Array(N * blockLen);

  for (let i = 0; i < N; i += 1) {
    V.set(X, i * blockLen);
    blockMixSalsa8(X, r);
  }

  for (let i = 0; i < N; i += 1) {
    const j = integerify(X, r) & (N - 1);
    xorInto(X, V.subarray(j * blockLen, (j + 1) * blockLen));
    blockMixSalsa8(X, r);
  }

  block.set(X);
}

function blockMixSalsa8(block, r) {
  const X = block.slice((2 * r - 1) * 64, 2 * r * 64);
  const Y = new Uint8Array(block.length);

  for (let i = 0; i < 2 * r; i += 1) {
    xorInto(X, block.subarray(i * 64, (i + 1) * 64));
    salsa208(X);
    Y.set(X, i * 64);
  }

  for (let i = 0; i < r; i += 1) {
    block.set(Y.subarray(2 * i * 64, (2 * i + 1) * 64), i * 64);
  }
  for (let i = 0; i < r; i += 1) {
    block.set(Y.subarray((2 * i + 1) * 64, (2 * i + 2) * 64), (i + r) * 64);
  }
}

function salsa208(block) {
  const x = new Uint32Array(16);
  const original = new Uint32Array(16);
  for (let i = 0; i < 16; i += 1) {
    x[i] = readU32LE(block, i * 4);
    original[i] = x[i];
  }

  for (let i = 0; i < 8; i += 2) {
    x[4] ^= rotl32(add32(x[0], x[12]), 7);
    x[8] ^= rotl32(add32(x[4], x[0]), 9);
    x[12] ^= rotl32(add32(x[8], x[4]), 13);
    x[0] ^= rotl32(add32(x[12], x[8]), 18);

    x[9] ^= rotl32(add32(x[5], x[1]), 7);
    x[13] ^= rotl32(add32(x[9], x[5]), 9);
    x[1] ^= rotl32(add32(x[13], x[9]), 13);
    x[5] ^= rotl32(add32(x[1], x[13]), 18);

    x[14] ^= rotl32(add32(x[10], x[6]), 7);
    x[2] ^= rotl32(add32(x[14], x[10]), 9);
    x[6] ^= rotl32(add32(x[2], x[14]), 13);
    x[10] ^= rotl32(add32(x[6], x[2]), 18);

    x[3] ^= rotl32(add32(x[15], x[11]), 7);
    x[7] ^= rotl32(add32(x[3], x[15]), 9);
    x[11] ^= rotl32(add32(x[7], x[3]), 13);
    x[15] ^= rotl32(add32(x[11], x[7]), 18);

    x[1] ^= rotl32(add32(x[0], x[3]), 7);
    x[2] ^= rotl32(add32(x[1], x[0]), 9);
    x[3] ^= rotl32(add32(x[2], x[1]), 13);
    x[0] ^= rotl32(add32(x[3], x[2]), 18);

    x[6] ^= rotl32(add32(x[5], x[4]), 7);
    x[7] ^= rotl32(add32(x[6], x[5]), 9);
    x[4] ^= rotl32(add32(x[7], x[6]), 13);
    x[5] ^= rotl32(add32(x[4], x[7]), 18);

    x[11] ^= rotl32(add32(x[10], x[9]), 7);
    x[8] ^= rotl32(add32(x[11], x[10]), 9);
    x[9] ^= rotl32(add32(x[8], x[11]), 13);
    x[10] ^= rotl32(add32(x[9], x[8]), 18);

    x[12] ^= rotl32(add32(x[15], x[14]), 7);
    x[13] ^= rotl32(add32(x[12], x[15]), 9);
    x[14] ^= rotl32(add32(x[13], x[12]), 13);
    x[15] ^= rotl32(add32(x[14], x[13]), 18);
  }

  for (let i = 0; i < 16; i += 1) {
    writeU32LE(block, i * 4, add32(x[i], original[i]));
  }
}

function integerify(block, r) {
  const offset = (2 * r - 1) * 64;
  return readU32LE(block, offset);
}

function chacha20Xor(key, nonce, counter, input) {
  const output = new Uint8Array(input.length);
  let blockCounter = counter >>> 0;

  for (let offset = 0; offset < input.length; offset += 64) {
    const stream = chacha20Block(key, nonce, blockCounter);
    blockCounter = add32(blockCounter, 1);
    const take = Math.min(64, input.length - offset);
    for (let i = 0; i < take; i += 1) {
      output[offset + i] = input[offset + i] ^ stream[i];
    }
  }

  return output;
}

function makePoly1305Key(key, nonce) {
  return chacha20Block(key, nonce, 0).slice(0, 32);
}

function chacha20Block(key, nonce, counter) {
  const state = new Uint32Array(16);
  state[0] = 0x61707865;
  state[1] = 0x3320646e;
  state[2] = 0x79622d32;
  state[3] = 0x6b206574;
  for (let i = 0; i < 8; i += 1) {
    state[4 + i] = readU32LE(key, i * 4);
  }
  state[12] = counter >>> 0;
  state[13] = readU32LE(nonce, 0);
  state[14] = readU32LE(nonce, 4);
  state[15] = readU32LE(nonce, 8);

  const working = new Uint32Array(state);
  for (let i = 0; i < 10; i += 1) {
    quarterRound(working, 0, 4, 8, 12);
    quarterRound(working, 1, 5, 9, 13);
    quarterRound(working, 2, 6, 10, 14);
    quarterRound(working, 3, 7, 11, 15);
    quarterRound(working, 0, 5, 10, 15);
    quarterRound(working, 1, 6, 11, 12);
    quarterRound(working, 2, 7, 8, 13);
    quarterRound(working, 3, 4, 9, 14);
  }

  const output = new Uint8Array(64);
  for (let i = 0; i < 16; i += 1) {
    writeU32LE(output, i * 4, add32(working[i], state[i]));
  }
  return output;
}

function quarterRound(state, a, b, c, d) {
  state[a] = add32(state[a], state[b]);
  state[d] ^= state[a];
  state[d] = rotl32(state[d], 16);

  state[c] = add32(state[c], state[d]);
  state[b] ^= state[c];
  state[b] = rotl32(state[b], 12);

  state[a] = add32(state[a], state[b]);
  state[d] ^= state[a];
  state[d] = rotl32(state[d], 8);

  state[c] = add32(state[c], state[d]);
  state[b] ^= state[c];
  state[b] = rotl32(state[b], 7);
}

function poly1305Tag(oneTimeKey, message) {
  const rBytes = oneTimeKey.slice(0, 16);
  rBytes[3] &= 15;
  rBytes[7] &= 15;
  rBytes[11] &= 15;
  rBytes[15] &= 15;
  rBytes[4] &= 252;
  rBytes[8] &= 252;
  rBytes[12] &= 252;

  const r = bytesToBigIntLE(rBytes);
  const s = bytesToBigIntLE(oneTimeKey.slice(16, 32));
  const p = (1n << 130n) - 5n;
  let acc = 0n;

  for (let offset = 0; offset < message.length; offset += 16) {
    const block = message.slice(offset, Math.min(offset + 16, message.length));
    const n = bytesToBigIntLE(block) + (1n << BigInt(8 * block.length));
    acc = ((acc + n) * r) % p;
  }

  return bigIntToBytesLE((acc + s) % (1n << 128n), 16);
}

function buildMacData(aad, ciphertext) {
  return concatBytes(
    aad,
    zeroPad16(aad.length),
    ciphertext,
    zeroPad16(ciphertext.length),
    u64LE(aad.length),
    u64LE(ciphertext.length)
  );
}

function zeroPad16(length) {
  const extra = length % 16;
  return new Uint8Array(extra === 0 ? 0 : 16 - extra);
}

function encodePackage(packageBytes, outputFormat) {
  validateFormat(outputFormat);
  if (outputFormat === "hex") {
    let out = "";
    for (const byte of packageBytes) out += HEX[byte >> 4] + HEX[byte & 15];
    return out;
  }
  if (outputFormat === "bin") {
    let out = "";
    for (const byte of packageBytes) out += byte.toString(2).padStart(8, "0");
    return out;
  }
  if (outputFormat === "ternary") {
    let out = "";
    for (const byte of packageBytes) out += byte.toString(3).padStart(6, "0");
    return out;
  }
  return encodeAscii7(packageBytes);
}

function decodePackage(value, inputFormat) {
  validateFormat(inputFormat);
  if (inputFormat === "hex") {
    const text = String(value).replace(/\s+/g, "");
    if (text.length % 2 !== 0 || /[^0-9a-fA-F]/.test(text)) {
      throw new Error("Hex input must contain pairs of hexadecimal characters.");
    }
    const out = new Uint8Array(text.length / 2);
    for (let i = 0; i < out.length; i += 1) {
      out[i] = parseInt(text.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  }
  if (inputFormat === "bin") {
    const text = String(value).replace(/\s+/g, "");
    if (text.length % 8 !== 0 || /[^01]/.test(text)) {
      throw new Error("Binary input must be groups of 8 bits.");
    }
    const out = new Uint8Array(text.length / 8);
    for (let i = 0; i < out.length; i += 1) {
      out[i] = parseInt(text.slice(i * 8, i * 8 + 8), 2);
    }
    return out;
  }
  if (inputFormat === "ternary") {
    const text = String(value).replace(/\s+/g, "");
    if (text.length % 6 !== 0 || /[^012]/.test(text)) {
      throw new Error("Ternary input must be groups of 6 trits.");
    }
    const out = new Uint8Array(text.length / 6);
    for (let i = 0; i < out.length; i += 1) {
      const byte = parseInt(text.slice(i * 6, i * 6 + 6), 3);
      if (byte > 255) throw new Error("Invalid ternary byte group.");
      out[i] = byte;
    }
    return out;
  }
  return decodeAscii7(value);
}

function encodeAscii7(packageBytes) {
  let bits = "";
  for (const byte of packageBytes) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 7) {
    out += String.fromCharCode(parseInt(bits.slice(i, i + 7).padEnd(7, "0"), 2));
  }
  return out;
}

function decodeAscii7(value) {
  const chars = typeof value === "string" ? [...value].map((char) => char.charCodeAt(0)) : [...value];
  if (chars.some((char) => char > 127)) {
    throw new Error("ASCII input must contain only 7-bit values.");
  }
  let bits = "";
  for (const char of chars) bits += char.toString(2).padStart(7, "0");
  const byteCount = Math.floor(bits.length / 8);
  const out = new Uint8Array(byteCount);
  for (let i = 0; i < byteCount; i += 1) {
    out[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  return out;
}

function validatePassword(password) {
  if (typeof password !== "string") throw new Error("Password must be text.");
  if (password.length === 0) throw new Error("Password must not be empty.");
}

function validateFormat(format) {
  if (!VALID_FORMATS.has(format)) {
    throw new Error(`Format must be one of: ${[...VALID_FORMATS].join(", ")}.`);
  }
}

function asciiBytes(value) {
  const out = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code > 127) throw new Error("Expected ASCII text.");
    out[i] = code;
  }
  return out;
}

function concatBytes(...arrays) {
  const total = arrays.reduce((sum, array) => sum + array.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const array of arrays) {
    out.set(array, offset);
    offset += array.length;
  }
  return out;
}

function equalBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

function xorInto(target, source) {
  for (let i = 0; i < target.length; i += 1) target[i] ^= source[i];
}

function readU32LE(bytes, offset) {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function writeU32LE(bytes, offset, value) {
  bytes[offset] = value & 255;
  bytes[offset + 1] = (value >>> 8) & 255;
  bytes[offset + 2] = (value >>> 16) & 255;
  bytes[offset + 3] = (value >>> 24) & 255;
}

function u64LE(value) {
  return bigIntToBytesLE(BigInt(value), 8);
}

function bytesToBigIntLE(bytes) {
  let out = 0n;
  for (let i = bytes.length - 1; i >= 0; i -= 1) {
    out = (out << 8n) + BigInt(bytes[i]);
  }
  return out;
}

function bigIntToBytesLE(value, length) {
  const out = new Uint8Array(length);
  let current = value;
  for (let i = 0; i < length; i += 1) {
    out[i] = Number(current & 255n);
    current >>= 8n;
  }
  return out;
}

function add32(a, b) {
  return (a + b) >>> 0;
}

function rotl32(value, shift) {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}
