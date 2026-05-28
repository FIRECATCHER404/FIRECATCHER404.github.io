const HEX = "0123456789abcdef";
const STANDARD_DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";
const STANDARD_EXTENDED_DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const STANDARD_BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STANDARD_BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const STANDARD_BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const RFC_BASE_BITS = new Map([
  [32, 5],
  [64, 6]
]);

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });
const asciiDecoder = new TextDecoder("ascii", { fatal: true });

export const DEFAULT_ALPHABET = makeDefaultAlphabet();

export function getPreferredAlphabet(base, sourceAlphabet = DEFAULT_ALPHABET) {
  const normalizedBase = Math.trunc(Number(base));
  const sourceChars = validateAlphabet(sourceAlphabet);
  if (!Number.isInteger(normalizedBase) || normalizedBase < 2) {
    throw new Error("Base amount must be a number of at least 2.");
  }
  if (normalizedBase > sourceChars.length) {
    throw new Error("Base amount cannot be larger than the alphabet.");
  }

  const standards = new Map([
    [32, STANDARD_BASE32],
    [58, STANDARD_BASE58],
    [64, STANDARD_BASE64]
  ]);
  const standard = standards.get(normalizedBase);
  if (standard && alphabetCanUse(sourceChars, standard)) return standard;

  if (normalizedBase <= STANDARD_DIGITS.length) {
    const digits = STANDARD_DIGITS.slice(0, normalizedBase);
    if (alphabetCanUse(sourceChars, digits)) return digits;
  }

  if (normalizedBase <= STANDARD_EXTENDED_DIGITS.length) {
    const digits = STANDARD_EXTENDED_DIGITS.slice(0, normalizedBase);
    if (alphabetCanUse(sourceChars, digits)) return digits;
  }

  return sourceChars.slice(0, normalizedBase).join("");
}

export async function encryptText(value, alphabet = DEFAULT_ALPHABET) {
  return encodeBytes(textEncoder.encode(value), alphabet);
}

export async function decryptText(value, alphabet = DEFAULT_ALPHABET) {
  return textDecoder.decode(decodeBytes(value, alphabet));
}

export async function encryptInteger(value, alphabet = DEFAULT_ALPHABET) {
  const normalized = BigInt(String(value).trim()).toString();
  return encodeBytes(asciiBytes(normalized), alphabet);
}

export async function decryptInteger(value, alphabet = DEFAULT_ALPHABET) {
  const decoded = asciiDecoder.decode(decodeBytes(value, alphabet));
  return BigInt(decoded).toString();
}

export async function encryptBytes(value, alphabet = DEFAULT_ALPHABET) {
  return encodeBytes(value, alphabet);
}

export async function decryptBytes(value, alphabet = DEFAULT_ALPHABET) {
  return decodeBytes(value, alphabet);
}

export function textToBytes(value) {
  return textEncoder.encode(value);
}

export function bytesToHex(bytes) {
  let out = "";
  for (const byte of bytes) out += HEX[byte >> 4] + HEX[byte & 15];
  return out;
}

export function hexToBytes(value) {
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

export function assertSupported() {
  if (typeof BigInt !== "function" || typeof TextEncoder !== "function" || typeof TextDecoder !== "function") {
    throw new Error("This browser does not support the APIs Baselen needs.");
  }
}

export function validateAlphabet(alphabet) {
  const chars = [...String(alphabet)];
  if (chars.length < 2) throw new Error("Alphabet must have at least 2 characters.");

  const seen = new Set();
  for (const char of chars) {
    if (seen.has(char)) throw new Error(`Alphabet contains duplicate character: ${char}`);
    seen.add(char);
  }

  return chars;
}

function encodeBytes(bytes, alphabet) {
  const chars = validateAlphabet(alphabet);
  if (bytes.length === 0) return "";

  const bitsPerChar = RFC_BASE_BITS.get(chars.length);
  if (bitsPerChar) return encodeBits(bytes, chars, bitsPerChar);
  if (chars.length === 58) return encodeIntegerBytes(bytes, chars);

  return encodeFixedWidthBytes(bytes, chars);
}

function decodeBytes(value, alphabet) {
  const chars = validateAlphabet(alphabet);
  let input = String(value);
  if (input.length === 0) return new Uint8Array();

  const bitsPerChar = RFC_BASE_BITS.get(chars.length);
  if (bitsPerChar) return decodeBits(input, chars, bitsPerChar);
  if (chars.length === 58) return decodeIntegerBytes(input, chars);

  return decodeFixedWidthBytes(input, chars);
}

function encodeFixedWidthBytes(bytes, chars) {
  const width = getByteWidth(chars.length);
  let out = "";
  for (const byte of bytes) {
    out += encodeIntegerMagnitude(BigInt(byte), chars).padStart(width, chars[0]);
  }
  return out;
}

function decodeFixedWidthBytes(value, chars) {
  const input = String(value).replace(/\s+/gu, "");
  const width = getByteWidth(chars.length);
  if (input.length % width !== 0) {
    throw new Error(`Encoded input length must be a multiple of ${width} for base${chars.length}.`);
  }

  const out = new Uint8Array(input.length / width);
  for (let offset = 0; offset < input.length; offset += width) {
    const value = decodeIntegerMagnitude(input.slice(offset, offset + width), chars);
    if (value > 255n) throw new Error("Encoded byte group is outside the byte range.");
    out[offset / width] = Number(value);
  }
  return out;
}

function encodeIntegerBytes(bytes, chars) {
  const zeroChar = chars[0];
  let leadingZeroes = 0;
  while (leadingZeroes < bytes.length && bytes[leadingZeroes] === 0) leadingZeroes += 1;

  const body = encodeIntegerMagnitude(bytesToBigInt(bytes), chars);
  return zeroChar.repeat(leadingZeroes) + body;
}

function decodeIntegerBytes(value, chars) {
  const input = String(value).replace(/\s+/gu, "");
  const zeroChar = chars[0];
  let leadingZeroes = 0;
  while (leadingZeroes < input.length && input[leadingZeroes] === zeroChar) leadingZeroes += 1;

  const body = input.slice(leadingZeroes);
  const bodyBytes = body.length === 0 ? new Uint8Array() : bigIntToBytes(decodeIntegerMagnitude(body, chars));
  const out = new Uint8Array(leadingZeroes + bodyBytes.length);
  out.set(bodyBytes, leadingZeroes);
  return out;
}

function getByteWidth(base) {
  let width = 1;
  let capacity = BigInt(base);
  while (capacity < 256n) {
    width += 1;
    capacity *= BigInt(base);
  }
  return width;
}

function encodeBits(bytes, chars, bitsPerChar) {
  const mask = (1 << bitsPerChar) - 1;
  let buffer = 0;
  let bitCount = 0;
  let out = "";

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bitCount += 8;

    while (bitCount >= bitsPerChar) {
      bitCount -= bitsPerChar;
      out += chars[(buffer >> bitCount) & mask];
      buffer &= (1 << bitCount) - 1;
    }
  }

  if (bitCount > 0) out += chars[(buffer << (bitsPerChar - bitCount)) & mask];
  if (chars.length === 32) return padOutput(out, 8);
  if (chars.length === 64) return padOutput(out, 4);
  return out;
}

