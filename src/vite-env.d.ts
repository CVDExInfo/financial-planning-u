/// <reference types="vite/client" />

declare const GITHUB_RUNTIME_PERMANENT_NAME: string;
declare const BASE_KV_SERVICE_URL: string;

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_FINZ_ENABLED?: string;
  readonly VITE_USE_MOCKS?: string;
  readonly VITE_API_JWT_TOKEN?: string;
  readonly VITE_APP_BASENAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Lucide React icon declarations
declare module "lucide-react/dist/esm/icons/*" {
  import { LucideIcon } from "lucide-react";
  const icon: LucideIcon;
  export default icon;
}
