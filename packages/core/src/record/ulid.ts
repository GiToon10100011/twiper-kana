// Crockford base32 (I, L, O, U 제외)
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TIME_LENGTH = 10;
const RANDOM_BYTES = 10;

/**
 * ULID: 앞 10자는 밀리초 시각, 뒤 16자는 무작위 80비트. 문자열 정렬이 곧 시각 정렬이다.
 * core는 플랫폼 API를 쓰지 않으므로 무작위 바이트는 호출하는 쪽이 넘긴다 (웹은 crypto.getRandomValues).
 */
export function ulid(timeMs: number, random: Uint8Array): string {
  if (random.length < RANDOM_BYTES) {
    throw new RangeError(`ulid에는 무작위 바이트 ${RANDOM_BYTES}개가 필요하다`);
  }
  let time = '';
  let t = Math.floor(timeMs);
  for (let i = 0; i < TIME_LENGTH; i += 1) {
    time = (ALPHABET[t % 32] ?? '0') + time;
    t = Math.floor(t / 32);
  }
  let rest = '';
  let value = 0;
  let bits = 0;
  for (const byte of random.subarray(0, RANDOM_BYTES)) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      rest += ALPHABET[(value >>> (bits - 5)) & 31] ?? '0';
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  return time + rest;
}
