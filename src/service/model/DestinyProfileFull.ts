import type { Profile } from '@shared/Profile'
import type { DestinyProfileResponse } from 'bungie-api-ts/destiny2'
import { DESTINY_PROFILE_CACHE_COMPONENTS } from 'model/DestinyProfileComponents'
import { ProfiledModel } from 'model/ProfiledModel'
import Broadcast from 'utility/Broadcast'
import Bungie from 'utility/Bungie'
import { db } from 'utility/Database'

export interface DestinyProfileFull extends
	Partial<Omit<DestinyProfileResponse, 'responseMintedTimestamp' | 'secondaryComponentsMintedTimestamp'>>,
	Pick<DestinyProfileResponse, 'responseMintedTimestamp' | 'secondaryComponentsMintedTimestamp'>,
	Object { }

export function fullProfileCacheKey (profile: Profile) {
	return `destiny2/profile-full:${profile.type}/${profile.id}`
}

export async function getCachedFullProfile (profile: Profile): Promise<DestinyProfileFull | undefined> {
	return await db.data.get(fullProfileCacheKey(profile)).then(data => data?.data as DestinyProfileFull | undefined)
}

export default ProfiledModel<DestinyProfileFull | undefined>('destiny2/profile-full', {
	cacheDirtyTime: 1000 * 60 * 60,
	async fetch (profile) {
		const profileResponse = profile && await Broadcast.operation('Fetching Destiny profile', () =>
			Bungie.getForUser<DestinyProfileFull>(`/Destiny2/${profile.type}/Profile/${profile.id}/`, {
				components: DESTINY_PROFILE_CACHE_COMPONENTS,
			})
		)
		return {
			version: profileResponse?.responseMintedTimestamp ?? 'n/a',
			value: profileResponse,
		}
	},
})
