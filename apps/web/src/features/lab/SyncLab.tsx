import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { newSyncCode, normalizeSyncCode } from '../../lib/syncCrypto';
import { BackIcon } from '../../ui/icons';
import { SyncSection, type SyncActions, type SyncPanel } from '../settings/SyncSection';

type Sample =
  'off' | 'join' | 'invalid' | 'created' | 'on' | 'syncing' | 'failed' | 'update' | 'gone';

const SAMPLES: readonly (readonly [Sample, string])[] = [
  ['off', '꺼짐'],
  ['join', '코드 넣기'],
  ['invalid', '코드 틀림'],
  ['created', '방금 켬'],
  ['on', '켜짐'],
  ['syncing', '동기화 중'],
  ['failed', '연결 실패'],
  ['update', '업데이트 필요'],
  ['gone', '다른 기기에서 지움'],
];

const MINUTE = 60_000;

function panelOf(sample: Sample, code: string, now: number): SyncPanel {
  const on = { kind: 'on', code, created: false, syncing: false, problem: null } as const;
  switch (sample) {
    case 'off':
      return { kind: 'off' };
    case 'join':
      return { kind: 'join', invalid: false };
    case 'invalid':
      return { kind: 'join', invalid: true };
    case 'created':
      return { ...on, created: true, syncedAt: now };
    case 'on':
      return { ...on, syncedAt: now - 3 * MINUTE };
    case 'syncing':
      return { ...on, syncedAt: now - 3 * MINUTE, syncing: true };
    case 'failed':
      return { ...on, syncedAt: now - 26 * 60 * MINUTE, problem: 'failed' };
    case 'update':
      return { ...on, syncedAt: now - 2 * 60 * MINUTE, problem: 'update' };
    case 'gone':
      return { kind: 'off', problem: 'gone' };
  }
}

/**
 * 설정에 넣을 기기 간 동기화 칸을 상태별로 미리 본다 (동기화 설계 §4.7). 버튼을 누르면 실제처럼
 * 상태가 바뀌지만, 서버나 기록에는 아무것도 하지 않는다
 */
export function SyncLab() {
  const { t } = useTranslation();
  const [sample, setSample] = useState<Sample>('off');
  const [panel, setPanel] = useState<SyncPanel>(() => panelOf('off', '', Date.now()));
  const code = useRef(newSyncCode());
  // 상태를 바꾸면 칸을 새로 그려, 펼친 코드·지우기 확인 같은 칸 안의 상태도 처음으로 돌린다
  const [revision, setRevision] = useState(0);

  const show = (next: Sample) => {
    setSample(next);
    setPanel(panelOf(next, code.current, Date.now()));
    setRevision((n) => n + 1);
  };

  const actions: SyncActions = {
    enable() {
      code.current = newSyncCode();
      show('created');
    },
    startJoin: () => show('join'),
    join(input) {
      const normalized = normalizeSyncCode(input);
      if (!normalized) {
        setPanel({ kind: 'join', invalid: true });
        return;
      }
      code.current = normalized;
      show('on');
    },
    cancelJoin: () => show('off'),
    syncNow() {
      setPanel((current) => (current.kind === 'on' ? { ...current, syncing: true } : current));
      window.setTimeout(() => {
        setPanel((current) =>
          current.kind === 'on'
            ? { ...current, syncing: false, syncedAt: Date.now(), problem: null }
            : current,
        );
      }, 1_200);
    },
    copy: (text) => navigator.clipboard?.writeText(text) ?? Promise.resolve(),
    turnOff: () => show('off'),
    remove: () => show('gone'),
  };

  return (
    // 설정 화면과 같은 틀(screen)로 그린다 (.lab의 버튼 규칙이 칸의 버튼 모양을 덮지 않게)
    <main className="screen">
      <header className="screen-header">
        <Link className="icon-btn header-back" to="/steps" aria-label={t('settings.home')}>
          <BackIcon />
        </Link>
        <span>동기화 시안</span>
      </header>
      <div className="lab-choice">
        <span>상태</span>
        <div className="stage-tabs is-small" role="group" aria-label="상태">
          {SAMPLES.map(([option, text]) => (
            <button
              key={option}
              type="button"
              className="stage-tab"
              aria-pressed={option === sample}
              onClick={() => show(option)}
            >
              {text}
            </button>
          ))}
        </div>
      </div>
      <p className="screen-note">
        설정 화면의 기록 백업 위에 들어갈 칸이에요. 버튼을 눌러 보면 상태가 바뀌지만, 서버나
        기록에는 아무것도 하지 않아요.
      </p>
      <SyncSection key={revision} panel={panel} actions={actions} />
    </main>
  );
}
