import { classifyMistake, type MistakeKind } from '../kana/classify';
import { KANA_KEY_ROWS, danOf, keyRowOf } from '../kana/rows';
import { toHiragana } from '../kana/script';
import { tokenizeKana } from '../kana/tokenize';
import { variantBase } from '../kana/variants';
import { addDays, dayKey } from '../progress/streak';
import type { AttemptRecord } from '../record/types';

/** 조합·가타카나·기호 규칙. 이름은 콘텐츠의 레벨 주제와 같다 */
export type TopicSkill =
  | 'dakuten'
  | 'handakuten'
  | 'small'
  | 'yoon'
  | 'sokuon'
  | 'katakana'
  | 'longVowel'
  | 'foreign'
  | 'vu'
  | 'punct'
  | 'symbol'
  | 'alnum';

/** 통계를 내는 규칙. 기본 가나는 키(행)마다 'row:あ'처럼 나눈다 */
export type SkillId = `row:${string}` | TopicSkill;

const ROW_SKILLS = KANA_KEY_ROWS.map((row): SkillId => `row:${row[0] ?? ''}`);

/** 화면에 보일 순서: 기초(행) → 조합 → 가타카나 → 기호 */
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
  'punct',
  'symbol',
  'alnum',
];

/** 이보다 표본이 적으면 화면에 「측정 중」으로 보인다 */
export const STATS_MIN_SAMPLES = 8;

const HANDAKUTEN = new Set(Array.from('ぱぴぷぺぽ'));
const SMALL = new Set(Array.from('ぁぃぅぇぉゃゅょゎ'));
const SMALL_YA = new Set(Array.from('ゃゅょ'));
/** かな 자판에서 바로 치는 문장부호 (、。?! 키와 や 키 ←→) */
const PUNCT = new Set(Array.from('、。？！「」'));
/** ☆123 자판으로 바꿔서 치는 기호 */
const SYMBOL = new Set(Array.from('〜…・♪☆'));
/** ABC 자판의 영문자와 ☆123 자판의 숫자 (반각) */
const ALNUM = /^[A-Za-z0-9]$/u;
/** 플릭이 아니라 변환·초과 입력 문제인 실수 */
const NOT_FLICK: ReadonlySet<MistakeKind> = new Set(['script', 'conversion', 'extra']);

/**
 * 입력 단위(tokenizeKana) 하나가 속한 규칙.
 * 기본 가나는 그 키의 행, 변형은 탁음·반탁음·작은 글자, 요음은 요음(+탁음 등)이다.
 * い단 + ゃゅょ가 아닌 묶음(ティ ファ シェ)은 외래음이다.
 * ゔ(ヴ)는 탁음과 달리 「小゛゜」를 두 번 눌러야 해서(う→ぅ→ゔ) 따로 센다.
 * 가타카나는 가타카나에 더해 같은 읽기의 규칙에도 센다. 플릭은 히라가나와 똑같기 때문이다.
 * 기호는 かな 자판의 문장부호와 ☆123 자판의 기호로 나눈다. 영문자·숫자는 함께 센다.
 */
