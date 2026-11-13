import { newId } from './db';

const DEVICE_KEY = 'twiper.device.v1';

/** 저장소를 쓸 수 없을 때 이번 실행 동안 쓰는 ID */
let fallback: string | null = null;

/**
 * 이 기기(브라우저 저장소)의 ID. 처음 부를 때 ULID로 만들어 저장한다. 옛 횟수와 설정을 바꾼 기기를
 * 가릴 때 쓴다 (동기화 설계 §4.3·§4.4). 저장소를 쓸 수 없으면 이번 실행 동안만 같은 값을 쓴다
 */
export function deviceId(): string {
  try {
    const saved = localStorage.getItem(DEVICE_KEY);
    if (saved) return saved;
    const id = newId();
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return (fallback ??= newId());
  }
}
