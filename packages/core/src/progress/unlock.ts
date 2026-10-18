/**
 * 순서대로 여는 레벨 중 열린 레벨.
 * 첫 레벨은 항상 열려 있고, 끝낸 레벨과 그 다음 레벨이 열린다. unlockAll이면 전부 열린다.
 */
export function unlockedLevels(
  order: readonly string[],
  cleared: ReadonlySet<string>,
  unlockAll = false,
): Set<string> {
  return new Set(
    order.filter(
      (id, i) => unlockAll || i === 0 || cleared.has(id) || cleared.has(order[i - 1] ?? ''),
    ),
  );
}

/** 이어서 할 레벨: 열린 레벨 중 아직 끝내지 않은 첫 레벨. 없으면 null */
export function currentLevel(
  order: readonly string[],
  cleared: ReadonlySet<string>,
  unlocked: ReadonlySet<string>,
): string | null {
  return order.find((id) => unlocked.has(id) && !cleared.has(id)) ?? null;
}