export function skillsOf(unit: string): SkillId[] {
  const chars = Array.from(unit);
  const head = chars[0];
  if (head === undefined) return [];
  if (unit === 'ー') return ['longVowel'];
  if (PUNCT.has(unit)) return ['punct'];
  if (SYMBOL.has(unit)) return ['symbol'];
  if (ALNUM.test(unit)) return ['alnum'];

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

export interface WeakUnit {
  /** 입력 단위. 가타카나는 플릭이 같으므로 히라가나로 묶는다 */
  readonly unit: string;
  /** 본 횟수 (최근 window번까지) */
  readonly samples: number;
  /** 첫 시도에 플릭으로 틀린 비율 (0–1) */
  readonly missRate: number;
  /** 단위 시간 중앙값 (ms). 잴 수 없으면 null */
  readonly medianMs: number | null;
}

/** かな 자판에서 바로 치지 않는 기호(☆123)·영문자·숫자와 문장부호는 약점 연습(가나 줄)에 내지 않는다 */
const NOT_PRACTICE: ReadonlySet<SkillId> = new Set<SkillId>(['punct', 'symbol', 'alnum']);

/**
 * 약점 단위: 최근 기록에서 자주 틀리거나 느린 입력 단위. 약점 연습의 출제 단위다 (계획 §12 Weakness Analyzer).
 * 단위마다 최근 window번까지 보고, 표본이 minSamples보다 적으면 뺀다.
 * 틀린 적이 있거나 전체 중앙값의 1.5배 넘게 느린 단위만 넣고, 틀린 비율이 높은 순·같으면 느린 순으로 limit개.
 * 로마자 키보드로 친 줄은 플릭 실력이 아니라서 보지 않는다
 */
export function weakUnits(
  attempts: readonly AttemptRecord[],
  {
    minSamples = 3,
    limit = 8,
    window = 20,
  }: { minSamples?: number; limit?: number; window?: number } = {},
): WeakUnit[] {
  const seen = new Map<string, { misses: boolean[]; times: number[] }>();
  for (const attempt of usable(attempts)) {
    for (const { unit, skills, flickMiss, ms } of occurrencesOf(attempt)) {
      if (skills.length === 0 || skills.some((skill) => NOT_PRACTICE.has(skill))) continue;
      const key = toHiragana(unit);
      const entry = seen.get(key) ?? { misses: [], times: [] };
      if (entry.misses.length >= window) continue;
      entry.misses.push(flickMiss);
      if (ms !== null) entry.times.push(ms);
      seen.set(key, entry);
    }
  }
  const overall = median([...seen.values()].flatMap((entry) => entry.times));
  return [...seen.entries()]
    .flatMap(([unit, { misses, times }]) => {
      if (misses.length < minSamples) return [];
      const missRate = misses.filter(Boolean).length / misses.length;
      const medianMs = median(times);
      const slow = overall !== null && medianMs !== null && medianMs >= overall * 1.5;
      return missRate > 0 || slow ? [{ unit, samples: misses.length, missRate, medianMs }] : [];
    })
    .sort((a, b) => b.missRate - a.missRate || (b.medianMs ?? 0) - (a.medianMs ?? 0))
    .slice(0, limit);
}

/** 며칠 간격 복습의 간격(일). 틀리면 첫 간격부터, 예정일 뒤에 맞히면 다음 간격으로, 마지막 간격 뒤에 맞히면 끝난다 */
export const REVIEW_INTERVALS: readonly number[] = [1, 3, 7, 21];

/** 복습할 입력 단위 하나 */
export interface ReviewItem {
  /** 입력 단위 (가타카나는 읽기 히라가나로 묶는다) */
  readonly unit: string;
  /** 지금 몇 번째 간격인지 (0부터, REVIEW_INTERVALS의 자리) */
  readonly step: number;
  /** 다음 복습 날 (기기 시간대 YYYY-MM-DD) */
  readonly due: string;
}

/**
 * 며칠 간격 복습 (계획 §10.3 Leitner): 시도 기록을 오래된 순으로 훑어 단위마다 다음 복습 날을 정한다.
 * 플릭 실수를 하면 다음 날로, 예정일이 된 뒤에 맞히면 3일·7일·21일 뒤로 늘리고, 21일 뒤에도 맞히면 목록에서 뺀다.
 * 예정일 전에 맞힌 것은 세지 않는다 (같은 날 몰아서 맞혀도 간격이 늘지 않는다).
 * 따로 저장하지 않고 기록에서 다시 계산하므로 가져온 기록·다른 레벨에서 친 것도 그대로 들어간다.
 * 약점 연습과 같이 가나 줄로 칠 수 있는 단위만 보고, 로마자 키보드로 친 줄은 보지 않는다
 */
export function reviewSchedule(attempts: readonly AttemptRecord[]): ReviewItem[] {
  const items = new Map<string, ReviewItem>();
  // usable은 최근 순이라 뒤집어 오래된 기록부터 본다
  for (const attempt of usable(attempts).reverse()) {
    const day = dayKey(new Date(attempt.at));
    for (const { unit, skills, flickMiss } of occurrencesOf(attempt)) {
      if (skills.length === 0 || skills.some((skill) => NOT_PRACTICE.has(skill))) continue;
      const key = toHiragana(unit);
      const item = items.get(key);
      if (flickMiss) {
        items.set(key, { unit: key, step: 0, due: addDays(day, REVIEW_INTERVALS[0] ?? 1) });
      } else if (item && day >= item.due) {
        const step = item.step + 1;
        const interval = REVIEW_INTERVALS[step];
        if (interval === undefined) items.delete(key);
        else items.set(key, { unit: key, step, due: addDays(day, interval) });
      }
    }
  }
  return [...items.values()].sort((a, b) => a.due.localeCompare(b.due) || a.step - b.step);
}

/** 오늘 복습할 단위: 예정일이 오늘이거나 지난 것, 오래 밀린 것부터 limit개 */
export function dueReviews(
  schedule: readonly ReviewItem[],
  today: string,
  limit = 8,
): ReviewItem[] {
  return schedule.filter((item) => item.due <= today).slice(0, limit);
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
