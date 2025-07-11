import type { AuthedOrigin } from '@shared/Auth'
import Env from 'utility/Env'
import Log from 'utility/Log'
import Store from 'utility/Store'

declare module 'utility/Store' {
	export interface LocalStorage {
		origins: Record<string, AuthedOrigin>
		auth: {
			accessToken: string
			accessExpiry: number
			refreshToken: string
			refreshExpiry: number
		}
	}
}

namespace Auth {

	const AUTH_EXPIRY = 1000 * 60 * 60 * 24 * 30 // 30 days

	export async function getOriginAccess (origin: string): Promise<AuthedOrigin | undefined> {
		const origins = await Store.getOrigins() ?? {}
		const auth = origins?.[origin]
		if (auth && auth.authTimestamp + AUTH_EXPIRY > Date.now())
			return auth

		delete origins[origin]
		await Store.setOrigins(origins)
		return undefined
	}

	export async function getOriginGrants (): Promise<AuthedOrigin[]> {
		const origins = await Store.getOrigins() ?? {}
		return Object.values(origins).filter(auth => auth.authTimestamp + AUTH_EXPIRY > Date.now())
	}

	export async function grantAccess (origin: string, appName?: string): Promise<void> {
		const origins = await Store.getOrigins() ?? {}
		origins[origin] = {
			appName,
			origin,
			authTimestamp: Date.now(),
		}
		await Store.setOrigins(origins)
		Log.info(`Granted access to origin: ${origin}`)
	}

	export async function denyAccess (origin: string): Promise<void> {
		const origins = await Store.getOrigins() ?? {}
		if (origins[origin]) {
			delete origins[origin]
			await Store.setOrigins(origins)
		}
		Log.info(`Denied access to origin: ${origin}`)
	}

	export async function checkBungie () {
		const auth = await Store.getAuth()
		if (!auth)
			return false

		const now = Date.now() + 1000 * 60 // add a minute to account for latency of refresh requests
		if (now > auth.refreshExpiry) {
			// refresh token is expired, must re-authenticate
			Log.info('Bungie.net refresh token expired, must re-authenticate')
			return false
		}

		if (auth.accessExpiry > now) {
			// access token is still valid
			Log.info('Bungie.net access token validated')
			return true
		}

		// refresh access token
		Log.info('Refreshing Bungie.net access token...')
		const tokenRequestTime = Date.now()
		const tokenResponse = await fetch('https://www.bungie.net/Platform/App/OAuth/Token/', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Authorization': `Basic ${btoa(`${Env.BUNGIE_AUTH_CLIENT_ID}:${Env.BUNGIE_AUTH_CLIENT_SECRET}`)}`,
			},
			body: new URLSearchParams({
				grant_type: 'refresh_token',
				refresh_token: auth.refreshToken,
			}),
		}).then(res => res.json() as Promise<BungieTokenResponse>)

		return handleTokenResponse(tokenRequestTime, tokenResponse)
	}

	interface BungieTokenResponse {
		token_type: 'Bearer'
		access_token: string
		expires_in: number
		refresh_token: string
		refresh_expires_in: number
		membership_id: string
	}

	export async function complete (code: string): Promise<boolean> {
		if (!code)
			return false

		if (!Env.BUNGIE_AUTH_CLIENT_ID || !Env.BUNGIE_AUTH_CLIENT_SECRET) {
			console.error('BUNGIE_AUTH_CLIENT_ID or BUNGIE_AUTH_CLIENT_SECRET is not set in the environment')
			return false
		}

		const tokenRequestTime = Date.now()
		const tokenResponse = await fetch('https://www.bungie.net/Platform/App/OAuth/Token/', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				// 'X-API-Key': Env.BUNGIE_API_KEY,
				'Authorization': `Basic ${btoa(`${Env.BUNGIE_AUTH_CLIENT_ID}:${Env.BUNGIE_AUTH_CLIENT_SECRET}`)}`,
			},
			body: new URLSearchParams({
				grant_type: 'authorization_code',
				code: code,
			}),
		}).then(res => res.json() as Promise<BungieTokenResponse>)

		return handleTokenResponse(tokenRequestTime, tokenResponse)
	}

	async function handleTokenResponse (requestTime: number, tokenResponse: BungieTokenResponse) {
		if (tokenResponse.token_type !== 'Bearer' || !tokenResponse.access_token || !tokenResponse.refresh_token) {
			console.error('Invalid Bungie.net token response')
			return false
		}

		await Store.setAuth({
			accessToken: tokenResponse.access_token,
			accessExpiry: requestTime + tokenResponse.expires_in * 1000,
			refreshToken: tokenResponse.refresh_token,
			refreshExpiry: requestTime + tokenResponse.refresh_expires_in * 1000,
		})
		return true
	}
}

export default Auth
