import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { ReviewPlan } from '../../lib/review';
import { ForwardIcon } from '../../ui/icons';

/**
 * 홈의 오늘 복습 (계획 §10.3 며칠 간격 복습). 2026-11-10 시안 C 채택: 흰 두 줄 카드,
 * 윗줄은 제목·글자 수, 아랫줄은 글자 칩과 그 끝의 복습 시작 버튼. 카드 전체가 /review 링크다.
 * 글자 칩은 한 줄에 들어가는 만큼만 통째로 보인다 (모두 몇 글자인지는 제목 옆에 있다).
 * 오늘 복습할 것이 없으면 다음 복습 날만 조용히 보이고, 틀린 적이 없어 복습할 단위가 없으면 아무것도 보이지 않는다
 */
export function ReviewEntry({ plan }: { plan: ReviewPlan }) {
  const { t } = useTranslation();
  if (plan.dueCount === 0) {
    if (!plan.next) return null;
    const [, month = '', day = ''] = plan.next.day.split('-');
    return (
      <p className="review-card is-idle">
        {t('review.none')}{' '}
        {t('review.next', {
          date: t('stats.trend.date', { month: Number(month), day: Number(day) }),
          count: plan.next.count,
        })}
      </p>
    );
  }

  const units = plan.due.map((item) => item.unit);
  return (
    <Link
      className="review-card"
      to="/review"
      aria-label={[
        t('review.title'),
        t('review.count', { count: plan.dueCount }),
        units.join(', '),
        t('review.start'),
      ].join(', ')}
    >
      <span className="review-card-head" aria-hidden="true">
        <strong>{t('review.title')}</strong>
        <span>{t('review.count', { count: plan.dueCount })}</span>
      </span>
      <span className="review-card-row" aria-hidden="true">
        <span className="review-chips" lang="ja">
          {units.map((unit) => (
            <span key={unit}>{unit}</span>
          ))}
        </span>
        <span className="review-card-go">
          {t('review.start')}
          <ForwardIcon />
        </span>
      </span>
    </Link>
  );
}
