/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional URL of a heavy-mode mosh server (see /server). Unset = in-browser. */
  readonly VITE_MOSH_SERVER?: string
  /** Optional bearer token sent to the mosh server. */
  readonly VITE_MOSH_SERVER_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
