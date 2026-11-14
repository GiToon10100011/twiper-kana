import type { SyncEnvelope, SyncServer } from './engine';

/**
 * 메모리 서버. 동기화 엔진 테스트와 서버를 붙이기 전의 화면 시안에 쓴다.
 * 실제 서버(동기화 설계 §4.6)처럼 번호를 1부터 커밋 순서대로 매긴다
 */
export function createMemorySyncServer<P>(): SyncServer<P> & {
  readonly envelopes: readonly SyncEnvelope<P>[];
} {
  const envelopes: SyncEnvelope<P>[] = [];
  return {
    envelopes,
    pull(after, limit) {
      return Promise.resolve(envelopes.filter((e) => e.seq > after).slice(0, limit));
    },
    push(payload) {
      const seq = envelopes.length + 1;
      envelopes.push({ seq, payload });
      return Promise.resolve(seq);
    },
  };
}
