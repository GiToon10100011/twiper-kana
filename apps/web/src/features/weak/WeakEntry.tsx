import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { Level } from '@twiper/content';
import type { WeakUnit } from '@twiper/core';
import { ForwardIcon, PlayIcon } from '../../ui/icons';
import { levelTitle } from '../training/levelTitle';

/** 가장 약한 규칙과 그 규칙을 익히는 레벨 (「그 단계로 돌아가기」) */
export interface WeakBack {
  readonly name: string;
  readonly accuracy: number;
  readonly level: Level;
}

/** 약점 글자 하나: 틀린 적이 있으면 틀린 비율, 틀린 적은 없고 느리기만 하면 걸린 시간 */
function UnitChip({ weak }: { weak: WeakUnit }) {
  const { t } = useTranslation();
  const caption =
    weak.missRate > 0
      ? t('weak.missRate', { percent: Math.round(weak.missRate * 100) })
      : t('weak.slow', { sec: ((weak.medianMs ?? 0) / 1000).toFixed(1) });
  return (
    <li className="weak-unit">
      <span lang="ja">{weak.unit}</span>
      <small>{caption}</small>
    </li>
  );
}

/**
 * 약점 연습 카드 (2026-10-26 시안 A 채택: 「내 실력」 맨 위). 약점 글자, 시작 버튼,
 * 가장 약한 규칙의 레벨로 돌아가는 링크. 약점이 없으면 기록이 충분한지(enough)에 따라 알린다
 */
export function WeakCard({
  units,
  back,
  enough = false,
}: {
  units: readonly WeakUnit[];
  back?: WeakBack;
  enough?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <section className="weak-card" aria-labelledby="weak-title">
      <h2 id="weak-title" className="weak-title">
        {t('weak.title')}
      </h2>
      {units.length === 0 ? (
        <p className="weak-lead">{enough ? t('weak.none') : t('weak.empty')}</p>
      ) : (
        <>
          <p className="weak-lead">{t('weak.lead')}</p>
          <ul className="weak-units">
            {units.map((weak) => (
              <UnitChip key={weak.unit} weak={weak} />
            ))}
          </ul>
          <Link className="btn btn-primary weak-start" to="/weak">
            <PlayIcon />
            {t('weak.start')}
          </Link>
        </>
      )}
      {back ? (
        <Link className="weak-back" to={`/train/${back.level.id}`}>
          <span>
            {t('weak.back', {
              name: back.name,
              accuracy: Math.round(back.accuracy * 100),
            })}
            <strong>{t('weak.backLevel', { level: levelTitle(back.level, t) })}</strong>
          </span>
          <ForwardIcon />
        </Link>
      ) : null}
    </section>
  );
}
