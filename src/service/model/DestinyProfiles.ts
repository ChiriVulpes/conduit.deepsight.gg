// import type { Profile } from '@shared/Profile'
import type { DestinyProfileResponse } from 'bungie-api-ts/destiny2'
import Model from 'model/Model'
import Bungie from 'utility/Bungie'

interface DestinyProfileResponsePartial extends
	Partial<Omit<DestinyProfileResponse, 'responseMintedTimestamp' | 'secondaryComponentsMintedTimestamp'>>,
	Pick<DestinyProfileResponse, 'responseMintedTimestamp' | 'secondaryComponentsMintedTimestamp'> { }

type DestinyProfiles = Record<string, Model<DestinyProfileResponsePartial>>

const DestinyProfiles = new Proxy({} as DestinyProfiles, {
	get (target: DestinyProfiles, membershipTypeAndId: string) {
		const [membershipType, membershipId] = membershipTypeAndId.split('/')
		return target[membershipTypeAndId] ??= Model<DestinyProfileResponsePartial>(`destiny2/profile/${membershipType}/${membershipId}`, {
			cacheDirtyTime: 1000 * 30, // 30 second cache time
			async fetch () {
				const profileResponse = await Bungie.getForUser<DestinyProfileResponsePartial>(`/Destiny2/${membershipType}/Profile/${membershipId}/`)
				return {
					version: profileResponse.responseMintedTimestamp,
					value: async () => {
						return {} as never
						// const componentURI = manifest.value[language][componentName]
						// return fetch(`https://www.bungie.net${componentURI}`)
						// 	.then(response => response.json()) as Promise<AllDestinyManifestComponents[NAME]>
					},
				}
			},
		})
	},
})

export default DestinyProfiles
