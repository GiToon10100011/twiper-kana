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
    // core는 플랫폼 독립이어야 한다: 앱 코드·UI 라이브러리·브라우저 전역에 의존하지 않는다.
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@twiper/web', '@twiper/web/*', '**/apps/**'],
              message: 'core는 앱 코드를 import할 수 없습니다.',
            },
            {
              group: ['react', 'react/*', 'react-dom', 'react-dom/*', 'react-router'],
              message: 'core는 UI 라이브러리에 의존할 수 없습니다.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'navigator',
        'performance',
        'localStorage',
        'indexedDB',
      ],
    },
  },
]);
