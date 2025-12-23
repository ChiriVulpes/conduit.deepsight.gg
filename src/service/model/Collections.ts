import type Collections from '@shared/item/Collections'
import type { CollectionsBucket, CollectionsMoment } from '@shared/item/Collections'
import { InventoryBucketHashes } from 'deepsight.gg/Enums'
import CombinedManifestVersion from 'model/CombinedManifestVersion'
import Definitions from 'model/Definitions'
import DestinyProfiles from 'model/DestinyProfiles'
import Items, { ITEMS_VERSION } from 'model/Items'
import { ProfiledModel } from 'model/ProfiledModel'

const version = `29.${ITEMS_VERSION}`
function buckets (): CollectionsMoment['buckets'] {
	return {
		[InventoryBucketHashes.KineticWeapons]: { items: [] },
		[InventoryBucketHashes.EnergyWeapons]: { items: [] },
		[InventoryBucketHashes.PowerWeapons]: { items: [] },
		[InventoryBucketHashes.Helmet]: { items: [] },
		[InventoryBucketHashes.Gauntlets]: { items: [] },
		[InventoryBucketHashes.ChestArmor]: { items: [] },
		[InventoryBucketHashes.LegArmor]: { items: [] },
		[InventoryBucketHashes.ClassArmor]: { items: [] },
	}
}

export default ProfiledModel<Collections>('Collections', {
	cacheDirtyTime: 1000 * 60 * 1, // 1 minute cache time
	async fetch (profile) {
		const data = await DestinyProfiles.for(profile).get()
		return {
			version: `${version}/${await CombinedManifestVersion.get()}/${data?.responseMintedTimestamp ?? 'n/a'}`,
			value: async (): Promise<Collections> => {
				const [
					DeepsightCollectionsDefinition,
					DeepsightMomentDefinition,
				] = await Promise.all([
					Definitions.en.DeepsightCollectionsDefinition.get(),
					Definitions.en.DeepsightMomentDefinition.get(),
				])

				const provider = await Items.provider(data, 'collections')

				return {
					...{ version },
					moments: (Object.values(DeepsightMomentDefinition)
						.map((moment): CollectionsMoment => ({
							moment,
							buckets: Object.assign(buckets(),
								(Object.entries(DeepsightCollectionsDefinition[moment.hash]?.buckets || {})
									.map(([bucketHash, itemHashes]): [string, CollectionsBucket] => [bucketHash, {
										items: itemHashes.map(hash => provider.item(hash)).filter(item => item !== undefined),
									}])
									.collect(Object.fromEntries) as CollectionsMoment['buckets']
								),
							),
						}))
						.sort((a, b) => b.moment.hash - a.moment.hash)
					),
					...provider,
				}
			},
		}
	},
})
