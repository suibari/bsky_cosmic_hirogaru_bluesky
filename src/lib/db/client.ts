import { DB_API_URL, CF_CLIENT_ID, CF_CLIENT_SECRET } from '$env/static/private'

const BASE_URL = DB_API_URL
const SCHEMA   = 'cosmic_hirogaru'

export async function dbFetch(
	path: string,
	options: RequestInit = {}
): Promise<Response> {
	const url = `${BASE_URL}${path}`

	const headers: Record<string, string> = {
		'CF-Access-Client-Id':     CF_CLIENT_ID,
		'CF-Access-Client-Secret': CF_CLIENT_SECRET,
		'Accept-Profile':          SCHEMA,
		'Content-Profile':         SCHEMA,
		'Content-Type':            'application/json',
		...(options.headers as Record<string, string> ?? {}),
	}

	return fetch(url, { ...options, headers })
}
