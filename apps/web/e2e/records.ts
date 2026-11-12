/**
 * 백업 파일 만들기 (설정 › 기록 백업 › 가져오기로 넣는다). 「며칠 전에 틀린 글자」처럼
 * 지난 기록이 필요한 화면을 테스트 전용 뒷문 없이 실제 기능으로 준비한다
 */

/** daysAgo일 전 낮 12시(기기 시간대)에 끝낸 한 줄. missed는 플릭 실수한 자리 */
export function attempt(id: string, daysAgo: number, target: string, missed: number[] = []) {
  const now = new Date();
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, 12);
  const chars = Array.from(target);
  return {
    id,
    sessionId: `S${daysAgo}`,
    levelId: 'L2',
    at: at.toISOString(),
    target,
    input: target,
    result: missed.length > 0 ? 'corrected' : 'correct',
    judge: 'composing',
    reactionMs: 500,
    elapsedMs: 3000,
    unitMs: chars.map(() => 600),
    mistakes: missed.map((index) => ({
      index,
      expected: chars[index] ?? '',
      actual: 'あ',
      cause: 'continued',
      kind: 'key',
    })),
    corrections: missed.length,
    flags: [],
  };
}

/** Lv.1을 끝낸 진도와 주어진 시도 기록을 담은 백업 파일 (setInputFiles에 넘긴다) */
export function backupFile(attempts: ReturnType<typeof attempt>[]) {
  const clearedAt = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const backup = {
    format: 'twiper-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    progress: { L1: { clearedAt, plays: 1, bestAccuracy: 1, bestKpm: 40 } },
    exams: {},
    attempts,
    sessions: [],
  };
  return {
    name: 'twiper-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  };
}
