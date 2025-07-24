import type { DestinyClass, DestinyDisplayPropertiesDefinition } from 'bungie-api-ts/destiny2'
import type { ClarityDescription } from 'Clarity'
import type { DeepsightPlugFullName } from 'deepsight.gg/DeepsightPlugCategorisation'
import type { InventoryBucketHashes, ItemTierTypeHashes } from 'deepsight.gg/Enums'
import type { DeepsightMomentDefinition, DeepsightTierTypeDefinition } from 'deepsight.gg/Interfaces'

interface Collections {
	moments: CollectionsMoment[]
	plugs: Record<number, CollectionsPlug>
	rarities: Record<ItemTierTypeHashes, DeepsightTierTypeDefinition>
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
	items: CollectionsItem[]
}

export interface CollectionsItem {
	hash: number
	displayProperties: DestinyDisplayPropertiesDefinition
	watermark: string
	featuredWatermark?: string
	sockets: CollectionsSocket[]
	rarity: ItemTierTypeHashes
	class?: DestinyClass
}

export interface CollectionsSocket {
	type: DeepsightPlugFullName
	plugs: CollectionsPlug[]
	defaultPlugHash?: number
}

export interface CollectionsPlug {
	hash: number
	displayProperties: DestinyDisplayPropertiesDefinition
	type: DeepsightPlugFullName
	enhanced: boolean
	clarity?: ClarityDescription
}
