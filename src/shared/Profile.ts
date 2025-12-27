import type { BungieMembershipType, DestinyClass } from 'bungie-api-ts/destiny2'
import type { Character, Emblem } from 'Character'

export interface Profile {
	id: string
	type: BungieMembershipType
	name: string
	code?: number

	authed?: true

	guardianRank?: ProfileGuardianRank
	power: number
	characters: ProfileCharacter[]
	emblem?: Emblem
	classType?: DestinyClass
	clan?: ProfileClan

	lastUpdate: string
	lastAccess: string
	version: string
}

export interface ProfileCharacter extends Character {
	lastPlayed: string
}

export interface ProfileClan {
	name: string
	callsign: string
}

export interface ProfileGuardianRank {
	rank: number
	name: string
}
