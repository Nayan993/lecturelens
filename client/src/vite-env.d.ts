/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** all | none | comma-separated domains — see src/services/index.ts. */
  readonly VITE_USE_MOCKS?: string;
  /** "true" shows the Demo accounts block on /login even when auth is not mocked. */
  readonly VITE_SHOW_DEMO_ACCOUNTS?: string;
  /** Mock mode only: a playable video URL used for fixture lectures, e.g. /dev-media/lecture7.mp4. */
  readonly VITE_MOCK_MEDIA_URL?: string;
  /** Client-side upload limit in MB; keep equal to the server's MAX_UPLOAD_MB (default 512). */
  readonly VITE_MAX_UPLOAD_MB?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
