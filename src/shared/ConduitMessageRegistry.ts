import type { AuthState, CustomBungieApp } from 'Auth'
import type { AllComponentNames, DefinitionsForComponentName } from 'DefinitionComponents'
import type { Profile } from 'Profile'

export interface ConduitFunctionRegistry {
	getProfiles (): Promise<Profile[]>
	getProfile (displayName: string, displayNameCode: number): Promise<Profile | undefined>
	bumpProfile (displayName: string, displayNameCode: number): Promise<void>
	/** @private:start */
	_getAuthState (): Promise<AuthState>
	_setCustomApp (app?: CustomBungieApp): Promise<void>
	_authenticate (code: string): Promise<boolean>
	_grantAccess (origin: string, appName?: string): Promise<void>
	_denyAccess (origin: string): Promise<void>
	_getDefinitionsComponent<NAME extends AllComponentNames> (language: string, component: NAME): Promise<DefinitionsForComponentName<NAME>>
	_getDefinition<NAME extends AllComponentNames> (language: string, component: NAME, hash: number | string): Promise<DefinitionsForComponentName<NAME> extends infer D ? D[keyof D] : never>
	// the above defs cannot contain a } character or it will break the packager
}

export interface ConduitBroadcastRegistry {
	ready: void
}
