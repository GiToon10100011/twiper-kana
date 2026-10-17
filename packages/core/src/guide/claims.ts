import type { FlickDirection, GuideClaim, GuideLayerId, InputStep, KeyboardGuide } from './types';

const DIRECTIONS: readonly FlickDirection[] = ['tap', 'left', 'up', 'right', 'down'];
const LAYERS: readonly GuideLayerId[] = ['kana', 'number', 'alpha'];

type KeyStep = Extract<InputStep, { kind: 'key' }>;

/** 가이드에서 이 문자를 내는 키 동작을 찾는다. 없으면 null */
export function findKeyStep(
  guide: KeyboardGuide,
  char: string,
  layer: GuideLayerId = 'kana',
): KeyStep | null {
  for (const key of guide.layers[layer].keys) {
    for (const dir of DIRECTIONS) {
      if (key.outputs[dir] === char) {
        return { kind: 'key', layer, keyId: key.id, label: key.label, dir, out: char };
      }
    }
  }
  return null;
}

function requireKeyStep(guide: KeyboardGuide, char: string): KeyStep {
  const step = findKeyStep(guide, char);
  if (step === null) {
    throw new Error(`가이드 ${guide.id}: かな 레이어에 '${char}'를 내는 키가 없습니다`);
  }
  return step;
}

/**
 * 가이드가 담고 있는 주장을 "동작 → 문자" 한 건씩으로 풀어 놓는다.
 * 실기 확인 화면(/lab/guide-check)과 데이터 검증 테스트가 쓴다.
 */
export function guideClaims(guide: KeyboardGuide): GuideClaim[] {
  const claims: GuideClaim[] = [];

  for (const layer of LAYERS) {
    for (const key of guide.layers[layer].keys) {
      for (const dir of DIRECTIONS) {
        const out = key.outputs[dir];
        if (out === undefined) continue;
        claims.push({
          id: `${layer}.${key.id}.${dir}`,
          layer,
          steps: [{ kind: 'key', layer, keyId: key.id, label: key.label, dir, out }],
          expected: out,
          unverified: key.unverified?.includes(dir) ?? false,
        });
      }
    }
  }

  for (const cycle of guide.modifier.cycles) {
    const [base, ...variants] = cycle.chars;
    if (base === undefined) continue;
    const baseStep = requireKeyStep(guide, base);
    variants.forEach((out, i) => {
      claims.push({
        id: `modifier.cycle.${base}.${i + 1}`,
        layer: 'kana',
        steps: [baseStep, { kind: 'modifier', dir: 'tap', times: i + 1, out }],
        expected: out,
        unverified: cycle.unverified ?? false,
      });
    });
  }

  for (const direct of guide.modifier.direct) {
    claims.push({
      id: `modifier.direct.${direct.dir}`,
      layer: 'kana',
      steps: [
        requireKeyStep(guide, direct.base),
        { kind: 'modifier', dir: direct.dir, times: 1, out: direct.out },
      ],
      expected: direct.out,
      unverified: true,
    });
  }

  return claims;
}
