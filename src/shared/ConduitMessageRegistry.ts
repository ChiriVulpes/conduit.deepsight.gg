import type { AuthState, CustomBungieApp } from 'Auth'
import type { AllComponentNames, DefinitionsForComponentName } from 'DefinitionComponents'
import type { Profile } from 'Profile'

export interface ConduitFunctionRegistry {
	getProfiles (): Promise<Profile[]>
	getProfile (displayName: string, displayNameCode: number): Promise<Profile | undefined>
	bumpProfile (displayName: string, displayNameCode: number): Promise<void>

	/** @deprecated This function is for internal use and won't work otherwise */
	_getAuthState (): Promise<AuthState>
	/** @deprecated This function is for internal use and won't work otherwise */
	_setCustomApp (app?: CustomBungieApp): Promise<void>
	/** @deprecated This function is for internal use and won't work otherwise */
	_authenticate (code: string): Promise<boolean>
	/** @deprecated This function is for internal use and won't work otherwise */
	_grantAccess (origin: string, appName?: string): Promise<void>
	/** @deprecated This function is for internal use and won't work otherwise */
	_denyAccess (origin: string): Promise<void>
	_getDefinitionsComponent<NAME extends AllComponentNames> (language: string, component: NAME): Promise<DefinitionsForComponentName<NAME>>
	_getDefinition<NAME extends AllComponentNames> (language: string, component: NAME, hash: number | string): Promise<DefinitionsForComponentName<NAME> extends infer D ? D[keyof D] : never>
}

export interface ConduitBroadcastRegistry {
	ready: void
}
