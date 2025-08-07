import type Collections from '@shared/Collections'
import type { CollectionsBucket, CollectionsMoment } from '@shared/Collections'
import type { DestinyDamageTypeDefinition, DestinyEquipableItemSetDefinition, DestinyStatDefinition } from 'bungie-api-ts/destiny2/interfaces'
import { DestinyAmmunitionType } from 'bungie-api-ts/destiny2/interfaces'
import type { DamageTypeHashes, EquipableItemSetHashes, StatHashes } from 'deepsight.gg/Enums'
import { InventoryBucketHashes, PresentationNodeHashes } from 'deepsight.gg/Enums'
import CombinedManifestVersion from 'model/CombinedManifestVersion'
import Definitions from 'model/Definitions'
import Items, { ITEMS_VERSION } from 'model/Items'
import Model from 'model/Model'

const version = `24.${ITEMS_VERSION}`
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
	cacheDirtyTime: 1000 * 60 * 1, // 1 minute cache time
	async fetch () {
		return {
			version: `${version}/${await CombinedManifestVersion.get()}`,
			value: async (): Promise<Collections> => {
				const [
					DeepsightCollectionsDefinition,
					DeepsightDropTableDefinition,
					DeepsightItemSourceDefinition,
					DeepsightMomentDefinition,
					DeepsightTierTypeDefinition,
					DestinyDamageTypeDefinition,
					DestinyEquipableItemSetDefinition,
					DestinyPresentationNodeDefinition,
					DestinyStatDefinition,
					DestinyStatGroupDefinition,
				] = await Promise.all([
					Definitions.en.DeepsightCollectionsDefinition.get(),
					Definitions.en.DeepsightDropTableDefinition.get(),
					Definitions.en.DeepsightItemSourceDefinition.get(),
					Definitions.en.DeepsightMomentDefinition.get(),
					Definitions.en.DeepsightTierTypeDefinition.get(),
					Definitions.en.DestinyDamageTypeDefinition.get(),
					Definitions.en.DestinyEquipableItemSetDefinition.get(),
					Definitions.en.DestinyPresentationNodeDefinition.get(),
					Definitions.en.DestinyStatDefinition.get(),
					Definitions.en.DestinyStatGroupDefinition.get(),
				])

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
					itemSets: DestinyEquipableItemSetDefinition as Record<EquipableItemSetHashes, DestinyEquipableItemSetDefinition>,
					perks: resolver.perks,
					sources: DeepsightItemSourceDefinition,
					dropTables: DeepsightDropTableDefinition,
				}
			},
		}
	},
})
