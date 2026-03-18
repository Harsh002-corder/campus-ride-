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
