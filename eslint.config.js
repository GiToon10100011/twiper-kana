import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['**/dist/**', '**/coverage/**', '**/node_modules/**']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // core·content는 플랫폼 독립이어야 한다: 앱 코드·UI 라이브러리·브라우저 전역에 의존하지 않는다.
    files: ['packages/core/src/**/*.ts', 'packages/content/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@twiper/web', '@twiper/web/*', '**/apps/**'],
              message: 'core·content는 앱 코드를 import할 수 없습니다.',
            },
            {
              group: ['react', 'react/*', 'react-dom', 'react-dom/*', 'react-router'],
              message: 'core·content는 UI 라이브러리에 의존할 수 없습니다.',
            },
          ],
        },
      ],
      // no-restricted-imports는 import()를 보지 않으므로 동적 import도 같은 경계로 막는다.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression[source.value=/^@twiper\\/web(\\/|$)|\\/apps\\//]',
          message: 'core·content는 앱 코드를 import할 수 없습니다.',
        },
        {
          selector: 'ImportExpression[source.value=/^(react|react-dom|react-router)(\\/|$)/]',
          message: 'core·content는 UI 라이브러리에 의존할 수 없습니다.',
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          globals: ['window', 'document', 'navigator', 'performance', 'localStorage', 'indexedDB'],
          // globalThis.localStorage처럼 전역 객체를 거쳐 쓰는 것도 막는다.
          checkGlobalObject: true,
        },
      ],
    },
  },
]);
