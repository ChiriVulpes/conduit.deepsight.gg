import type { AuthState, CustomBungieApp } from 'Auth'
import type ConduitState from 'ConduitState'
import type { AllComponentNames, DefinitionLinks, DefinitionReferencesPage, DefinitionsFilter, DefinitionsForComponentName, DefinitionsPage, DefinitionWithLinks } from 'DefinitionComponents'
import type Collections from 'item/Collections'
import type Inventory from 'item/Inventory'
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
	getInventoryCached (displayName: string, displayNameCode: number): Promise<Inventory | undefined>
	vaultItem (item: ItemTransferReference): Promise<ItemTransferAction[]>
	moveItemToCharacter (characterId: string, item: ItemTransferReference): Promise<ItemTransferAction[]>
	equipItemOnCharacter (characterId: string, item: ItemTransferReference): Promise<ItemTransferAction[]>
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

export interface ItemTransferReference {
	instanceId?: string
	itemHash: number
	characterId?: string
	stackSize?: number
	isLostItem?: true
}

export interface ItemTransferAction {
	item: ItemTransferReference
	to: 'vault' | 'character' | 'equipped'
	newCharacterId?: string
}

export type ItemTransferRecoveryPolicy =
	| 'leave-partial-success'
	| 'best-effort-revert'

export type ItemTransferRecoveryResult =
	| 'none'
	| 'not-attempted'
	| 'succeeded'
	| 'failed'

export interface ItemTransferIntent {
	operationId: string
	action: 'vault-item' | 'move-item-to-character' | 'equip-item-on-character'
	item: ItemTransferReference
	to?: 'vault' | 'character' | 'equipped'
	characterId?: string
	recoveryPolicy?: ItemTransferRecoveryPolicy
}

export interface InventoryPatchItemReference {
	instanceId?: string
	itemHash: number
	stackSize?: number
}

export type InventoryPatchLocation =
	| { container: 'vault' }
	| { container: 'characterInventory', characterId: string }
	| { container: 'characterEquipment', characterId: string }
	| { container: 'postmaster', characterId: string }

export type InventoryPatch =
	| {
		type: 'move'
		item: InventoryPatchItemReference
		from: InventoryPatchLocation
		to: InventoryPatchLocation
	}
	| {
		type: 'bucket-correction'
		item: InventoryPatchItemReference
		location: InventoryPatchLocation
		bucketHash: number
	}

export interface InventoryPatchEvent {
	operationId: string
	profile: Profile
	patches: InventoryPatch[]
}

export interface ItemTransferFailure {
	operationId: string
	failedStep: string
	reason: 'auth' | 'bungie' | 'unknown'
	recoveryPolicy?: ItemTransferRecoveryPolicy
	recoveryResult: ItemTransferRecoveryResult
	finalBestKnownState?: InventoryPatch[]
}

export interface ItemTransferComplete {
	operationId: string
	actions: ItemTransferAction[]
}

export type RelatedItem =
	| RelatedItemReference
	| RelatedCharacterReference

export interface RelatedItemReference {
	is: 'item-reference'
	itemHash: number
	instanceId?: string
	stackSize?: number
}

export interface RelatedCharacterReference {
	is: 'character-reference'
	characterId: string
}

export type ConduitWarningMessageType =
	| 'Item has watermark but no moment'
	| 'Unable to transfer item: Not authenticated'
	| 'Unable to transfer item: Character required'
	| 'Unable to equip item: Instance required'
	| 'Unable to equip item: Planner support required'
	| 'Unable to pull item from postmaster: Unknown item'

export interface ConduitWarningMessage {
	type: ConduitWarningMessageType
	/** Who this warning should be displayed to */
	category: 'user' | 'developer' | 'conduit'
	related?: RelatedItem[]
}

export type ConduitOperationType =
	| 'Searching Destiny players'
	| 'Updating player profiles'
	| 'Updating your player profile'
	| 'Validating Bungie.net access token'
	| 'Fetching Destiny profile'
	| 'Resolving inventory'
	| 'Resolving collections'
	| 'Checking for new definitions'
	| 'Downloading definitions'
	| 'Vaulting item'
	| 'Moving item to character'
	| 'Pulling item from postmaster'
	| 'Transferring item to vault'
	| 'Transferring item to character'
	| 'Equipping item'

export interface ConduitOperation {
	id: string
	type: ConduitOperationType
	related?: RelatedItem[]
}

export interface InventoryUpdated {
	profile: Profile
	inventory: Inventory
}

export interface ConduitBroadcastRegistry {
	ready: void
	profilesUpdated: Profile[]
	inventoryUpdated: InventoryUpdated
	itemTransferIntent: ItemTransferIntent
	inventoryPatch: InventoryPatchEvent
	itemTransferFailure: ItemTransferFailure
	itemTransferComplete: ItemTransferComplete
	warning: ConduitWarningMessage
	startOperation: ConduitOperation
	endOperation: string
	_updateSettings: void
}
