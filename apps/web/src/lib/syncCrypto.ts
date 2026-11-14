import type { SyncCodec } from '@twiper/core';

/**
 * 동기화 코드와 키 (동기화 설계 §4.1). 코드는 무작위 16바이트를 Crockford base32 26자로 쓴 것이고,
 * 서버 주소(spaceId)·인증 키(authKey)·암호화 키(encKey)를 모두 코드에서 HKDF로 만든다.
 * 암호화 키는 기기 밖으로 나가지 않으므로 서버는 묶음을 읽을 수 없다
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_BYTES = 16;
/** 16바이트 = 128비트 → 5비트씩 26자 (끝 2비트는 0) */
const CODE_LENGTH = 26;

function encodeBase32(bytes: Uint8Array): string {
  let out = '';
  let value = 0;
  let bits = 0;
  for (const byte of bytes) {
    value = ((value << 8) | byte) & 0xfff;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET.charAt((value >>> (bits - 5)) & 31);
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET.charAt((value << (5 - bits)) & 31);
  return out;
}

/** 26자 코드 → 16바이트. 남는 비트가 0이 아니면 null */
function decodeBase32(code: string): Uint8Array<ArrayBuffer> | null {
  const bytes = new Uint8Array(CODE_BYTES);
  let value = 0;
  let bits = 0;
  let index = 0;
  for (const char of code) {
    const digit = ALPHABET.indexOf(char);
    if (digit < 0) return null;
    value = ((value << 5) | digit) & 0xfff;
    bits += 5;
    if (bits >= 8) {
      if (index >= CODE_BYTES) return null;
      bytes[index] = (value >>> (bits - 8)) & 0xff;
      index += 1;
      bits -= 8;
    }
  }
  const rest = value & ((1 << bits) - 1);
  return index === CODE_BYTES && rest === 0 ? bytes : null;
}

/** 새 동기화 코드 (26자) */
export function newSyncCode(): string {
  return encodeBase32(crypto.getRandomValues(new Uint8Array(CODE_BYTES)));
}

/**
 * 입력한 코드를 읽는다: 하이픈·공백·소문자를 받아들이고, 헷갈리기 쉬운 글자는 Crockford 규칙대로
 * 바꿔 읽는다 (O → 0, I·L → 1). 코드가 아니면 null
 */
export function normalizeSyncCode(input: string): string | null {
  const code = input
    .toUpperCase()
    .replace(/[\s-]/gu, '')
    .replace(/O/gu, '0')
    .replace(/[IL]/gu, '1');
  return code.length === CODE_LENGTH && decodeBase32(code) ? code : null;
}

/** 화면에 보일 때는 4자씩 끊는다 (7K2Q-…) */
export const formatSyncCode = (code: string): string => code.match(/.{1,4}/gu)?.join('-') ?? code;

export interface SyncKeys {
  /** 서버 주소에 쓰는 공간 ID (32자 hex) */
  readonly spaceId: string;
  /** 요청마다 보내는 인증 키 (base64url 43자). 서버는 SHA-256만 저장한다 */
  readonly authKey: string;
  /** 묶음을 암호화하는 AES-GCM 키. 내보낼 수 없다 */
  readonly encKey: CryptoKey;
}

const text = new TextEncoder();
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
};
const fromBase64 = (encoded: string) => Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
const base64url = (bytes: Uint8Array) =>
  toBase64(bytes).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '');

/** 코드에서 키를 만든다. 같은 코드면 어느 기기에서나 같은 키가 나온다. 코드가 아니면 던진다 */
export async function syncKeys(code: string): Promise<SyncKeys> {
  const seed = decodeBase32(code);
  if (!seed) throw new Error('동기화 코드가 아니다');
  const base = await crypto.subtle.importKey('raw', seed, 'HKDF', false, [
    'deriveBits',
    'deriveKey',
  ]);
  const hkdf = (info: string): HkdfParams => ({
    name: 'HKDF',
    hash: 'SHA-256',
    salt: text.encode('twiper-sync'),
    info: text.encode(`twiper-sync/v1/${info}`),
  });
  const space = new Uint8Array(await crypto.subtle.deriveBits(hkdf('space'), base, 128));
  const auth = new Uint8Array(await crypto.subtle.deriveBits(hkdf('auth'), base, 256));
  const encKey = await crypto.subtle.deriveKey(
    hkdf('enc'),
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  return { spaceId: hex(space), authKey: base64url(auth), encKey };
}

/** 서버에 보내는 묶음: 압축한 뒤 AES-GCM으로 암호화한 값 (base64) */
export interface SyncPayload {
  readonly iv: string;
  readonly data: string;
}

const through = async (
  bytes: Uint8Array<ArrayBuffer>,
  transform: CompressionStream | DecompressionStream,
) => {
  const body = new Response(bytes).body;
  if (!body) throw new Error('스트림을 열지 못했다');
  return new Uint8Array(await new Response(body.pipeThrough(transform)).arrayBuffer());
};

/** 묶음 ↔ 압축(gzip) + 암호화(AES-GCM, 묶음마다 새 iv) */
export function cryptoCodec(key: CryptoKey): SyncCodec<SyncPayload> {
  return {
    async encode(batch) {
      const packed = await through(
        text.encode(JSON.stringify(batch)),
        new CompressionStream('gzip'),
      );
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, packed);
      return { iv: toBase64(iv), data: toBase64(new Uint8Array(sealed)) };
    },
    async decode({ iv, data }) {
      const opened = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: fromBase64(iv) },
        key,
        fromBase64(data),
      );
      const unpacked = await through(new Uint8Array(opened), new DecompressionStream('gzip'));
      return JSON.parse(new TextDecoder().decode(unpacked)) as unknown;
    },
  };
}
