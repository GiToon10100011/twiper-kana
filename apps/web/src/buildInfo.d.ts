// vite.config.ts의 define이 빌드할 때 채우는 값
/** package.json의 버전 (예: 1.0.0) */
declare const __APP_VERSION__: string;
/** 빌드한 커밋 앞 7자. Vercel 밖에서 빌드하면 빈 문자열 */
declare const __APP_BUILD__: string;
