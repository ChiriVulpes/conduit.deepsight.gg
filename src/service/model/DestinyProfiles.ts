import { DestinyComponentType, type DestinyProfileResponse } from 'bungie-api-ts/destiny2'
import { ProfiledModel } from 'model/ProfiledModel'
import Bungie from 'utility/Bungie'

export interface DestinyProfile extends
	Partial<Omit<DestinyProfileResponse, 'responseMintedTimestamp' | 'secondaryComponentsMintedTimestamp'>>,
	Pick<DestinyProfileResponse, 'responseMintedTimestamp' | 'secondaryComponentsMintedTimestamp'>,
	Object { }

export default ProfiledModel<DestinyProfile | undefined>('destiny2/profile', {
	cacheDirtyTime: 1000 * 30, // 30 second cache time
	async fetch (profile) {
		const profileResponse = profile && await Bungie.getForUser<DestinyProfile>(`/Destiny2/${profile.type}/Profile/${profile.id}/`, {
			components: [
				DestinyComponentType.Profiles,

				// Characters
				DestinyComponentType.Characters,
				DestinyComponentType.ProfileProgression,
				DestinyComponentType.CharacterLoadouts,

				// Items
				DestinyComponentType.CharacterInventories,
				DestinyComponentType.CharacterEquipment,
				DestinyComponentType.ProfileInventories,
				DestinyComponentType.ItemInstances,
				DestinyComponentType.ItemPlugObjectives,
				DestinyComponentType.ItemStats,
				DestinyComponentType.Records,
				DestinyComponentType.ItemSockets,
				DestinyComponentType.ItemReusablePlugs,
				DestinyComponentType.ItemPlugStates,
				DestinyComponentType.ItemPerks,
				DestinyComponentType.CharacterProgressions,

				// Collections
				DestinyComponentType.Collectibles,
				DestinyComponentType.CharacterActivities, // displaying whether items are currently obtainable

				// Misc
				DestinyComponentType.StringVariables,
			].join(','),
		})
		return {
			version: profileResponse?.responseMintedTimestamp ?? 'n/a',
			value: profileResponse,
		}
	},
})
