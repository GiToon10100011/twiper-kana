/** 재현 가능한 난수 (mulberry32). 상태를 정수로 들고 다녀 reducer를 순수하게 유지한다. */
export interface Rng {
  /** [0, 1) */
  next(): number;
  /** [0, n) 정수 */
  int(n: number): number;
  /** 다음 호출에 이어 쓸 상태 */
  readonly state: number;
}

export function createRng(seed: number): Rng {
  let state = seed | 0;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n) => Math.floor(next() * n),
    get state() {
      return state;
    },
  };
}

/** Fisher–Yates. 원본은 바꾸지 않는다. */
export function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = rng.int(i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}
