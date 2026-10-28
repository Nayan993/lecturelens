/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** all | none | comma-separated domains — see src/services/index.ts. */
  readonly VITE_USE_MOCKS?: string;
  /** "true" shows the Demo accounts block on /login even when auth is not mocked. */
  readonly VITE_SHOW_DEMO_ACCOUNTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
