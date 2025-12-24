import type { AuthState, CustomBungieApp } from 'Auth'
import type ConduitState from 'ConduitState'
import type { AllComponentNames, DefinitionLinks, DefinitionReferencesPage, DefinitionsFilter, DefinitionsForComponentName, DefinitionsPage, DefinitionWithLinks } from 'DefinitionComponents'
import type Collections from 'item/Collections'
import Inventory from 'item/Inventory'
import type { Profile } from 'Profile'
import type { ConduitSettings } from 'Settings'

export interface ConduitFunctionRegistry {
	getProfiles (): Promise<Profile[]>
	updateProfiles (): Promise<void>
	getProfile (displayName: string, displayNameCode: number): Promise<Profile | undefined>
	bumpProfile (displayName: string, displayNameCode: number): Promise<void>
	getCollections (): Promise<Collections>
	getCollections (displayName: string, displayNameCode: number): Promise<Collections>
	getInventory (displayName: string, displayNameCode: number): Promise<Inventory | undefined>
	getComponentNames (): Promise<AllComponentNames[]>
	/** 
	 * Get the current state of conduit — defs versions, profiles, etc. 
	 * 
	 * Only checks if defs versions have updated if the cache is old enough.
	 * Returns `version.updated: true` if there's been a defs update.
	 */
	getState (): Promise<ConduitState>
	/** Perform a hard defs update check, ignoring how recently they were cached */
	checkUpdate (): Promise<ConduitState>

	////////////////////////////////////
	//#region Private

	/** @private:start */
	setOrigin (): Promise<void>
	_getSetting<SETTING extends keyof ConduitSettings> (key: SETTING): Promise<ConduitSettings[SETTING] | undefined>
	_setSetting<SETTING extends keyof ConduitSettings> (key: SETTING, value: ConduitSettings[SETTING]): Promise<void>
	_resetSetting (key: keyof ConduitSettings): Promise<void>
	_getAuthState (): Promise<AuthState>
	_setCustomApp (app?: CustomBungieApp): Promise<void>
	_authenticate (code: string): Promise<boolean>
	_grantAccess (origin: string, appName?: string): Promise<void>
	_denyAccess (origin: string): Promise<void>
	_getDefinitionsComponent<NAME extends AllComponentNames> (language: string, component: NAME, filter?: DefinitionsFilter): Promise<DefinitionsForComponentName<NAME>>
	_getDefinitionsComponentPage<NAME extends AllComponentNames> (language: string, component: NAME, pageSize: number, page: number, filter?: DefinitionsFilter): Promise<DefinitionsPage<DefinitionsForComponentName<NAME>>>
	_getDefinition<NAME extends AllComponentNames> (language: string, component: NAME, hash: number | string): Promise<DefinitionsForComponentName<NAME> extends infer D ? D[keyof D] : never>
	_getDefinitionLinks<NAME extends AllComponentNames> (language: string, component: NAME, hash: number | string): Promise<DefinitionLinks | undefined>
	_getDefinitionWithLinks<NAME extends AllComponentNames> (language: string, component: NAME, hash: number | string): Promise<DefinitionWithLinks<DefinitionsForComponentName<NAME> extends infer D ? D[keyof D] : never> | undefined>
	_getDefinitionsReferencingPage<NAME extends AllComponentNames> (language: string, component: NAME, hash: number | string, pageSize: number, page: number): Promise<DefinitionReferencesPage>
	// the above defs cannot contain a } character or it will break the packager

	//#endregion
	////////////////////////////////////
}

export interface ConduitBroadcastRegistry {
	ready: void
	profilesUpdated: Profile[]
	_updateSettings: void
}
