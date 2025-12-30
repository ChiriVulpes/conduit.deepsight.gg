import type { DestinyClassDefinition, DestinyInventoryBucketDefinition, DestinyItemPlug, DestinySocketTypeDefinition } from 'bungie-api-ts/destiny2'
import type { Character } from 'Character'
import type { ClassHashes, InventoryBucketHashes, PlugSetHashes, SocketTypeHashes } from 'deepsight.gg/Enums'
import type { ItemInstance, ItemProvider } from 'item/Item'

interface Inventory extends ItemProvider {
	characters: Record<string, InventoryCharacter>
	profileItems: ItemInstance[]
	profilePlugSets?: Record<PlugSetHashes, DestinyItemPlug[]>
	classes: Record<ClassHashes, DestinyClassDefinition>
	buckets: Record<InventoryBucketHashes, DestinyInventoryBucketDefinition>
	socketTypes: Record<SocketTypeHashes, DestinySocketTypeDefinition>
}

export default Inventory

export interface InventoryCharacter extends Character {
	equippedItems: ItemInstance[]
	items: ItemInstance[]
	plugSets?: Record<PlugSetHashes, DestinyItemPlug[]>
}
