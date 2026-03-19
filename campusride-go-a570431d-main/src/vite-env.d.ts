/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
	readonly VITE_API_URL?: string;
	readonly VITE_SOCKET_BASE_URL?: string;
	readonly VITE_USE_REMOTE_STOP_SUGGEST?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare module "virtual:pwa-register" {
	interface RegisterSWOptions {
		immediate?: boolean;
		onNeedRefresh?: () => void;
		onOfflineReady?: () => void;
		onRegisterError?: (error: unknown) => void;
		onRegisteredSW?: (swScriptUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
	}

	export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}
