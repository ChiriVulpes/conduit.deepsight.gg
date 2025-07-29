/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
import type { Item, ItemPlug, ItemSocket, ItemStat } from '@shared/Collections'
import type { DestinyInventoryItemDefinition, DestinyItemComponent, DestinyItemSocketEntryDefinition, DestinySandboxPerkDefinition } from 'bungie-api-ts/destiny2/interfaces'
import { DestinyItemSubType, SocketPlugSources } from 'bungie-api-ts/destiny2/interfaces'
import type { DeepsightPlugCategorisation, DeepsightPlugCategory, DeepsightPlugCategoryName } from 'deepsight.gg/DeepsightPlugCategorisation'
import type { EquipableItemSetHashes, SandboxPerkHashes } from 'deepsight.gg/Enums'
import { ItemCategoryHashes, ItemTierTypeHashes, StatHashes } from 'deepsight.gg/Enums'
import Categorisation from 'model/Categorisation'
import Definitions from 'model/Definitions'
import DestinyProfiles from 'model/DestinyProfiles'
import Profiles from 'model/Profiles'
import { mutable } from 'utility/Objects'

export const ITEMS_VERSION = '5'

const STATS_ARMOUR = new Set<StatHashes>([
	StatHashes.Health,
	StatHashes.Melee4244567218,
	StatHashes.Grenade,
	StatHashes.Super,
	StatHashes.Class1943323491,
	StatHashes.Weapons,
])

namespace Items {
	export async function createResolver (type: 'instance' | 'collections') {
		const ClarityDescriptions = await Definitions.en.ClarityDescriptions.get()
		const DeepsightItemDamageTypesDefinition = await Definitions.en.DeepsightItemDamageTypesDefinition.get()
		const DeepsightPlugCategorisation = await Definitions.en.DeepsightPlugCategorisation.get()
		const DeepsightSocketCategorisation = await Definitions.en.DeepsightSocketCategorisation.get()
		const DeepsightSocketExtendedDefinition = await Definitions.en.DeepsightSocketExtendedDefinition.get()
		const DestinyInventoryItemDefinition = await Definitions.en.DestinyInventoryItemDefinition.get()
		const DestinyPlugSetDefinition = await Definitions.en.DestinyPlugSetDefinition.get()
		const DestinyStatDefinition = await Definitions.en.DestinyStatDefinition.get()
		const DestinyStatGroupDefinition = await Definitions.en.DestinyStatGroupDefinition.get()
		const DestinyEquipableItemSetDefinition = await Definitions.en.DestinyEquipableItemSetDefinition.get()
		const DestinySandboxPerkDefinition = await Definitions.en.DestinySandboxPerkDefinition.get()

		const profile = await Profiles.getCurrentProfile(undefined).then(profile => profile && DestinyProfiles[profile.id].get())

		const perks: Partial<Record<SandboxPerkHashes, DestinySandboxPerkDefinition>> = {}

		function item (hash: number, def: DestinyInventoryItemDefinition): Item {
			const sockets = def.sockets?.socketEntries.map((entryDef, i): ItemSocket => socket(hash, i, entryDef)) ?? []
			return {
				hash,
				displayProperties: def.displayProperties,
				watermark: def.iconWatermark,
				featuredWatermark: def.isFeaturedItem ? def.iconWatermarkFeatured : undefined,
				type: def.itemTypeDisplayName,
				rarity: def.inventory?.tierTypeHash ?? ItemTierTypeHashes.Common,
				class: def.classType,
				damageTypes: DeepsightItemDamageTypesDefinition[hash]?.damageTypes ?? def.damageTypeHashes,
				ammo: def.equippingBlock?.ammoType as Item['ammo'],
				sockets,
				statGroupHash: def.stats?.statGroupHash,
				stats: stats(def, undefined, sockets),
				itemSetHash: itemSetHash(def),
			}
		}

		function itemSetHash (def: DestinyInventoryItemDefinition): EquipableItemSetHashes | undefined {
			const hash = def.equippingBlock?.equipableItemSetHash as EquipableItemSetHashes | undefined
			if (!hash)
				return undefined

			const setDef = DestinyEquipableItemSetDefinition[hash]
			for (const perk of setDef?.setPerks ?? [])
				perks[perk.sandboxPerkHash as SandboxPerkHashes] = DestinySandboxPerkDefinition[perk.sandboxPerkHash]

			return hash
		}

		function socket (itemHash: number, socketIndex: number, entryDef: DestinyItemSocketEntryDefinition): ItemSocket {
			const categorisationFullName = DeepsightSocketCategorisation[itemHash]?.categorisation[socketIndex]?.fullName ?? 'None'

			if (!entryDef.plugSources)
				mutable(entryDef).plugSources = SocketPlugSources.ReusablePlugItems

			const plugHashes = Categorisation.IsShaderOrnament(categorisationFullName) ? []
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
				plugs: plugHashes.map(plug).filter(plug => plug !== undefined).map(plug => plug.hash),
			}
		}

