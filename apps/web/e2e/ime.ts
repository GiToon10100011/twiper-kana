import type { Page } from '@playwright/test';

/**
 * 일본어 키보드로 한 줄을 치는 것을 흉내 낸다: 한 글자씩 조합(compositionupdate)한 뒤 確定(compositionend)한다.
 * Chromium 개발자 도구의 IME 명령을 쓴다 (M0 스파이크에서 desktop-edge-cdp trace를 만든 방법과 같다).
 * 포커스가 입력창에 있어야 한다
 */
export async function typeKana(page: Page, text: string): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const chars = Array.from(text);
  for (let i = 1; i <= chars.length; i += 1) {
    const composing = chars.slice(0, i).join('');
    await cdp.send('Input.imeSetComposition', {
      text: composing,
      selectionStart: composing.length,
      selectionEnd: composing.length,
    });
  }
  await cdp.send('Input.insertText', { text });
  await cdp.detach();
}
