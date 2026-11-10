import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { ReviewPlan } from '../../lib/review';
import { ForwardIcon, PlayIcon } from '../../ui/icons';

/** 시안 A: 카드 (약점 연습 카드와 같은 모양) / B: 한 줄 링크 */
export type ReviewLayout = 'card' | 'row';

/**
 * 홈의 오늘 복습 (계획 §10.3 며칠 간격 복습). 틀린 적이 없어 복습할 단위가 없으면 아무것도 보이지 않는다
 */
export function ReviewEntry({ plan, layout }: { plan: ReviewPlan; layout: ReviewLayout }) {
  const { t } = useTranslation();
  if (plan.dueCount === 0 && !plan.next) return null;
  const units = plan.due.map((item) => item.unit);
  const [, month = '', day = ''] = plan.next?.day.split('-') ?? [];
  const nextText = plan.next
    ? t('review.next', {
        date: t('stats.trend.date', { month: Number(month), day: Number(day) }),
        count: plan.next.count,
      })
    : '';

  if (layout === 'row') {
    return plan.dueCount > 0 ? (
      <Link className="review-row" to="/review">
        <span className="review-row-text">
          <strong>{t('review.title')}</strong>
          <span>{t('review.count', { count: plan.dueCount })}</span>
        </span>
        <span className="review-row-units" lang="ja" aria-hidden="true">
          {units.join(' ')}
        </span>
        <ForwardIcon />
      </Link>
    ) : (
      <p className="review-row is-idle">{nextText}</p>
    );
  }

  // 약점 연습 카드와 같은 모양으로 둔다 (같은 줄 연습으로 들어가는 입구)
  return (
    <section className="weak-card" aria-labelledby="review-title">
      <h2 id="review-title" className="weak-title">
        {t('review.title')}
      </h2>
      {plan.dueCount === 0 ? (
        <p className="weak-lead">
          {t('review.none')} {nextText}
        </p>
      ) : (
        <>
          <p className="weak-lead">{t('review.lead', { count: plan.dueCount })}</p>
          <ul className="weak-units">
            {units.map((unit) => (
              <li key={unit} className="weak-unit">
                <span lang="ja">{unit}</span>
              </li>
            ))}
          </ul>
          <Link className="btn btn-primary weak-start" to="/review">
            <PlayIcon />
            {t('review.start')}
          </Link>
        </>
      )}
    </section>
  );
}
