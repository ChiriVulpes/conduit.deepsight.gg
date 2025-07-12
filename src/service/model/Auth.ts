import type { AccessGrant, AuthState, CustomBungieApp } from '@shared/Auth'
import Env from 'utility/Env'
import Log from 'utility/Log'
import Store from 'utility/Store'

declare module 'utility/Store' {
	export interface LocalStorage {
		origins: Record<string, AccessGrant>
		auth: {
			accessToken: string
			accessExpiry: number
			refreshToken: string
			refreshExpiry: number
		}
		customApp: CustomBungieApp
	}
}

namespace Auth {

	const AUTH_EXPIRY = 1000 * 60 * 60 * 24 * 30 // 30 days

	export async function getAuthState (): Promise<AuthState> {
		const [auth, customApp, accessGrants] = await Promise.all([
			Store.auth.get(),
			Store.customApp.get(),
			getOriginGrants(),
		])

		const clientId = customApp?.clientId ?? Env.BUNGIE_AUTH_CLIENT_ID

		return {
			authenticated: !!auth,
			accessGrants,
			bungieAuthURL: `https://www.bungie.net/en/OAuth/Authorize?client_id=${clientId}&response_type=code`,
			customApp,
		}
	}

	export async function getOriginAccess (origin: string): Promise<AccessGrant | undefined> {
		const origins = await Store.origins.get() ?? {}
		const auth = origins?.[origin]
		if (auth && auth.authTimestamp + AUTH_EXPIRY > Date.now())
			return auth

		delete origins[origin]
		await Store.origins.set(origins)
		return undefined
	}

	export async function getOriginGrants (): Promise<AccessGrant[]> {
		const origins = await Store.origins.get() ?? {}
		return Object.values(origins).filter(auth => auth.authTimestamp + AUTH_EXPIRY > Date.now())
	}

	export async function grantAccess (origin: string, appName?: string): Promise<void> {
		const origins = await Store.origins.get() ?? {}
		origins[origin] = {
			appName,
			origin,
			authTimestamp: Date.now(),
		}
		await Store.origins.set(origins)
		Log.info(`Granted access to origin: ${origin}`)
	}

	export async function denyAccess (origin: string): Promise<void> {
		const origins = await Store.origins.get() ?? {}
		if (origins[origin]) {
			delete origins[origin]
			await Store.origins.set(origins)
		}
		Log.info(`Denied access to origin: ${origin}`)
	}

	export async function getAPIKey () {
		const customApp = await Store.customApp.get()
		return customApp?.apiKey ?? Env.BUNGIE_API_KEY
	}

	export async function getAuthorisation () {
		const customApp = await Store.customApp.get()
		const clientId = customApp?.clientId ?? Env.BUNGIE_AUTH_CLIENT_ID
		const clientSecret = customApp?.clientSecret ?? Env.BUNGIE_AUTH_CLIENT_SECRET
		return `Basic ${btoa(`${clientId}:${clientSecret}`)}`
	}

	export async function getBungieAuthURL () {
		const customApp = await Store.customApp.get()
		const clientId = customApp?.clientId ?? Env.BUNGIE_AUTH_CLIENT_ID
		return `https://www.bungie.net/en/OAuth/Authorize?client_id=${clientId}&response_type=code`
	}

	export async function checkBungie () {
		const auth = await Store.auth.get()
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

		const authorisation = await getAuthorisation()

		// refresh access token
		Log.info('Refreshing Bungie.net access token...')
		const tokenRequestTime = Date.now()
		const tokenResponse = await fetch('https://www.bungie.net/Platform/App/OAuth/Token/', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Authorization': authorisation,
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

		const authorisation = await getAuthorisation()

		const tokenRequestTime = Date.now()
		const tokenResponse = await fetch('https://www.bungie.net/Platform/App/OAuth/Token/', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				// 'X-API-Key': Env.BUNGIE_API_KEY,
				'Authorization': authorisation,
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

		await Store.auth.set({
			accessToken: tokenResponse.access_token,
			accessExpiry: requestTime + tokenResponse.expires_in * 1000,
			refreshToken: tokenResponse.refresh_token,
			refreshExpiry: requestTime + tokenResponse.refresh_expires_in * 1000,
		})
		return true
	}
}

export default Auth
