import type { FlickDirection, GuideLayer, GuideModifier } from '@twiper/core';

interface KeyboardGridProps {
  layer: GuideLayer;
  /** 왼쪽 아래 변형 키 (かな 자판의 小゛゜, ABC 자판의 a/A) */
  modifier: Pick<GuideModifier, 'label' | 'row' | 'col'>;
  /** 변형 키를 흐리게 보인다 (기본). false면 다른 키처럼 보인다 */
  muteModifier?: boolean;
  /** 각 키에 이 방향으로 플릭했을 때 나오는 글자를 보여 준다. 'label'이면 키에 적힌 이름 */
  direction: FlickDirection | 'label';
  /** 강조할 키 id */
  highlight?: ReadonlySet<string>;
  /** 흐리게 보일 키 id (지금 설명과 관계없는 키) */
  muted?: ReadonlySet<string>;
  label: string;
}

/**
 * iPhone かな 키보드의 4행 × 3열 배치를 그린 설명용 도해. 입력을 받지 않는다.
 * 키 위치와 글자는 KeyboardGuide 데이터에서 가져온다.
 */
export function KeyboardGrid({
  layer,
  modifier,
  direction,
  highlight,
  muted,
  label,
  muteModifier = true,
}: KeyboardGridProps) {
  return (
    <div className="kb-grid" role="img" aria-label={label} lang="ja">
      <span
        className={muteModifier ? 'kb-key is-muted' : 'kb-key'}
        style={{ gridRow: modifier.row + 1, gridColumn: modifier.col + 1 }}
      >
        {modifier.label}
      </span>
      {layer.keys.map((key) => {
        const out = direction === 'label' ? key.label : key.outputs[direction];
        const classes = [
          'kb-key',
          highlight?.has(key.id) ? 'is-active' : '',
          !out || muted?.has(key.id) ? 'is-muted' : '',
        ].join(' ');
        return (
          <span
            key={key.id}
            className={classes.trim()}
            style={{ gridRow: key.row + 1, gridColumn: key.col + 1 }}
          >
            {out ?? '\u{2013}'}
          </span>
        );
      })}
    </div>
  );
}
