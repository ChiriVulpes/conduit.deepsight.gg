import type Collections from '@shared/Collections'
import type { CollectionsItem, CollectionsMoment, CollectionsPlug, CollectionsSocket } from '@shared/Collections'
import type { DestinyInventoryItemDefinition, DestinyItemSocketEntryDefinition } from 'bungie-api-ts/destiny2/interfaces'
import { SocketPlugSources } from 'bungie-api-ts/destiny2/interfaces'
import { InventoryBucketHashes } from 'deepsight.gg/Enums'
import CombinedManifestVersion from 'model/CombinedManifestVersion'
import Definitions from 'model/Definitions'
import Model from 'model/Model'

const version = '3'
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
				const ClarityDescriptions = await Definitions.en.ClarityDescriptions.get()
				const DeepsightCollectionsDefinition = await Definitions.en.DeepsightCollectionsDefinition.get()
				const DeepsightMomentDefinition = await Definitions.en.DeepsightMomentDefinition.get()
				const DeepsightPlugCategorisation = await Definitions.en.DeepsightPlugCategorisation.get()
				const DeepsightSocketCategorisation = await Definitions.en.DeepsightSocketCategorisation.get()
				const DeepsightSocketExtendedDefinition = await Definitions.en.DeepsightSocketExtendedDefinition.get()
				const DestinyInventoryItemDefinition = await Definitions.en.DestinyInventoryItemDefinition.get()
				const DestinyPlugSetDefinition = await Definitions.en.DestinyPlugSetDefinition.get()

				function item (hash: number, def: DestinyInventoryItemDefinition): CollectionsItem {
					return {
						hash,
						displayProperties: def.displayProperties,
						watermark: def.iconWatermark,
						featuredWatermark: def.isFeaturedItem ? def.iconWatermarkFeatured : undefined,
						sockets: def.sockets?.socketEntries.map((entryDef, i): CollectionsSocket => socket(hash, i, entryDef)) ?? [],
					}
				}

				function socket (itemHash: number, socketIndex: number, entryDef: DestinyItemSocketEntryDefinition): CollectionsSocket {
					const categorisationFullName = DeepsightSocketCategorisation[itemHash]?.categorisation[socketIndex]?.fullName ?? 'None'

					const plugHashes = categorisationFullName === 'Cosmetic/Shader' || categorisationFullName === 'Cosmetic/Ornament' ? []
						: Array.from(new Set([
							...entryDef.singleInitialItemHash ? [entryDef.singleInitialItemHash] : [],
							...DeepsightSocketExtendedDefinition[itemHash]?.sockets[socketIndex]?.rewardPlugItems.map(plug => plug.plugItemHash) ?? [],
							...!(entryDef.plugSources & SocketPlugSources.ReusablePlugItems) ? []
								: [
									...entryDef.reusablePlugItems.map(plug => plug.plugItemHash),
									...DestinyPlugSetDefinition[entryDef.reusablePlugSetHash!]?.reusablePlugItems.map(plug => plug.plugItemHash) ?? [],
									...DestinyPlugSetDefinition[entryDef.randomizedPlugSetHash!]?.reusablePlugItems.map(plug => plug.plugItemHash) ?? [],
								],
						]))

					return {
						type: categorisationFullName,
						defaultPlugHash: entryDef.singleInitialItemHash,
						plugs: plugHashes.map(plug).filter(plug => plug !== undefined),
					}
				}

				const plugs: Record<number, CollectionsPlug | undefined> = {}
				function plug (hash: number): CollectionsPlug | undefined {
					if (hash in plugs)
						return plugs[hash]

					const def = DestinyInventoryItemDefinition[hash]
					if (!def)
						return plugs[hash] = undefined

					const categorisation = DeepsightPlugCategorisation[hash]
					return plugs[hash] = {
						hash,
						displayProperties: def.displayProperties,
						type: categorisation?.fullName ?? 'None',
						enhanced: categorisation?.fullName.includes('Enhanced') ?? false,
						clarity: ClarityDescriptions[hash],
					}
				}

				return {
					moments: Object.values(DeepsightMomentDefinition)
						.map((moment): CollectionsMoment => ({
							moment,
							buckets: Object.assign(buckets(),
								Object.entries(DeepsightCollectionsDefinition[moment.hash]?.buckets || {})
									.map(([bucketHash, itemHashes]): [string, CollectionsItem[]] => [bucketHash,
										itemHashes.map((hash): [number, DestinyInventoryItemDefinition | undefined] => [hash, DestinyInventoryItemDefinition[hash]])
											.filter((tuple): tuple is [number, DestinyInventoryItemDefinition] => tuple[1] !== undefined)
											.map(([hash, def]): CollectionsItem => item(hash, def)),
									])
									.collect(Object.fromEntries) as CollectionsMoment['buckets'],
							),
						})),
					plugs: plugs as Record<number, CollectionsPlug>,
				}
			},
		}
	},
})
