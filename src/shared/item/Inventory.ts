import type { DestinyClassDefinition, DestinyInventoryBucketDefinition } from 'bungie-api-ts/destiny2'
import type { Character } from 'Character'
import type { ItemInstance, ItemProvider } from 'item/Item'
import type { ClassHashes, InventoryBucketHashes } from 'node_modules/deepsight.gg/Enums'

interface Inventory extends ItemProvider {
	characters: Record<string, InventoryCharacter>
	profileItems: ItemInstance[]
	classes: Record<ClassHashes, DestinyClassDefinition>
	buckets: Record<InventoryBucketHashes, DestinyInventoryBucketDefinition>
}

export default Inventory

export interface InventoryCharacter extends Character {
	equippedItems: ItemInstance[]
	items: ItemInstance[]
}
