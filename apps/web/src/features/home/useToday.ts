import { useEffect, useState } from 'react';
import type { TrainingRepo } from '@twiper/core';
import { trainingRepo } from '../../lib/db';
import { loadToday, type TodayData } from '../../lib/today';

/**
 * 「오늘」 기록을 읽는다 (홈 띠·연습한 날 달력).
 * 홈 화면 앱은 며칠씩 떠 있을 수 있으므로, 켜 둔 채 자정을 넘기거나 다른 앱에 갔다가 돌아오면 다시 읽는다.
 * now를 주면(테스트) 그 시각으로 한 번만 읽는다. 읽지 못하면 null로 남는다.
 */
export function useToday(repo?: TrainingRepo, now?: Date): TodayData | null {
  const [data, setData] = useState<TodayData | null>(null);
  const [reads, setReads] = useState(0);

  useEffect(() => {
    if (now) return;
    const reread = () => setReads((n) => n + 1);
    const onVisible = () => {
      if (document.visibilityState === 'visible') reread();
    };
    let timer = 0;
    const atMidnight = () => {
      const current = new Date();
      const next = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1);
      // 자정을 확실히 넘긴 뒤에 읽도록 1초 늦춘다
      timer = window.setTimeout(
        () => {
          reread();
          atMidnight();
        },
        next.getTime() - current.getTime() + 1000,
      );
    };
    atMidnight();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [now]);

  useEffect(() => {
    let alive = true;
    loadToday(repo ?? trainingRepo(), now).then(
      (loaded) => {
        if (alive) setData(loaded);
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [repo, now, reads]);

  return data;
}
