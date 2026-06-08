import type { Character } from '@shared/Character'
import type { Profile, ProfileCharacter } from '@shared/Profile'
import type { BungieMembershipType } from 'bungie-api-ts/destiny2'
import { DestinyComponentType, type DestinyProfileResponse, type DestinyRecordDefinition } from 'bungie-api-ts/destiny2'
import type { GetGroupsForMemberResponse } from 'bungie-api-ts/groupv2'
import { GroupsForMemberFilter, GroupType } from 'bungie-api-ts/groupv2'
import type { UserMembershipData } from 'bungie-api-ts/user'
import { type UserInfoCard } from 'bungie-api-ts/user'
import type Auth from 'model/Auth'
import Definitions from 'model/Definitions'
import Broadcast from 'utility/Broadcast'
import Bungie from 'utility/Bungie'
import Colour from 'utility/Colour'
import { db } from 'utility/Database'
import Diff, { DiffableArray } from 'utility/Diff'
import Store from 'utility/Store'

namespace Profiles {

	const version = '10'
	const pendingProfileUpdates = new Map<string, Promise<unknown>>()

	export async function get () {
		let updated = false
		const profiles = await db.profiles.toArray()
		await Broadcast.operation('Updating player profiles', () =>
			Promise.all(profiles.map(async profile => {
				const thisProfileUpdated = await updateProfile(profile).catch(() => false)
				updated ||= thisProfileUpdated ?? false
			}))
		)
		return { profiles, updated }
	}

	export async function searchDestinyPlayerByBungieName (displayName: string, displayNameCode: number) {
		const profile = await db.profiles.get({ name: displayName, code: displayNameCode })
		if (profile) {
			await touchProfileAccess(profile)
			scheduleProfileUpdate(profile)
			return profile
		}

		return await Broadcast.operation('Searching Destiny players', () =>
			Bungie.post<UserInfoCard[]>('/Destiny2/SearchDestinyPlayerByBungieName/-1/', {
				displayName,
				displayNameCode,
			}).then(resolveProfile)
		)
	}

	export async function getCurrentProfile (auth: Auth | undefined) {
		if (!auth)
			return undefined

		return await Broadcast.operation('Updating your player profile', async () => {
			const cachedProfile = await getCurrentProfileFromCache(auth)
			if (cachedProfile) {
				await touchProfileAccess(cachedProfile)
				await updateAuthProfile(auth, cachedProfile)
				return cachedProfile
			}

			const profiles = await db.profiles.toArray()
			const userMembershipData = await Bungie.getForUser<UserMembershipData>('/User/GetMembershipsForCurrentUser/')
			if (!userMembershipData?.destinyMemberships?.length)
				return undefined

			let profile = profiles.find(profile => userMembershipData.destinyMemberships.some(membership => membership.membershipId === profile.id))
			if (profile) {
				await touchProfileAccess(profile)
				await updateAuthProfile(auth, profile)
				return profile
			}

			profile = await resolveProfile(userMembershipData.destinyMemberships)
			await updateAuthProfile(auth, profile)
			return profile
		})
	}

	async function getCurrentProfileFromCache (auth: Auth): Promise<Profile | undefined> {
		if (auth.profileId) {
			const profile = await db.profiles.get(auth.profileId)
			if (profile && (!auth.profileType || profile.type === auth.profileType))
				return profile
		}

		if (auth.displayName !== undefined && auth.displayNameCode !== undefined)
			return await db.profiles.get({ name: auth.displayName, code: auth.displayNameCode })

		return undefined
	}

	async function touchProfileAccess (profile: Profile) {
		profile.lastAccess = new Date().toISOString()
		await db.profiles.put(profile)
	}

	function scheduleProfileUpdate (profile: Profile) {
		if (pendingProfileUpdates.has(profile.id))
			return

		const updatePromise = new Promise<void>(resolve => setTimeout(resolve))
			.then(() => Broadcast.operation('Updating player profiles', () => updateProfile(profile)))
			.catch(console.error)
			.finally(() => pendingProfileUpdates.delete(profile.id))
		pendingProfileUpdates.set(profile.id, updatePromise)
	}

	async function updateAuthProfile (auth: Auth, profile?: Profile) {
		if (!profile)
			return

		if (
			auth.displayName === profile.name
			&& auth.displayNameCode === profile.code
			&& auth.profileId === profile.id
			&& auth.profileType === profile.type
		)
			return

		auth.displayName = profile.name
		auth.displayNameCode = profile.code
		auth.profileId = profile.id
		auth.profileType = profile.type
		await Store.auth.set(auth)
	}

