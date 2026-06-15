// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				SHARE_KV: {
					get(key: string): Promise<string | null>
					put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
				}
			}
		}
	}
}

export {};
