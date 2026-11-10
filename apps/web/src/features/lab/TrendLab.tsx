import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { addDays, dayKey, recentDays, type AttemptRecord } from '@twiper/core';
import { trainingRepo } from '../../lib/db';
import { BackIcon } from '../../ui/icons';
import { TrendSection } from '../stats/TrendSection';

type Sample = 'steady' | 'sparse' | 'real';

const SAMPLES: readonly (readonly [Sample, string])[] = [
  ['steady', '예시: 꾸준히'],
  ['sparse', '예시: 띄엄띄엄'],
  ['real', '이 기기 기록'],
];

/** 같은 씨앗이면 같은 수열 (예시 기록이 열 때마다 바뀌지 않게) */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32;
  };
}

/**
 * 오늘로 끝나는 60일의 가짜 시도 기록. 정확도와 속도가 조금씩 오른다.
 * steady는 거의 날마다, sparse는 사흘에 한 번꼴로 연습한다. 저장소에는 쓰지 않는다
 */
function sampleAttempts(today: string, sample: Exclude<Sample, 'real'>): AttemptRecord[] {
  const next = random(sample === 'steady' ? 7 : 11);
  const chance = sample === 'steady' ? 0.8 : 0.35;
  const target = 'かきくけこ';
  return recentDays(today, 60).flatMap((day, d) => {
    if (next() > chance) return [];
    const growth = d / 59;
    const [year = 0, month = 1, date = 1] = day.split('-').map(Number);
    return Array.from({ length: 8 + Math.floor(next() * 12) }, (_, n): AttemptRecord => {
      const missRate = 0.14 - 0.09 * growth + (next() - 0.5) * 0.06;
      const kpm = 28 + 24 * growth + (next() - 0.5) * 8;
      const missed = Array.from(target).flatMap((_char, i) => (next() < missRate ? [i] : []));
      return {
        id: `${day}-${String(n).padStart(2, '0')}`,
        sessionId: day,
        levelId: 'L10',
        at: new Date(year, month - 1, date, 20, n).toISOString(),
        target,
        input: target,
        result: missed.length === 0 ? 'correct' : 'corrected',
        judge: 'composing',
        reactionMs: null,
        elapsedMs: Math.round((5 / kpm) * 60_000),
        unitMs: Array.from(target, () => null),
        mistakes: missed.map((index) => ({
          index,
          expected: target[index] ?? '',
          actual: 'さ',
          cause: 'continued',
        })),
        corrections: missed.length,
        flags: [],
      };
    });
  });
}

/** 「내 실력」의 추세를 예시 기록(긴 기간)이나 이 기기의 기록으로 미리 본다 */
export function TrendLab() {
  const { t } = useTranslation();
  const [sample, setSample] = useState<Sample>('steady');
  const [real, setReal] = useState<AttemptRecord[] | null>(null);
  const today = dayKey(new Date());

  useEffect(() => {
    if (sample !== 'real' || real !== null) return;
    const since = new Date(`${addDays(today, -59)}T00:00:00`).toISOString();
    void trainingRepo().attemptsSince(since).then(setReal);
  }, [sample, real, today]);

  const attempts = sample === 'real' ? (real ?? []) : sampleAttempts(today, sample);

  const choice = <T extends string>(
    name: string,
    options: readonly (readonly [T, string])[],
    value: T,
    set: (next: T) => void,
  ) => (
    <div className="lab-choice">
      <span>{name}</span>
      <div className="stage-tabs is-small" role="group" aria-label={name}>
        {options.map(([option, text]) => (
          <button
            key={option}
            type="button"
            className="stage-tab"
            aria-pressed={option === value}
            onClick={() => set(option)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <main className="lab">
      <header className="screen-header">
        <Link className="icon-btn header-back" to="/steps" aria-label={t('settings.home')}>
          <BackIcon />
        </Link>
        <span>추세 시안</span>
      </header>
      {choice('기록', SAMPLES, sample, setSample)}
      {sample === 'real' && real !== null && real.length === 0 ? (
        <p className="lab-note">
          이 주소(미리보기)에는 기록이 없어요. 설정 › 기록 백업에서 정식 앱에서 내보낸 파일을
          가져오면 내 기록으로 볼 수 있어요.
        </p>
      ) : null}
      <TrendSection key={sample} attempts={attempts} today={today} />
    </main>
  );
}