		const plugs: Record<number, ItemPlug | undefined> = {}
		function plug (hash: number): ItemPlug | undefined {
			if (hash in plugs)
				return plugs[hash]

			const def = DestinyInventoryItemDefinition[hash]
			if (!def)
				return plugs[hash] = undefined

			const categorisation = DeepsightPlugCategorisation[hash]
			const perkHashes = def.perks.map(perk => perk.perkHash)
			for (const perkHash of perkHashes)
				perks[perkHash as SandboxPerkHashes] = DestinySandboxPerkDefinition[perkHash]

			return plugs[hash] = {
				hash,
				displayProperties: def.displayProperties,
				type: categorisation?.fullName ?? 'None',
				enhanced: Categorisation.IsEnhanced(categorisation?.fullName) ?? false,
				clarity: ClarityDescriptions[hash],
				perks: perkHashes,
			}
		}

		function socketedPlug (socket: ItemSocket): ItemPlug | undefined {
			return plugs[socket.defaultPlugHash!]
		}

		function socketedPlugDef (socket: ItemSocket): DestinyInventoryItemDefinition | undefined {
			const plug = socketedPlug(socket)
			return plug ? DestinyInventoryItemDefinition[plug.hash] : undefined
		}

		function plugCat<CATEGORY extends DeepsightPlugCategoryName> (hash: number | undefined, category: CATEGORY): DeepsightPlugCategorisation<typeof DeepsightPlugCategory[CATEGORY]> | undefined {
			if (!hash)
				return undefined

			const categorisation = DeepsightPlugCategorisation[hash]
			if (!categorisation || categorisation.categoryName !== category)
				return undefined

			return categorisation as DeepsightPlugCategorisation<typeof DeepsightPlugCategory[CATEGORY]>
		}

