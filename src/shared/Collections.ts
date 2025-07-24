import type { ClarityDescription } from 'Clarity'
import type { DeepsightMomentDefinition } from 'deepsight.gg/Interfaces'
import type { DestinyDisplayPropertiesDefinition } from 'node_modules/bungie-api-ts/destiny2'
import type { DeepsightPlugFullName } from 'node_modules/deepsight.gg/DeepsightPlugCategorisation'
import type { InventoryBucketHashes } from 'node_modules/deepsight.gg/Enums'

interface Collections {
	moments: CollectionsMoment[]
	plugs: Record<number, CollectionsPlug>
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
