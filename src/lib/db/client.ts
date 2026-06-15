export interface DbEnv {
	DB_API_URL: string
	CF_CLIENT_ID: string
	CF_CLIENT_SECRET: string
}

const SCHEMA = 'cosmic_hirogaru'

export async function dbFetch(
	path: string,
	env: DbEnv,
	options: RequestInit = {}
): Promise<Response> {
	const url = `${env.DB_API_URL}${path}`

	const headers: Record<string, string> = {
		'CF-Access-Client-Id':     env.CF_CLIENT_ID,
		'CF-Access-Client-Secret': env.CF_CLIENT_SECRET,
		'Accept-Profile':          SCHEMA,
		'Content-Profile':         SCHEMA,
		'Content-Type':            'application/json',
		...(options.headers as Record<string, string> ?? {}),
	}

	return fetch(url, { ...options, headers })
}
