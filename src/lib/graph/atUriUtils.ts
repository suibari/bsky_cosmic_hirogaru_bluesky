export function extractDid(atUri: string): string | null {
	const match = atUri.match(/^at:\/\/(did:[^/]+)/)
	return match ? match[1] : null
}
