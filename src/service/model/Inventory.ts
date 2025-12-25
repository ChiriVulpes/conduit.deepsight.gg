import type Inventory from '@shared/item/Inventory'
import type { InventoryCharacter } from '@shared/item/Inventory'
import type { ItemInstance } from '@shared/item/Item'
import type { DestinyClassDefinition, DestinyInventoryBucketDefinition, DestinyItemComponent } from 'bungie-api-ts/destiny2'
import type { ClassHashes, InventoryBucketHashes } from 'deepsight.gg/Enums'
import Definitions from 'model/Definitions'
import DestinyProfiles from 'model/DestinyProfiles'
import Items, { ITEMS_VERSION } from 'model/Items'
import { ProfiledModel } from 'model/ProfiledModel'

const version = `1.${ITEMS_VERSION}`

export default ProfiledModel<Inventory | undefined>('Inventory', {
	cacheDirtyTime: 1000 * 30, // 30 second cache time
	async fetch (profile) {
		const data = await DestinyProfiles.for(profile).get()
		return {
			version: `${version}/${data?.responseMintedTimestamp ?? 'n/a'}`,
			value: async (): Promise<Inventory | undefined> => {
				if (!data)
					return undefined

				const [
					DestinyClassDefinition,
					DestinyInventoryBucketDefinition,
				] = await Promise.all([
					Definitions.en.DestinyClassDefinition.get(),
					Definitions.en.DestinyInventoryBucketDefinition.get(),
				])

				const provider = await Items.provider(data, 'instance')
				const characters = Object.values(data.characters?.data ?? {})
				const ItemInstance = (item: DestinyItemComponent): ItemInstance => {
					const itemInstance = data.itemComponents?.instances?.data?.[item.itemInstanceId!]
					provider.item(item.itemHash)
					return {
						is: 'item-instance',
						id: item.itemInstanceId,
						itemHash: item.itemHash,
						bucketHash: item.bucketHash,
						tier: itemInstance?.gearTier,
					}
				}

				return {
					...{ version },
					...provider,
					characters: characters.toObject(character => [character.characterId, {
						id: character.characterId,
						metadata: character,
						items: ((data.characterInventories?.data?.[character.characterId]?.items ?? [])
							.map(ItemInstance)
						),
					} satisfies InventoryCharacter]),
					profileItems: data.profileInventory?.data?.items?.map(ItemInstance) ?? [],
					classes: DestinyClassDefinition as Record<ClassHashes, DestinyClassDefinition>,
					buckets: DestinyInventoryBucketDefinition as Record<InventoryBucketHashes, DestinyInventoryBucketDefinition>,
				}
			},
		}
	},
})
