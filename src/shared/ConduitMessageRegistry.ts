import type { AuthState, CustomBungieApp } from 'Auth'
import type { Profile } from 'Profile'

export interface ConduitFunctionRegistry {
	getProfiles (): Profile[]
	getProfile (displayName: string, displayNameCode: number): Profile | undefined
	bumpProfile (displayName: string, displayNameCode: number): void

	/** @deprecated This function is for internal use and won't work otherwise */
	_getAuthState (): AuthState
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
	ready: void
}
