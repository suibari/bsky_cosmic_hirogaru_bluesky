// Type shim for Cloudflare KV binding.
// adapter-cloudflare's ambient.d.ts declares `env: unknown`, which prevents TypeScript from
// resolving our App.Platform.env declaration. This helper casts at the boundary.
interface ShareKV {
	get(key: string): Promise<string | null>
	put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
}

export function getShareKV(platform: App.Platform | undefined): ShareKV | undefined {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (platform?.env as any)?.SHARE_KV as ShareKV | undefined
}
