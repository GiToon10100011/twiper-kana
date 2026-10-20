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

/**
 * 최고 진도: 끝낸 레벨 중 가장 뒤 레벨의 다음 레벨. 아무것도 끝내지 않았으면 첫 레벨,
 * 마지막 레벨까지 끝냈으면 null. 최근에 무엇을 했는지, 전부 열기를 켰는지와 무관하다.
 * 끝낸 레벨의 다음 레벨은 항상 열려 있으므로 결과는 언제나 열린 레벨이다.
 */
export function frontierLevel(
  order: readonly string[],
  cleared: ReadonlySet<string>,
): string | null {
  let furthest = -1;
  order.forEach((id, i) => {
    if (cleared.has(id)) furthest = i;
  });
  return order[furthest + 1] ?? null;
}