	async function resolveProfile<CARD extends UserInfoCard = UserInfoCard> (memberships: CARD[]): Promise<Profile | undefined> {
		const preferredMembership = !memberships[0].crossSaveOverride
			? undefined
			: memberships.find(membership => membership.membershipType === memberships[0].crossSaveOverride)

		const membershipCheckOrder = memberships.toSorted((a, b) => +(b === preferredMembership) - +(a === preferredMembership))
		for (const card of membershipCheckOrder) {
			const destinyProfile = await getDestinyProfile(card.membershipType, card.membershipId)
			if (destinyProfile) {
				const profile: Profile = {
					id: card.membershipId,
					type: card.membershipType,
					name: card.bungieGlobalDisplayName,
					code: card.bungieGlobalDisplayNameCode,
					characters: [],
					power: 0,
					lastUpdate: new Date(0).toISOString(),
					lastAccess: new Date().toISOString(),
					version,
				}
				await updateProfile(profile, undefined, destinyProfile)
				return profile
			}
		}

		return undefined
	}

	async function getDestinyProfile (membershipType: BungieMembershipType, membershipId: string) {
		const components = [DestinyComponentType.Profiles, DestinyComponentType.Characters]
		return Bungie.getForUser<Partial<DestinyProfileResponse>>(`/Destiny2/${membershipType}/Profile/${membershipId}/?components=${components.join(',')}`)
			.catch(() => undefined)
	}

	async function updateProfile (profile: Profile, access?: true, destinyProfile?: Partial<DestinyProfileResponse>) {
		if (!access && profile.version === version && Date.now() - new Date(profile.lastUpdate).getTime() < 1000 * 60 * 60) // 1 hour
			return

		let updated = false

		if (profile.version !== version) {
			updated = true
			profile.version = version
		}

		const clan = await getUserClan(profile)
		if (clan !== undefined && clan?.clanInfo) {
			updated = true
			profile.clan = !clan ? undefined : {
				name: clan.name,
				callsign: clan.clanInfo.clanCallsign,
			}
		}

		destinyProfile ??= await getDestinyProfile(profile.type, profile.id)

		const guardianRank = destinyProfile?.profile?.data?.currentGuardianRank
		if (guardianRank !== undefined && profile.guardianRank?.rank !== guardianRank) {
			updated = true
			const DestinyGuardianRankDefinition = await Definitions.en.DestinyGuardianRankDefinition.get()
			profile.guardianRank = {
				rank: guardianRank,
				name: DestinyGuardianRankDefinition[guardianRank]?.displayProperties.name,
			}
		}

		if (destinyProfile?.characters) {
			updated = true
			const [emblems, DestinyRecordDefinition] = await Promise.all([
				Definitions.en.DeepsightEmblemDefinition.get(),
				Definitions.en.DestinyRecordDefinition.get(),
			])

			const newChars = Object.values(destinyProfile.characters.data ?? {})
				.map((character): ProfileCharacter => ({
					is: 'character',
					id: character.characterId,
					metadata: character,
					title: characterTitle(character, DestinyRecordDefinition),
					emblem: !character.emblemHash ? undefined : {
						hash: character.emblemHash,
						displayProperties: emblems[character.emblemHash].displayProperties,
						background: Colour.fromDestiny(emblems[character.emblemHash].backgroundColor),
						secondaryIcon: emblems[character.emblemHash].secondaryIcon,
						secondaryOverlay: emblems[character.emblemHash].secondaryOverlay,
						secondarySpecial: emblems[character.emblemHash].secondarySpecial,
					},
					lastPlayed: new Date(character.dateLastPlayed).toISOString(),
				}))

			const DiffableCharacters = (characters: Character[]) => DiffableArray.makeDeep(
				(characters
					.sort((a, b) => a.id.localeCompare(b.id))
				),
				(a, b) => a.id === b.id,
				character => {
					DiffableArray.make(character.emblem?.displayProperties.iconSequences, (a, b) => !Diff.get(a, b).length)
				},
			)

			const oldDiffChars = DiffableCharacters(profile.characters)
			const newDiffChars = DiffableCharacters(newChars)

			if (Diff.get(oldDiffChars, newDiffChars).length) {
				profile.characters = newChars.sort((a, b) => b.lastPlayed.localeCompare(a.lastPlayed))
				profile.classType = profile.characters[0]?.metadata.classType
				profile.emblem = profile.characters[0]?.emblem
				profile.power = profile.characters[0]?.metadata.light ?? 0
			}
		}

		if (access)
			profile.lastAccess = new Date().toISOString()

		if (updated)
			profile.lastUpdate = new Date().toISOString()

		if (updated || access) {
			await db.profiles.put(profile)
			return true
		}

		return false
	}

	async function getUserClan (profile: Profile) {
		return Bungie.get<GetGroupsForMemberResponse>(`/GroupV2/User/${profile.type}/${profile.id}/${GroupsForMemberFilter.All}/${GroupType.Clan}/`)
			.then(response => response?.results?.at(0)?.group ?? null)
			.catch(() => undefined)
	}

}

function characterTitle (character: { titleRecordHash?: number, genderHash: number }, DestinyRecordDefinition: Record<number, DestinyRecordDefinition>) {
	if (character.titleRecordHash === undefined)
		return undefined

	return DestinyRecordDefinition[character.titleRecordHash]?.titleInfo.titlesByGenderHash[character.genderHash]
}

export default Profiles
