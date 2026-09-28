/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_EXCHANGE_RATE_API_KEY: string;
  readonly VITE_WHATSAPP_NUMBER: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __BUILD_ID__: string;
/** True when the dev server forwards /api, so the browser calls its own origin. */
declare const __API_SAME_ORIGIN__: boolean | undefined;
