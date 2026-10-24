import { classifyMistake, type MistakeKind } from '../kana/classify';
import { KANA_KEY_ROWS, danOf, keyRowOf } from '../kana/rows';
import { toHiragana } from '../kana/script';
import { tokenizeKana } from '../kana/tokenize';
import { variantBase } from '../kana/variants';
import type { AttemptRecord } from '../record/types';

/** 조합·가타카나 규칙. 이름은 콘텐츠의 레벨 주제와 같다 */
export type TopicSkill =
  | 'dakuten'
  | 'handakuten'
  | 'small'
  | 'yoon'
  | 'sokuon'
  | 'katakana'
  | 'longVowel'
  | 'foreign'
  | 'vu';

/** 통계를 내는 규칙. 기본 가나는 키(행)마다 'row:あ'처럼 나눈다 */
export type SkillId = `row:${string}` | TopicSkill;

const ROW_SKILLS = KANA_KEY_ROWS.map((row): SkillId => `row:${row[0] ?? ''}`);

/** 화면에 보일 순서: 기초(행) → 조합 → 가타카나 */
export const SKILL_ORDER: readonly SkillId[] = [
  ...ROW_SKILLS,
  'dakuten',
  'handakuten',
  'small',
  'yoon',
  'sokuon',
  'katakana',
  'longVowel',
  'foreign',
  'vu',
];

/** 이보다 표본이 적으면 화면에 「측정 중」으로 보인다 */
export const STATS_MIN_SAMPLES = 8;

const HANDAKUTEN = new Set(Array.from('ぱぴぷぺぽ'));
const SMALL = new Set(Array.from('ぁぃぅぇぉゃゅょゎ'));
const SMALL_YA = new Set(Array.from('ゃゅょ'));
/** 플릭이 아니라 변환·초과 입력 문제인 실수 */
const NOT_FLICK: ReadonlySet<MistakeKind> = new Set(['script', 'conversion', 'extra']);

/**
 * 입력 단위(tokenizeKana) 하나가 속한 규칙.
 * 기본 가나는 그 키의 행, 변형은 탁음·반탁음·작은 글자, 요음은 요음(+탁음 등)이다.
 * い단 + ゃゅょ가 아닌 묶음(ティ ファ シェ)은 외래음이다.
 * ゔ(ヴ)는 탁음과 달리 「小゛゜」를 두 번 눌러야 해서(う→ぅ→ゔ) 따로 센다.
 * 가타카나는 가타카나에 더해 같은 읽기의 규칙에도 센다. 플릭은 히라가나와 똑같기 때문이다.
 */
export function skillsOf(unit: string): SkillId[] {
  const chars = Array.from(unit);
  const head = chars[0];
  if (head === undefined) return [];
  if (unit === 'ー') return ['longVowel'];

  const skills: SkillId[] = [];
  if (chars.some((char) => toHiragana(char) !== char)) skills.push('katakana');

  const kana = toHiragana(head);
  const small = chars[1];
  if (small !== undefined) {
    const yoon = SMALL_YA.has(toHiragana(small)) && danOf(variantBase(kana)) === 'i';
    skills.push(yoon ? 'yoon' : 'foreign');
  }
  if (kana === 'っ') return [...skills, 'sokuon'];
  if (kana === 'ゔ') return [...skills, 'vu'];
  if (variantBase(kana) !== kana) {
    skills.push(HANDAKUTEN.has(kana) ? 'handakuten' : SMALL.has(kana) ? 'small' : 'dakuten');
  } else if (chars.length === 1) {
    const skill = ROW_SKILLS[keyRowOf(kana)];
    if (skill) skills.push(skill);
  }
  return skills;
}

export interface SkillStat {
  readonly skill: SkillId;
  /** 본 횟수 (최근 window번까지) */
  readonly samples: number;
  /** 한 번에 맞힌 횟수 */
  readonly firstTry: number;
  /** firstTry / samples */
  readonly accuracy: number;
  /** 글자당 시간의 중앙값 (ms). 줄의 첫 글자는 문제를 읽는 시간이 섞여 뺀다. 잴 수 없으면 null */
  readonly medianMs: number | null;
}

interface Occurrence {
  readonly unit: string;
  readonly skills: readonly SkillId[];
  /** 플릭 실수가 있었다 */
  readonly flickMiss: boolean;
  /** 플릭은 맞았지만 변환하지 않았거나 다르게 변환했다 */
  readonly convertMiss: boolean;
  readonly ms: number | null;
}

const kindOf = (m: AttemptRecord['mistakes'][number]): MistakeKind =>
  m.kind ?? classifyMistake(m.expected, m.actual);

