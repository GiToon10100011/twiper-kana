// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ModifierHowTo } from './ModifierHowTo';

afterEach(cleanup);

const rows = (container: HTMLElement) =>
  [...container.querySelectorAll('.howto li')].map((li) => li.textContent?.replace(/\s+/g, ''));

describe('ModifierHowTo', () => {
  it('반탁음은 「小゛゜」를 두 번 누른다 (iOS 순환: は→ば→ぱ)', () => {
    const { container } = render(<ModifierHowTo topic="handakuten" label="사용법" />);

    expect(rows(container)).toEqual(['は+小゛゜×2=ぱ', 'ふ+小゛゜×2=ぷ']);
  });

  it('요음·촉음은 키 입력과 「小゛゜」를 순서대로 보여 준다', () => {
    const yoon = render(<ModifierHowTo topic="yoon" label="사용법" />);
    expect(rows(yoon.container)).toEqual(['き+や+小゛゜=きゃ', 'き+小゛゜+よ+小゛゜=ぎょ']);
    yoon.unmount();

    const sokuon = render(<ModifierHowTo topic="sokuon" label="사용법" />);
    expect(rows(sokuon.container)).toEqual(['き+つ+小゛゜+て=きって']);
  });
});
