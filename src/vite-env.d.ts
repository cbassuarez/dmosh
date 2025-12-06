/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EXPORT_API_BASE?: string
  readonly VITE_EXPORT_AUTH_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
