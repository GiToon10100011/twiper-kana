import type { FlickDirection, GuideLayer, GuideModifier } from '@twiper/core';

interface KeyboardGridProps {
  layer: GuideLayer;
  modifier: GuideModifier;
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
}: KeyboardGridProps) {
  return (
    <div className="kb-grid" role="img" aria-label={label} lang="ja">
      <span
        className="kb-key is-muted"
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
