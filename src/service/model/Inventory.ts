import type Inventory from '@shared/item/Inventory'
import type { InventoryCharacter } from '@shared/item/Inventory'
import type { ItemInstance, ItemSocket } from '@shared/item/Item'
import type { DestinyItemPlug, DestinySocketTypeDefinition } from 'bungie-api-ts/destiny2'
import { SocketPlugSources, type DestinyClassDefinition, type DestinyInventoryBucketDefinition, type DestinyItemComponent } from 'bungie-api-ts/destiny2'
import type { ClassHashes, InventoryBucketHashes, PlugSetHashes, SocketTypeHashes } from 'deepsight.gg/Enums'
import Definitions from 'model/Definitions'
import DestinyProfiles from 'model/DestinyProfiles'
import Items, { ITEMS_VERSION } from 'model/Items'
import { ProfiledModel } from 'model/ProfiledModel'
import Broadcast from 'utility/Broadcast'
import Colour from 'utility/Colour'

const version = `8.${ITEMS_VERSION}`

export default ProfiledModel<Inventory | undefined>('Inventory', {
	cacheDirtyTime: 1000 * 10, // 10 second cache time
	async fetch (profile) {
		const data = await DestinyProfiles.for(profile).get()
		return {
			version: `${version}/${data?.responseMintedTimestamp ?? 'n/a'}`,
			value: async (): Promise<Inventory | undefined> => {
				if (!data)
					return undefined

				return await Broadcast.operation('Resolving inventory', async () => {
					const [
						DestinyClassDefinition,
						DestinyInventoryBucketDefinition,
						DeepsightEmblemDefinition,
						// DeepsightSocketCategorisation,
						DestinySocketTypeDefinition,
					] = await Promise.all([
						Definitions.en.DestinyClassDefinition.get(),
						Definitions.en.DestinyInventoryBucketDefinition.get(),
						Definitions.en.DeepsightEmblemDefinition.get(),
						// Definitions.en.DeepsightSocketCategorisation.get(),
						Definitions.en.DestinySocketTypeDefinition.get(),
					])

					const characterPlugSets: Record<string, Record<PlugSetHashes, DestinyItemPlug[]>> = {}
					const profilePlugSets: Record<PlugSetHashes, DestinyItemPlug[]> = {} as never
					const socketTypes: Record<number, DestinySocketTypeDefinition> = {} as never

					const useCharacterPlugSet = (character: string, plugSetHash: number) => {
						characterPlugSets[character] ??= {} as never
						characterPlugSets[character][plugSetHash as PlugSetHashes] ??= data.characterPlugSets?.data?.[character]?.plugs?.[plugSetHash] ?? []
						return plugSetHash as PlugSetHashes
					}

					const useProfilePlugSet = (plugSetHash: number) => {
						profilePlugSets[plugSetHash as PlugSetHashes] ??= data.profilePlugSets?.data?.plugs?.[plugSetHash] ?? []
						return plugSetHash as PlugSetHashes
					}

					const useSocketType = (socketTypeHash: SocketTypeHashes) => {
						socketTypes[socketTypeHash] ??= DestinySocketTypeDefinition[socketTypeHash]
						return socketTypeHash
					}

					const provider = await Items.provider(data, 'instance')
					const characters = Object.values(data.characters?.data ?? {})
					const ItemInstance = (item: DestinyItemComponent, characterId?: string): ItemInstance => {
						const itemInstance = data.itemComponents?.instances?.data?.[item.itemInstanceId!]
						const itemSockets = data.itemComponents?.sockets.data?.[item.itemInstanceId!]
						const def = provider.item(item.itemHash)
						const plugs = data.itemComponents?.reusablePlugs.data?.[item.itemInstanceId!]?.plugs

						return {
							is: 'item-instance',
							id: item.itemInstanceId,
							itemHash: item.itemHash,
							bucketHash: item.bucketHash,
							tier: itemInstance?.gearTier,
							quantity: item.quantity,
							state: item.state,
							sockets: def?.sockets?.socketEntries.map((socket, i): ItemSocket => {
								const plugDef = provider.item(itemSockets?.sockets?.[i]?.plugHash)
								provider.plug(plugDef?.hash)
								return {
									plugHash: plugDef?.plug?.isDummyPlug ? undefined : plugDef?.hash,
									availableReusablePlugs: plugs?.[i],
									availableCharacterPlugSet: socket.plugSources & SocketPlugSources.CharacterPlugSet ? useCharacterPlugSet(characterId!, socket.reusablePlugSetHash!) : undefined,
									availableProfilePlugSet: socket.plugSources & SocketPlugSources.ProfilePlugSet ? useProfilePlugSet(socket.reusablePlugSetHash!) : undefined,
									availableInventoryPlugsSocketType: socket.plugSources & SocketPlugSources.InventorySourced ? useSocketType(socket.socketTypeHash) : undefined,
								}
								// availablePlugs: ([
								// 	plugs?.[i],
								// 	socket.plugSources & SocketPlugSources.CharacterPlugSet && characterPlugSets?.[socket.reusablePlugSetHash!],
								// 	socket.plugSources & SocketPlugSources.ProfilePlugSet && profilePlugSets?.[socket.reusablePlugSetHash!],
								// 	socket.plugSources & SocketPlugSources.ReusablePlugItems && socket.reusablePlugItems,
								// 	socket.plugSources & SocketPlugSources.InventorySourced && DestinySocketTypeDefinition[socket.socketTypeHash]?.plugWhitelist && (data.profileInventory?.data?.items
								// 		.filter(plug => {
								// 			if (plug.bucketHash !== InventoryBucketHashes.Modifications)
								// 				return false

								// 			const socketPlugWhitelist = DestinySocketTypeDefinition[socket.socketTypeHash].plugWhitelist
								// 			const plugDef = provider.item(plug.itemHash)
								// 			return !!plugDef?.plug
								// 				&& socketPlugWhitelist.some(wh => wh.categoryHash === plugDef.plug?.plugCategoryHash)
								// 		})
								// 		.map((plug): DestinyItemSocketEntryPlugItemDefinition => ({ plugItemHash: plug.itemHash }))
								// 	),
								// ]
								// 	.filter(Truthy)
								// 	.flat()
								// 	.distinct(i => i.plugItemHash)
								// ),
								// }
							}),
						}
					}

					return {
						...{ version },
						...provider,
						characters: characters.toObject(character => [character.characterId, {
							is: 'character',
							id: character.characterId,
							metadata: character,
							emblem: !character.emblemHash ? undefined : {
								hash: character.emblemHash,
								displayProperties: DeepsightEmblemDefinition[character.emblemHash].displayProperties,
								background: Colour.fromDestiny(DeepsightEmblemDefinition[character.emblemHash].backgroundColor),
								secondaryIcon: DeepsightEmblemDefinition[character.emblemHash].secondaryIcon,
								secondaryOverlay: DeepsightEmblemDefinition[character.emblemHash].secondaryOverlay,
								secondarySpecial: DeepsightEmblemDefinition[character.emblemHash].secondarySpecial,
							},
							equippedItems: ((data.characterEquipment?.data?.[character.characterId]?.items ?? [])
								.map(item => ItemInstance(item))
							),
							items: ((data.characterInventories?.data?.[character.characterId]?.items ?? [])
								.map(item => ItemInstance(item))
							),
							plugSets: characterPlugSets[character.characterId],
						} satisfies InventoryCharacter]),
						profileItems: data.profileInventory?.data?.items?.map(item => ItemInstance(item)) ?? [],
						profilePlugSets,
						socketTypes,
						classes: DestinyClassDefinition as Record<ClassHashes, DestinyClassDefinition>,
						buckets: DestinyInventoryBucketDefinition as Record<InventoryBucketHashes, DestinyInventoryBucketDefinition>,
					}
				})
			},
		}
	},
})
