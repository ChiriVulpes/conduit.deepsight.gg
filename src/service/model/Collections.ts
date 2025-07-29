import type Collections from '@shared/Collections'
import type { CollectionsBucket, CollectionsMoment } from '@shared/Collections'
import { DestinyAmmunitionType, type DestinyDamageTypeDefinition, type DestinyStatDefinition } from 'bungie-api-ts/destiny2/interfaces'
import type { DamageTypeHashes, StatHashes } from 'deepsight.gg/Enums'
import { InventoryBucketHashes, PresentationNodeHashes } from 'deepsight.gg/Enums'
import CombinedManifestVersion from 'model/CombinedManifestVersion'
import Definitions from 'model/Definitions'
import Items, { ITEMS_VERSION } from 'model/Items'
import Model from 'model/Model'

const version = `18.${ITEMS_VERSION}`
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

export default Model<Collections>('Collections', {
	cacheDirtyTime: 1000 * 60, // 1 hour cache time
	async fetch () {
		return {
			version: `${version}/${await CombinedManifestVersion.get()}`,
			value: async (): Promise<Collections> => {
				const DeepsightCollectionsDefinition = await Definitions.en.DeepsightCollectionsDefinition.get()
				const DeepsightMomentDefinition = await Definitions.en.DeepsightMomentDefinition.get()
				const DeepsightTierTypeDefinition = await Definitions.en.DeepsightTierTypeDefinition.get()
				const DestinyDamageTypeDefinition = await Definitions.en.DestinyDamageTypeDefinition.get()
				const DestinyStatDefinition = await Definitions.en.DestinyStatDefinition.get()
				const DestinyStatGroupDefinition = await Definitions.en.DestinyStatGroupDefinition.get()
				const DestinyPresentationNodeDefinition = await Definitions.en.DestinyPresentationNodeDefinition.get()

				const resolver = await Items.createResolver('collections')

				const ammoTypes: Collections['ammoTypes'] = {
					[DestinyAmmunitionType.Primary]: {
						hash: DestinyAmmunitionType.Primary,
						displayProperties: DestinyPresentationNodeDefinition[PresentationNodeHashes.Primary_ObjectiveHash1662965554].displayProperties,
					},
					[DestinyAmmunitionType.Special]: {
						hash: DestinyAmmunitionType.Special,
						displayProperties: DestinyPresentationNodeDefinition[PresentationNodeHashes.Special_Scope1].displayProperties,
					},
					[DestinyAmmunitionType.Heavy]: {
						hash: DestinyAmmunitionType.Heavy,
						displayProperties: DestinyPresentationNodeDefinition[PresentationNodeHashes.Heavy_ObjectiveHash3528763451].displayProperties,
					},
				}

				return {
					moments: Object.values(DeepsightMomentDefinition)
						.map((moment): CollectionsMoment => ({
							moment,
							buckets: Object.assign(buckets(),
								Object.entries(DeepsightCollectionsDefinition[moment.hash]?.buckets || {})
									.map(([bucketHash, itemHashes]): [string, CollectionsBucket] => [bucketHash, {
										items: itemHashes.map(resolver.item).filter(item => item !== undefined),
									}])
									.collect(Object.fromEntries) as CollectionsMoment['buckets'],
							),
						}))
						.sort((a, b) => b.moment.hash - a.moment.hash),
					plugs: resolver.plugs,
					rarities: DeepsightTierTypeDefinition,
					damageTypes: DestinyDamageTypeDefinition as Record<DamageTypeHashes, DestinyDamageTypeDefinition>,
					stats: DestinyStatDefinition as Record<StatHashes, DestinyStatDefinition>,
					statGroups: DestinyStatGroupDefinition,
					ammoTypes,
				}
			},
		}
	},
})