/** 통계에 쓰는 기록: 로마자 키보드로 친 줄은 빼고, 최근 순으로 */
function usable(attempts: readonly AttemptRecord[]): AttemptRecord[] {
  return attempts
    .filter((a) => !a.flags.includes('romaji-suspected'))
    .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
}

function occurrencesOf(attempt: AttemptRecord): Occurrence[] {
  let start = 0;
  return tokenizeKana(attempt.target).map((unit, i) => {
    const end = start + Array.from(unit).length;
    const kinds = attempt.mistakes
      .filter((m) => m.index >= start && m.index < end && m.expected !== '')
      .map(kindOf);
    const times = attempt.unitMs.slice(start, end);
    const measurable = i > 0 && times.length === end - start && times.every((t) => t !== null);
    start = end;
    const flickMiss = kinds.some((kind) => !NOT_FLICK.has(kind));
    return {
      unit,
      skills: skillsOf(unit),
      flickMiss,
      convertMiss: !flickMiss && kinds.length > 0,
      ms: measurable ? times.reduce<number>((sum, t) => sum + (t ?? 0), 0) : null,
    };
  });
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] ?? null)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/**
 * 규칙마다 최근 window번의 첫 시도 정확도와 속도 (계획 §12 SkillStat).
 * 변환하지 않은 실수는 가타카나에만 틀린 것으로 센다. 본 적 없는 규칙은 넣지 않는다.
 */
export function skillStats(
  attempts: readonly AttemptRecord[],
  { window = 60 }: { window?: number } = {},
): SkillStat[] {
  const seen = new Map<SkillId, { hits: boolean[]; times: number[] }>();
  for (const attempt of usable(attempts)) {
    for (const occurrence of occurrencesOf(attempt)) {
      for (const skill of occurrence.skills) {
        const entry = seen.get(skill) ?? { hits: [], times: [] };
        if (entry.hits.length >= window) continue;
        const missed = occurrence.flickMiss || (skill === 'katakana' && occurrence.convertMiss);
        entry.hits.push(!missed);
        if (occurrence.ms !== null) entry.times.push(occurrence.ms);
        seen.set(skill, entry);
      }
    }
  }
  return SKILL_ORDER.flatMap((skill) => {
    const entry = seen.get(skill);
    if (!entry) return [];
    const firstTry = entry.hits.filter(Boolean).length;
    return [
      {
        skill,
        samples: entry.hits.length,
        firstTry,
        accuracy: firstTry / entry.hits.length,
        medianMs: median(entry.times),
      },
    ];
  });
}

/** 자주 틀린 글자 쌍 (목표 → 친 글자). 많은 순, 같으면 최근에 틀린 순. 변환·초과 입력은 뺀다 */
export function confusions(
  attempts: readonly AttemptRecord[],
  limit = 5,
): { expected: string; actual: string; count: number }[] {
  const counts = new Map<string, { expected: string; actual: string; count: number }>();
  for (const attempt of usable(attempts)) {
    for (const mistake of attempt.mistakes) {
      if (mistake.expected === '' || NOT_FLICK.has(kindOf(mistake))) continue;
      const key = `${mistake.expected}\u{0}${mistake.actual}`;
      const entry = counts.get(key) ?? {
        expected: mistake.expected,
        actual: mistake.actual,
        count: 0,
      };
      entry.count += 1;
      counts.set(key, entry);
    }
  }
  // Map은 넣은 순(최근 순)을 지키고 sort는 안정 정렬이라, 같은 횟수면 최근에 틀린 쌍이 앞에 남는다.
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

/** 표본이 minSamples 이상인 입력 단위 중 느린 순. 가타카나는 읽기(히라가나)로 묶는다 */
export function slowUnits(
  attempts: readonly AttemptRecord[],
  { minSamples = 5, limit = 5 }: { minSamples?: number; limit?: number } = {},
): { unit: string; medianMs: number; samples: number }[] {
  const times = new Map<string, number[]>();
  for (const attempt of usable(attempts)) {
    for (const { unit, ms } of occurrencesOf(attempt)) {
      if (ms === null || skillsOf(unit).length === 0) continue;
      const key = toHiragana(unit);
      const list = times.get(key);
      if (list) list.push(ms);
      else times.set(key, [ms]);
    }
  }
  return [...times.entries()]
    .flatMap(([unit, list]) => {
      const ms = median(list);
      return list.length >= minSamples && ms !== null
        ? [{ unit, medianMs: ms, samples: list.length }]
        : [];
    })
    .sort((a, b) => b.medianMs - a.medianMs)
    .slice(0, limit);
}
