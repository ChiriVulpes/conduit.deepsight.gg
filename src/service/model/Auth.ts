import Store from 'utility/Store'

declare module 'utility/Store' {
	export interface LocalStorage {
		origins: Record<string, AuthedOrigin>
	}
}

interface AuthedOrigin {
	origin: string
	authTimestamp: number
}

namespace Auth {

	const AUTH_EXPIRY = 1000 * 60 * 60 * 24 * 30 // 30 days

	export async function isOriginAuthed (origin: string): Promise<boolean> {
		const origins = await Store.getOrigins() ?? {}
		const auth = origins?.[origin]
		if (auth && auth.authTimestamp + AUTH_EXPIRY > Date.now())
			return true

		delete origins[origin]
		await Store.setOrigins(origins)
		return false
	}
}

export default Auth
