import { useEffect, useRef, useState } from 'react';
import { onSynced, syncAndAnnounce } from '../../lib/autoSync';
import {
  enableSync,
  joinSync,
  loadSyncLink,
  removeSyncSpace,
  turnOffSync,
  type SyncLink,
} from '../../lib/syncControl';
import { SyncSection, type SyncActions, type SyncPanel } from './SyncSection';

/**
 * 설정의 기기 간 동기화 칸을 실제 동작(lib/syncControl)에 잇는다.
 * onSynced: 받은 설정이 있을 수 있으므로 설정 화면이 값을 다시 읽게 한다
 */
export function SyncSettings({ onSynced: changed }: { onSynced?: () => void }) {
  const [link, setLink] = useState<SyncLink | null>(loadSyncLink);
  const [joining, setJoining] = useState<'no' | 'yes' | 'invalid'>('no');
  const [created, setCreated] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [gone, setGone] = useState(false);
  const [now, setNow] = useState(Date.now);
  const changedRef = useRef(changed);
  changedRef.current = changed;

  // 자동 동기화를 포함해 동기화가 끝날 때마다 칸을 다시 그린다
  useEffect(
    () =>
      onSynced((result) => {
        setLink(loadSyncLink());
        setNow(Date.now());
        if (result && 'gone' in result) setGone(true);
        changedRef.current?.();
      }),
    [],
  );

  // 「n분 전」이 흐르도록 1분마다 다시 그린다
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const sync = async () => {
    setSyncing(true);
    await syncAndAnnounce();
    setSyncing(false);
  };

  const actions: SyncActions = {
    enable() {
      setLink(enableSync());
      setCreated(true);
      setGone(false);
      void sync();
    },
    startJoin: () => setJoining('yes'),
    join(input) {
      const joined = joinSync(input);
      if (!joined) {
        setJoining('invalid');
        return;
      }
      setLink(joined);
      setJoining('no');
      setCreated(false);
      setGone(false);
      void sync();
    },
    cancelJoin: () => setJoining('no'),
    syncNow: () => void sync(),
    copy: (code) => navigator.clipboard?.writeText(code) ?? Promise.resolve(),
    turnOff() {
      turnOffSync();
      setLink(null);
      setCreated(false);
    },
    remove() {
      void removeSyncSpace().then(
        () => {
          setLink(null);
          setCreated(false);
        },
        () => setLink((current) => current && { ...current, problem: 'failed' }),
      );
    },
  };

  const panel: SyncPanel = link
    ? {
        kind: 'on',
        code: link.code,
        syncedAt: link.syncedAt,
        syncing,
        created,
        problem: link.problem,
      }
    : joining === 'no'
      ? gone
        ? { kind: 'off', problem: 'gone' }
        : { kind: 'off' }
      : { kind: 'join', invalid: joining === 'invalid' };

  return <SyncSection panel={panel} actions={actions} now={now} />;
}
