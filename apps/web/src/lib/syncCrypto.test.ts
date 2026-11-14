// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SyncBatch } from '@twiper/core';
import {
  cryptoCodec,
  formatSyncCode,
  newSyncCode,
  normalizeSyncCode,
  syncKeys,
} from './syncCrypto';

const batch: SyncBatch = {
  format: 'twiper-sync',
  version: 1,
  deviceId: '01JD0000000000000000000000',
  progress: {},
  exams: {},
  legacyPlays: {},
  settings: {},
  attempts: [],
  sessions: [],
};

describe('sync code', () => {
  it('새 코드는 26자이고, 4자씩 끊어 보이며, 입력은 하이픈·공백·소문자·헷갈리는 글자를 받아들인다', () => {
    const code = newSyncCode();
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/u);
    expect(newSyncCode()).not.toBe(code);

    const shown = formatSyncCode(code);
    expect(shown.split('-').map((part) => part.length)).toEqual([4, 4, 4, 4, 4, 4, 2]);
    expect(normalizeSyncCode(shown.toLowerCase().replace(/-/gu, ' - '))).toBe(code);

    const withZero = `0${code.slice(1)}`;
    if (normalizeSyncCode(withZero)) expect(normalizeSyncCode(`o${code.slice(1)}`)).toBe(withZero);
  });

  it('코드가 아니면 null이다', () => {
    expect(normalizeSyncCode('')).toBeNull();
    expect(normalizeSyncCode('ABCD')).toBeNull();
    expect(normalizeSyncCode('U'.repeat(26))).toBeNull();
    // 끝 2비트가 0이 아닌 26자
    expect(normalizeSyncCode('Z'.repeat(26))).toBeNull();
  });
});

describe('syncKeys', () => {
  it('같은 코드면 같은 공간·인증 키가 나오고, 다른 코드면 다르다', async () => {
    const code = newSyncCode();
    const a = await syncKeys(code);
    const b = await syncKeys(code);
    const other = await syncKeys(newSyncCode());

    expect(a.spaceId).toMatch(/^[0-9a-f]{32}$/u);
    expect(a.authKey).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(b).toMatchObject({ spaceId: a.spaceId, authKey: a.authKey });
    expect(other.spaceId).not.toBe(a.spaceId);
    expect(other.authKey).not.toBe(a.authKey);
  });
});

describe('cryptoCodec', () => {
  it('압축·암호화한 묶음을 같은 코드로 풀면 그대로이고, 묶음마다 iv가 다르다', async () => {
    const { encKey } = await syncKeys(newSyncCode());
    const codec = cryptoCodec(encKey);
    const first = await codec.encode(batch);
    const second = await codec.encode(batch);

    expect(await codec.decode(first)).toEqual(batch);
    expect(first.iv).not.toBe(second.iv);
    expect(first.data).not.toContain('twiper');
  });

  it('다른 코드의 키나 고친 암호문으로는 풀리지 않는다', async () => {
    const mine = cryptoCodec((await syncKeys(newSyncCode())).encKey);
    const theirs = cryptoCodec((await syncKeys(newSyncCode())).encKey);
    const sealed = await mine.encode(batch);

    await expect(theirs.decode(sealed)).rejects.toThrow();
    const tampered = {
      ...sealed,
      data: `${sealed.data.startsWith('A') ? 'B' : 'A'}${sealed.data.slice(1)}`,
    };
    await expect(mine.decode(tampered)).rejects.toThrow();
  });
});
