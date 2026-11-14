import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatSyncCode } from '../../lib/syncCrypto';

/** 지난 동기화가 남긴 문제 */
export type SyncProblem = 'failed' | 'update' | 'gone';

/** 동기화 칸이 그리는 상태 (동기화 설계 §4.7) */
export type SyncPanel =
  | { readonly kind: 'off'; readonly problem?: 'gone' }
  | { readonly kind: 'join'; readonly invalid: boolean }
  | {
      readonly kind: 'on';
      readonly code: string;
      /** 마지막으로 동기화한 때 (ms). 아직 없으면 null */
      readonly syncedAt: number | null;
      readonly syncing: boolean;
      /** 방금 이 기기에서 코드를 만들었다 (코드를 펼쳐 두고 다른 기기에 넣으라고 안내한다) */
      readonly created: boolean;
      readonly problem: SyncProblem | null;
    };

export interface SyncActions {
  enable(): void;
  startJoin(): void;
  join(input: string): void;
  cancelJoin(): void;
  syncNow(): void;
  copy(code: string): Promise<void>;
  turnOff(): void;
  remove(): void;
}

/** 「방금」「3분 전」「2시간 전」「4일 전」 */
function useSyncedText(syncedAt: number | null, now: number): string {
  const { t } = useTranslation();
  if (syncedAt === null) return t('sync.never');
  const minutes = Math.floor((now - syncedAt) / 60_000);
  if (minutes < 1) return t('sync.justNow');
  if (minutes < 60) return t('sync.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('sync.hoursAgo', { count: hours });
  return t('sync.daysAgo', { count: Math.floor(hours / 24) });
}

/** 설정의 기기 간 동기화 칸. 상태(panel)를 받아 그리기만 한다 */
export function SyncSection({
  panel,
  actions,
  now = Date.now(),
}: {
  panel: SyncPanel;
  actions: SyncActions;
  now?: number;
}) {
  const { t } = useTranslation();
  return (
    <>
      <h2 className="section-label">{t('sync.title')}</h2>
      {panel.kind === 'on' ? (
        <SyncOn panel={panel} actions={actions} now={now} />
      ) : (
        <SyncOff panel={panel} actions={actions} />
      )}
      <p className="screen-note sync-privacy">{t('sync.privacy')}</p>
    </>
  );
}

function SyncOff({
  panel,
  actions,
}: {
  panel: Extract<SyncPanel, { kind: 'off' | 'join' }>;
  actions: SyncActions;
}) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  return (
    <>
      <ul className="nav-list settings-list">
        <li>
          <div className="setting-row">
            <span>
              <span className="setting-name">{t('sync.enable')}</span>
              <small>{t('sync.enableHint')}</small>
            </span>
            <button type="button" className="btn" onClick={actions.enable}>
              {t('sync.enableButton')}
            </button>
          </div>
        </li>
        <li>
          {panel.kind === 'join' ? (
            <form
              className="setting-row is-stacked"
              onSubmit={(event) => {
                event.preventDefault();
                actions.join(input);
              }}
            >
              <span>
                <span className="setting-name">{t('sync.join')}</span>
                <small>{t('sync.joinHint')}</small>
              </span>
              <input
                className="text-input sync-code-input"
                type="text"
                aria-label={t('sync.codeLabel')}
                aria-invalid={panel.invalid}
                value={input}
                placeholder={t('sync.codePlaceholder')}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                onChange={(event) => setInput(event.target.value)}
              />
              {panel.invalid ? (
                <p className="sync-status is-warning">{t('sync.codeInvalid')}</p>
              ) : null}
              <span className="sync-buttons">
                <button type="submit" className="btn btn-primary" disabled={input.trim() === ''}>
                  {t('sync.connect')}
                </button>
                <button type="button" className="btn-quiet" onClick={actions.cancelJoin}>
                  {t('sync.cancel')}
                </button>
              </span>
            </form>
          ) : (
            <div className="setting-row">
              <span>
                <span className="setting-name">{t('sync.join')}</span>
                <small>{t('sync.joinHint')}</small>
              </span>
              <button type="button" className="btn" onClick={actions.startJoin}>
                {t('sync.joinButton')}
              </button>
            </div>
          )}
        </li>
      </ul>
      {panel.kind === 'off' && panel.problem === 'gone' ? (
        <p className="sync-status is-warning" role="status">
          {t('sync.gone')}
        </p>
      ) : null}
    </>
  );
}

function SyncOn({
  panel,
  actions,
  now,
}: {
  panel: Extract<SyncPanel, { kind: 'on' }>;
  actions: SyncActions;
  now: number;
}) {
  const { t } = useTranslation();
  const synced = useSyncedText(panel.syncedAt, now);
  const [shown, setShown] = useState(panel.created);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const code = formatSyncCode(panel.code);
  const problem =
    panel.problem === 'failed'
      ? t('sync.failed')
      : panel.problem === 'update'
        ? t('sync.updateRequired')
        : null;
  return (
    <>
      <ul className="nav-list settings-list">
        <li>
          <div className="setting-row">
            <span>
              <span className="setting-name">{t('sync.on')}</span>
              <small>{panel.syncing ? t('sync.syncing') : synced}</small>
            </span>
            <button
              type="button"
              className="btn"
              disabled={panel.syncing}
              onClick={actions.syncNow}
            >
              {t('sync.syncNow')}
            </button>
          </div>
        </li>
        <li>
          <div className="setting-row is-stacked">
            <span>
              <span className="setting-name">{t('sync.codeLabel')}</span>
              <small>{panel.created ? t('sync.created') : t('sync.keepCode')}</small>
            </span>
            <code className="sync-code" aria-label={t('sync.codeLabel')}>
              {shown ? code : code.replace(/[^-]/gu, '•')}
            </code>
            <span className="sync-buttons is-end">
              <button type="button" className="btn-quiet" onClick={() => setShown(!shown)}>
                {shown ? t('sync.hideCode') : t('sync.showCode')}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  void actions.copy(panel.code).then(() => setCopied(true));
                }}
              >
                {copied ? t('sync.copied') : t('sync.copy')}
              </button>
            </span>
            {panel.created ? <small className="sync-keep">{t('sync.keepCode')}</small> : null}
          </div>
        </li>
        <li>
          <div className="setting-row">
            <span>
              <span className="setting-name">{t('sync.turnOff')}</span>
              <small>{t('sync.turnOffHint')}</small>
            </span>
            <button type="button" className="btn" onClick={actions.turnOff}>
              {t('sync.turnOffButton')}
            </button>
          </div>
        </li>
        <li>
          <div className={`setting-row${confirming ? ' is-stacked' : ''}`}>
            <span>
              <span className="setting-name">{t('sync.remove')}</span>
              <small>{confirming ? t('sync.removeConfirm') : t('sync.removeHint')}</small>
            </span>
            {confirming ? (
              <span className="sync-buttons">
                <button type="button" className="btn btn-danger" onClick={actions.remove}>
                  {t('sync.removeButton')}
                </button>
                <button type="button" className="btn-quiet" onClick={() => setConfirming(false)}>
                  {t('sync.cancel')}
                </button>
              </span>
            ) : (
              <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>
                {t('sync.removeButton')}
              </button>
            )}
          </div>
        </li>
      </ul>
      {problem ? (
        <p className="sync-status is-warning" role="status">
          {problem}
        </p>
      ) : null}
    </>
  );
}
