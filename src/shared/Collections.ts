import type { DestinyAmmunitionType, DestinyClass, DestinyDamageTypeDefinition, DestinyDisplayPropertiesDefinition, DestinyStatDefinition, DestinyStatGroupDefinition } from 'bungie-api-ts/destiny2'
import type { ClarityDescription } from 'Clarity'
import type { DeepsightPlugFullName } from 'deepsight.gg/DeepsightPlugCategorisation'
import type { DamageTypeHashes, InventoryBucketHashes, ItemTierTypeHashes, StatHashes } from 'deepsight.gg/Enums'
import type { DeepsightMomentDefinition, DeepsightTierTypeDefinition } from 'deepsight.gg/Interfaces'

interface Collections {
	moments: CollectionsMoment[]
	plugs: Record<number, ItemPlug>
	rarities: Record<ItemTierTypeHashes, DeepsightTierTypeDefinition>
	damageTypes: Record<DamageTypeHashes, DestinyDamageTypeDefinition>
	stats: Record<StatHashes, DestinyStatDefinition>
	statGroups: Record<number, DestinyStatGroupDefinition>
	ammoTypes: Record<DestinyAmmunitionType.Primary | DestinyAmmunitionType.Special | DestinyAmmunitionType.Heavy, ItemAmmo>
}

export default Collections

export interface CollectionsMoment {
	moment: DeepsightMomentDefinition
	buckets: {
		[InventoryBucketHashes.KineticWeapons]: CollectionsBucket
		[InventoryBucketHashes.EnergyWeapons]: CollectionsBucket
		[InventoryBucketHashes.PowerWeapons]: CollectionsBucket
		[InventoryBucketHashes.Helmet]: CollectionsBucket
		[InventoryBucketHashes.Gauntlets]: CollectionsBucket
		[InventoryBucketHashes.ChestArmor]: CollectionsBucket
		[InventoryBucketHashes.LegArmor]: CollectionsBucket
		[InventoryBucketHashes.ClassArmor]: CollectionsBucket
	}
}

export interface CollectionsBucket {
	items: Item[]
}

export interface Item {
	hash: number
	displayProperties: DestinyDisplayPropertiesDefinition
	watermark: string
	featuredWatermark?: string
	sockets: ItemSocket[]
	type: string
	rarity: ItemTierTypeHashes
	class?: DestinyClass
	damageTypes?: DamageTypeHashes[]
	ammo?: DestinyAmmunitionType.Primary | DestinyAmmunitionType.Special | DestinyAmmunitionType.Heavy
	statGroupHash?: number
	stats?: Partial<Record<StatHashes, ItemStat>>

	// unique to instances
	tier?: number
}

export interface ItemAmmo {
	hash: DestinyAmmunitionType
	displayProperties: DestinyDisplayPropertiesDefinition
}

export interface ItemArchetype {
	hash: number
	displayProperties: DestinyDisplayPropertiesDefinition
}

export interface ItemSocket {
	type: DeepsightPlugFullName
	plugs: number[]
	defaultPlugHash?: number
}

export interface ItemPlug {
	hash: number
	displayProperties: DestinyDisplayPropertiesDefinition
	type: DeepsightPlugFullName
	enhanced: boolean
	clarity?: ClarityDescription
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
	charge: number
}
