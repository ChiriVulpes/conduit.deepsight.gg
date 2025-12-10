import type { DestinyAmmunitionType, DestinyClass, DestinyDamageTypeDefinition, DestinyDisplayPropertiesDefinition, DestinyEquipableItemSetDefinition, DestinySandboxPerkDefinition, DestinyStatDefinition, DestinyStatGroupDefinition } from 'bungie-api-ts/destiny2'
import type { DeepsightPlugFullName } from 'deepsight.gg/DeepsightPlugCategorisation'
import type { ActivityHashes, DamageTypeHashes, EquipableItemSetHashes, InventoryBucketHashes, ItemCategoryHashes, ItemTierTypeHashes, SandboxPerkHashes, StatHashes } from 'deepsight.gg/Enums'
import type { ClarityDescription, DeepsightDropTableDefinition, DeepsightItemSourceDefinition, DeepsightItemSourceType, DeepsightMomentDefinition, DeepsightTierTypeDefinition } from 'deepsight.gg/Interfaces'

interface Collections {
	moments: CollectionsMoment[]
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
	dropTables: Record<string, DeepsightDropTableDefinition>
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
	items: number[]
}

export interface Item {
	is: 'item'
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
	itemSetHash?: EquipableItemSetHashes
	flavorText?: string
	sources?: ItemSource[]
	previewImage?: string
	foundryImage?: string
	categories?: ItemCategoryHashes[]

	// unique to instances
	instanceId?: string
	tier?: number
}

export interface ItemAmmo {
	hash: DestinyAmmunitionType
	displayProperties: DestinyDisplayPropertiesDefinition
}

export interface ItemSocket {
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
}

export interface ItemSourceDropTable {
	type: 'table'
	id: ActivityHashes
}

export type ItemSource =
	| ItemSourceDefined
	| ItemSourceDropTable
