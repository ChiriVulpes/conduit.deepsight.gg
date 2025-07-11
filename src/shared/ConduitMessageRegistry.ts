import type { AuthedOrigin } from './Auth'
import type { Profile } from './Profile'

export interface ConduitFunctionRegistry {
	isAuthenticated (): boolean
	getOriginAccess (origin: string): AuthedOrigin | undefined
	getOriginGrants (): AuthedOrigin[]
	getProfiles (): Profile[]
	/** @deprecated This function is for internal use and won't work otherwise */
	_authenticate (code: string): boolean
	/** @deprecated This function is for internal use and won't work otherwise */
	_grantAccess (origin: string, appName?: string): void
	/** @deprecated This function is for internal use and won't work otherwise */
	_denyAccess (origin: string): void
}

export interface ConduitBroadcastRegistry {
	testBroadcast: string
}
