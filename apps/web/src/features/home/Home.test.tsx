// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { examSource } from '@twiper/content';
import {
  attemptRecordOf,
  createExam,
  createInputSession,
  createMemoryRepo,
  type TrainingRepo,
} from '@twiper/core';
import '../../i18n';
import { recordLevel } from '../../lib/progress';
import { recordExam } from '../../lib/examRecords';
import { Home } from './Home';
import { Steps } from './Steps';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

/** 홈을 그리고 「오늘」 띠(기록을 비동기로 읽는다)가 나타날 때까지 기다린다 */
async function renderHome(repo: TrainingRepo = createMemoryRepo()) {
  render(
    <MemoryRouter>
      <Home repo={repo} />
    </MemoryRouter>,
  );
  return screen.findByRole('link', { name: /연습한 날 보기/ });
}

const startLink = () => screen.getByRole('link', { name: /테스트 시작/ });
const seedOf = (href: string | null) =>
  Number(new URL(href ?? '', 'http://x').searchParams.get('seed'));

describe('Home', () => {
  it('맨 위에 종합 테스트, 그 아래 단계별 익히기를 둔다', async () => {
    await renderHome();

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['종합 테스트', '처음이라면']);
    expect(screen.getByRole('link', { name: /단계별 익히기/ }).getAttribute('href')).toBe('/steps');
  });

  it('소개 아래 「오늘」 띠가 오늘 연습한 것을 보여 주고, 누르면 연습한 날 달력으로 간다', async () => {
    const repo = createMemoryRepo();
    const session = createInputSession('あいう');
    await repo.saveAttempt(
      attemptRecordOf(session, {
        id: 'A',
        sessionId: 'S',
        levelId: 'L1',
        shownAt: 0,
        at: new Date(),
      }),
    );
    const strip = await renderHome(repo);

    expect(strip.getAttribute('href')).toBe('/calendar');
    expect(strip.getAttribute('aria-label')).toMatch(/^1일 연속, 오늘 /);
  });

  it('미리보기 첫 줄은 시작 버튼이 넘기는 씨앗으로 만든 첫 줄과 같다', async () => {
    await renderHome();
    const seed = seedOf(startLink().getAttribute('href'));

    expect(screen.getByLabelText('첫 줄 미리보기').textContent).toBe(
      createExam(examSource('kana'), seed).line.text,
    );
  });

  it('종목과 시간을 고르면 시작 주소와 버튼이 바뀐다', async () => {
    await renderHome();
    fireEvent.click(screen.getByRole('button', { name: '긴 글' }));
    fireEvent.click(screen.getByRole('button', { name: '5분' }));

    expect(startLink().textContent).toBe('5분 테스트 시작');
    expect(startLink().getAttribute('href')).toMatch(/^\/test\/long\?min=5&seed=\d+$/);
    expect(screen.getByRole('region', { name: '긴 글' })).toBeTruthy();
  });

  it('종목별 최고 기록과 응시 횟수를 보여 준다', async () => {
    recordExam('kana', { kpm: 131.6, accuracy: 0.97 }, 1);
    recordExam('kana', { kpm: 90, accuracy: 0.99 }, 3);
    await renderHome();

    expect(screen.getByText('132')).toBeTruthy();
    expect(screen.getByText('97%')).toBeTruthy();
    expect(screen.getByText('2회')).toBeTruthy();
  });

  it('단계별 익히기: 처음이면 튜토리얼부터, 진행 중이면 이어서 할 레벨을 강조한다', async () => {
    await renderHome();
    expect(screen.getByText('튜토리얼부터 시작하기')).toBeTruthy();
    cleanup();

    recordLevel('L1', { accuracy: 0.95, kpm: 40 });
    await renderHome();
    expect(screen.getByText('Lv.2 か행 이어서 하기')).toBeTruthy();
    expect(document.querySelector('.tile-item.is-current')).toBeTruthy();
  });
});

describe('Steps (단계별 익히기)', () => {
  it('튜토리얼과 코스 목록, 개발 도구를 보여 주고 홈으로 돌아갈 수 있다', () => {
    render(
      <MemoryRouter>
        <Steps />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: '단계별 익히기' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /튜토리얼/ }).getAttribute('href')).toBe('/tutorial');
    expect(screen.getByRole('link', { name: /키보드 설명서/ }).getAttribute('href')).toBe('/keys');
    expect(screen.getByRole('link', { name: /글자 찾기/ }).getAttribute('href')).toBe('/find');
    expect(screen.getByRole('link', { name: /あ행/ }).getAttribute('href')).toBe('/train/L1');
    expect(screen.getByRole('link', { name: '홈으로' }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('heading', { name: '개발 도구' })).toBeTruthy();
  });
});