		const HasMasterworkStats = Categorisation.matcher('Masterwork/*', 'Intrinsic/FrameEnhanced')
		const NotMasterworkNotIntrinsic = Categorisation.matcher('!Intrinsic/*', '!Masterwork/*')
		const ArmorMod = Categorisation.matcher('Mod/Armor')
		function stats (def: DestinyInventoryItemDefinition, ref?: DestinyItemComponent, sockets: ItemSocket[] = []): Partial<Record<StatHashes, ItemStat>> | undefined {
			if (!def.stats)
				return undefined

			const statGroupDefinition = DestinyStatGroupDefinition[def.stats?.statGroupHash ?? NaN]

			const intrinsicStats = def.investmentStats

			const statRolls = sockets.filter(Categorisation.IsIntrinsic)
				.flatMap(socket => socketedPlugDef(socket)?.investmentStats ?? [])

			const instanceId = ref?.itemInstanceId
			const stats = profile?.itemComponents?.stats.data?.[instanceId!]?.stats ?? def.stats.stats
			if (stats)
				for (const random of statRolls)
					if (random && !random.isConditionallyActive)
						stats[random.statTypeHash] ??= { statHash: random.statTypeHash, value: random.value }

			for (const stat of statGroupDefinition.scaledStats)
				if (!(stat.statHash in stats) && !STATS_ARMOUR.has(stat.statHash))
					stats[stat.statHash] = { statHash: stat.statHash, value: 0 }

			const masterworkStats = type === 'collections' ? []
				: sockets.filter(HasMasterworkStats).flatMap(socket => socketedPlugDef(socket)?.investmentStats ?? [])

			const modStats = type === 'collections' ? []
				: sockets.filter(NotMasterworkNotIntrinsic).flatMap(socket => socketedPlugDef(socket)?.investmentStats ?? [])

			const chargeStats = type === 'collections' ? []
				: sockets.filter(ArmorMod).flatMap(socket => plugCat(socket.defaultPlugHash, 'Mod')?.armourChargeStats ?? [])

			const result: Partial<Record<StatHashes, ItemStat>> = {}
			if (stats) for (const [hashString, { value }] of Object.entries(stats)) {
				const hash = +hashString as StatHashes
				const statDefinition = DestinyStatDefinition[hash]
				if (!statDefinition) {
					console.warn('Unknown stat', hash, 'value', value)
					continue
				}

				const display = statGroupDefinition.scaledStats.find(stat => stat.statHash === hash)
				if (!display)
					continue

				const stat: ItemStat = result[hash] = {
					hash,
					value,
					max: hash === StatHashes.ChargeTime && def.itemSubType === DestinyItemSubType.FusionRifle ? 1000 : display?.maximumValue ?? 100,
					displayAsNumeric: display?.displayAsNumeric || undefined,
					intrinsic: 0,
					roll: 0,
					mod: 0,
					masterwork: 0,
					subclass: !def.itemCategoryHashes?.includes(ItemCategoryHashes.Subclasses) ? 0 : value,
					charge: 0,
				}

				function interpolate (value: number) {
					if (!display?.displayInterpolation.length)
						return value

					const start = display.displayInterpolation.findLast(stat => stat.value <= value) ?? display.displayInterpolation[0]
					const end = display.displayInterpolation.find(stat => stat.value > value) ?? display.displayInterpolation[display.displayInterpolation.length - 1]
					if (start === end)
						return start.weight

					const t = (value - start.value) / (end.value - start.value)
					return bankersRound(start.weight + t * (end.weight - start.weight))
				}

				for (const intrinsic of intrinsicStats)
					if (intrinsic?.statTypeHash === hash && !intrinsic.isConditionallyActive)
						stat.intrinsic += intrinsic.value

				for (const random of statRolls)
					if (hash === random?.statTypeHash && !random.isConditionallyActive)
						stat.roll += random.value

				for (const masterwork of masterworkStats)
					if (hash === masterwork.statTypeHash && !masterwork.isConditionallyActive)
						stat.masterwork += masterwork.value

				for (const mod of modStats)
					if (hash === mod?.statTypeHash && !mod.isConditionallyActive)
						stat.mod += mod.value

				let chargeCount = 0
				for (const mod of chargeStats)
					if (hash === mod?.statTypeHash)
						stat.charge = typeof mod.value === 'number' ? mod.value : mod.value[chargeCount++]

				const { intrinsic, roll, masterwork, mod } = stat
				stat.intrinsic = interpolate(intrinsic + roll)
				stat.roll = interpolate(roll)
				stat.mod = interpolate(intrinsic + roll + mod) - stat.intrinsic
				stat.masterwork = interpolate(intrinsic + roll + masterwork) - stat.intrinsic
			}

			return result
		}

		return {
			plugs: plugs as Record<number, ItemPlug>,
			perks,
			item (hash: number) {
				const def = DestinyInventoryItemDefinition[hash]
				if (!def)
					return undefined

				return item(hash, def)
			},
		}
	}

	/**
	 * Note: This implementation matches DIM's to ensure consistency between apps.  
	 * See: https://github.com/DestinyItemManager/DIM/blob/83ec236416fae879c09f4aa93be7d3be4843510d/src/app/inventory/store/stats.ts#L582-L585
	 * Also see: https://github.com/Bungie-net/api/issues/1029#issuecomment-531849137
	 */
	export function bankersRound (x: number) {
		const r = Math.round(x)
		return (x > 0 ? x : -x) % 1 === 0.5 ? (0 === r % 2 ? r : r - 1) : r
	}
}

export default Items
