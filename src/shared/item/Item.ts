import type { DestinyAmmunitionType, DestinyClass, DestinyDamageTypeDefinition, DestinyDisplayPropertiesDefinition, DestinyEquipableItemSetDefinition, DestinyItemPlugBase, DestinySandboxPerkDefinition, DestinySocketCategoryDefinition, DestinyStatDefinition, DestinyStatGroupDefinition, ItemState } from 'bungie-api-ts/destiny2'
import type { DeepsightPlugFullName } from 'deepsight.gg/DeepsightPlugCategorisation'
import type { ActivityHashes, DamageTypeHashes, EquipableItemSetHashes, FoundryHashes, InventoryBucketHashes, ItemCategoryHashes, ItemTierTypeHashes, MomentHashes, PlugCategoryHashes, PlugSetHashes, SandboxPerkHashes, SocketCategoryHashes, SocketTypeHashes, StatHashes } from 'deepsight.gg/Enums'
import type { ClarityDescription, DeepsightDropTableDefinition, DeepsightItemSourceDefinition, DeepsightItemSourceType, DeepsightTierTypeDefinition, DeepsightWeaponFoundryDefinition } from 'deepsight.gg/Interfaces'

export interface ItemProvider {
	items: Record<number, Item>
	plugs: Record<number, ItemPlug>
	rarities: Record<ItemTierTypeHashes, DeepsightTierTypeDefinition>
	damageTypes: Record<DamageTypeHashes, DestinyDamageTypeDefinition>
	stats: Record<StatHashes, DestinyStatDefinition>
	statGroups: Record<number, DestinyStatGroupDefinition>
	ammoTypes: Record<DestinyAmmunitionType.Primary | DestinyAmmunitionType.Special | DestinyAmmunitionType.Heavy, ItemAmmo>
	itemSets: Record<EquipableItemSetHashes, DestinyEquipableItemSetDefinition>
	perks: Partial<Record<SandboxPerkHashes, DestinySandboxPerkDefinition>>
	sources: Record<DeepsightItemSourceType, DeepsightItemSourceDefinition>
	dropTables: Record<ActivityHashes, DeepsightDropTableDefinition>
	socketCategories: Record<SocketCategoryHashes, DestinySocketCategoryDefinition>
	foundries: Record<FoundryHashes, DeepsightWeaponFoundryDefinition>
}

export interface ItemInstance {
	is: 'item-instance'
	id?: string
	itemHash: number
	bucketHash: InventoryBucketHashes
	tier?: number
	quantity?: number
	sockets?: ItemSocket[]
	state: ItemState
}

export interface ItemSocket {
	plugHash?: number
	availableReusablePlugs?: DestinyItemPlugBase[]
	availableCharacterPlugSet?: PlugSetHashes
	availableProfilePlugSet?: PlugSetHashes
	availableInventoryPlugsSocketType?: SocketTypeHashes
}

export interface Item {
	is: 'item'
	hash: number
	displayProperties: DestinyDisplayPropertiesDefinition
	momentHash?: MomentHashes
	featured: boolean
	sockets: ItemSocketDefinition[]
	type: string
	rarity: ItemTierTypeHashes
	classType?: DestinyClass
	damageTypeHashes?: DamageTypeHashes[]
	ammoType?: DestinyAmmunitionType.Primary | DestinyAmmunitionType.Special | DestinyAmmunitionType.Heavy
	statGroupHash?: number
	stats?: Partial<Record<StatHashes, ItemStat>>
	itemSetHash?: EquipableItemSetHashes
	flavorText?: string
	sources?: ItemSource[]
	previewImage?: string
	foundryHash?: FoundryHashes
	categoryHashes?: ItemCategoryHashes[]
	bucketHash?: InventoryBucketHashes
	maxStackSize?: number
}

export interface ItemAmmo {
	hash: DestinyAmmunitionType
	displayProperties: DestinyDisplayPropertiesDefinition
}

export interface ItemSocketDefinition {
	type: DeepsightPlugFullName
	plugs: number[]
	defaultPlugHash?: number
}

export interface ItemPlug {
	is: 'plug'
	hash: number
	displayProperties: DestinyDisplayPropertiesDefinition
	type: DeepsightPlugFullName
	enhanced: boolean
	clarity?: ClarityDescription
	perks?: SandboxPerkHashes[]
	stats?: Partial<Record<StatHashes, ItemStat>>
	categoryHash: PlugCategoryHashes
}

export interface ItemStat {
	hash: StatHashes
	value: number
	max?: number
	displayAsNumeric?: true

	intrinsic: number
	roll: number
	masterwork: number
	mod: number
	subclass: number
	charge: number | number[]
}

export interface ItemSourceDefined {
	type: 'defined'
	id: DeepsightItemSourceType
	eventState?: 'active' | 'upcoming' | 'unknown'
}

export interface ItemSourceDropTable {
	type: 'table'
	id: ActivityHashes
}

export type ItemSource =
	| ItemSourceDefined
	| ItemSourceDropTable