function decodeBits(value, chars, bitsPerChar) {
  let input = String(value).replace(/\s+/gu, "");
  if (!chars.includes("=")) input = input.replace(/=+$/u, "");
  if (input.length === 0) return new Uint8Array();
  if (input.length * bitsPerChar < 8) throw new Error("Encoded input is too short.");

  const indexes = makeIndexMap(chars);
  const bytes = [];
  let buffer = 0;
  let bitCount = 0;

  for (const char of input) {
    const index = indexes.get(char);
    if (index === undefined) throw new Error(`Encoded input contains a character outside the selected alphabet: ${char}`);
    buffer = (buffer << bitsPerChar) | index;
    bitCount += bitsPerChar;

    while (bitCount >= 8) {
      bitCount -= 8;
      bytes.push((buffer >> bitCount) & 255);
      buffer &= (1 << bitCount) - 1;
    }
  }

  if (bitCount > 0 && buffer !== 0) throw new Error("Encoded input has invalid trailing bits.");
  return new Uint8Array(bytes);
}

function encodeIntegerMagnitude(value, chars) {
  if (value === 0n) return "";

  const base = BigInt(chars.length);
  let current = value;
  let out = "";
  while (current > 0n) {
    const index = Number(current % base);
    out = chars[index] + out;
    current /= base;
  }
  return out;
}

function decodeIntegerMagnitude(value, chars) {
  const indexes = makeIndexMap(chars);
  const base = BigInt(chars.length);
  let out = 0n;

  for (const char of String(value)) {
    const index = indexes.get(char);
    if (index === undefined) throw new Error(`Encoded input contains a character outside the selected alphabet: ${char}`);
    out = out * base + BigInt(index);
  }
  return out;
}

function makeIndexMap(chars) {
  const indexes = new Map();
  chars.forEach((char, index) => indexes.set(char, index));
  return indexes;
}

function padOutput(value, groupSize) {
  const remainder = value.length % groupSize;
  return remainder === 0 ? value : value + "=".repeat(groupSize - remainder);
}

function alphabetCanUse(sourceChars, alphabet) {
  return [...alphabet].every((char) => sourceChars.includes(char));
}

function bytesToBigInt(bytes) {
  let out = 0n;
  for (const byte of bytes) out = (out << 8n) + BigInt(byte);
  return out;
}

function bigIntToBytes(value) {
  if (value === 0n) return new Uint8Array();
  const bytes = [];
  let current = value;
  while (current > 0n) {
    bytes.push(Number(current & 255n));
    current >>= 8n;
  }
  bytes.reverse();
  return new Uint8Array(bytes);
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

function makeDefaultAlphabet() {
  const chars = [];
  appendUnique(chars, "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ");
  appendUnique(chars, "!#$%&()*+,-./:;<=>?@[]^_{|}~");
  appendRange(chars, 0x00a1, 0x00ff);
  appendRange(chars, 0x0391, 0x03ce);
  appendRange(chars, 0x0410, 0x044f);
  appendRange(chars, 0x2500, 0x257f);
  appendRange(chars, 0x2190, 0x21ff);
  appendRange(chars, 0x2200, 0x22ff);
  return chars.slice(0, 300).join("");
}

function appendRange(chars, start, end) {
  for (let codePoint = start; codePoint <= end && chars.length < 300; codePoint += 1) {
    appendUnique(chars, String.fromCodePoint(codePoint));
  }
}

function appendUnique(chars, values) {
  for (const char of values) {
    const codePoint = char.codePointAt(0);
    const isHidden =
      codePoint === 0x00ad ||
      codePoint === 0x03a2 ||
      /\s/u.test(char) ||
      /\p{Mark}/u.test(char) ||
      /\p{Control}/u.test(char);
    if (!chars.includes(char) && !isHidden) chars.push(char);
    if (chars.length >= 300) break;
  }
}
