import type { DestinyItemComponent } from 'bungie-api-ts/destiny2'
import DestinyProfiles from 'model/DestinyProfiles'
import { ProfiledModel } from 'model/ProfiledModel'

interface ItemLocationsBase {
	characterEquipment: Record<string, DestinyItemComponent[]>
	characterInventories: Record<string, DestinyItemComponent[]>
	profile: DestinyItemComponent[]
}

interface ItemLocationsOverrides extends Partial<ItemLocationsBase> {
	time: number
}

interface ItemLocations {
	base: ItemLocationsBase
	overrides: ItemLocationsOverrides[]
}

const ItemLocations = ProfiledModel<ItemLocations>('ItemLocations', {
	cacheDirtyTime: 1000 * 10, // 10 second cache time
	async fetch (profile) {
		const destinyProfile = await DestinyProfiles.for(profile).get()
		return {
			version: `1.${destinyProfile?.responseMintedTimestamp ?? 'n/a'}`,
			value: {
				base: {
					characterEquipment: Object.entries(destinyProfile?.characterEquipment?.data ?? {})
						.toObject(([characterId, inventory]) => [
							characterId,
							inventory.items,
						]),
					characterInventories: Object.entries(destinyProfile?.characterInventories?.data ?? {})
						.toObject(([characterId, inventory]) => [
							characterId,
							inventory.items,
						]),
					profile: (destinyProfile?.profileInventory?.data?.items ?? []),
				},
				overrides: [],
			},
		}
	},
})

export default ItemLocations
