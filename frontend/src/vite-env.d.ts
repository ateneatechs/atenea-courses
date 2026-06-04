/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEV_TENANT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.css';
