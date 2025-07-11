import type { AuthedOrigin, CustomBungieApp } from './Auth'
import type { Profile } from './Profile'

export interface ConduitFunctionRegistry {
	isAuthenticated (): boolean
	getOriginAccess (origin: string): AuthedOrigin | undefined
	getProfiles (): Profile[]
	/** @deprecated This function is for internal use and won't work otherwise */
	_getOriginGrants (): AuthedOrigin[]
	/** @deprecated This function is for internal use and won't work otherwise */
	_getCustomApp (): CustomBungieApp | undefined
	/** @deprecated This function is for internal use and won't work otherwise */
	_setCustomApp (app?: CustomBungieApp): void
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
