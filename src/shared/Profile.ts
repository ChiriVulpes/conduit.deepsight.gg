import type { BungieMembershipType, DestinyClass, DestinyDisplayPropertiesDefinition } from 'bungie-api-ts/destiny2'

export interface Profile {
	id: string
	type: BungieMembershipType
	name: string
	code?: number

	authed?: true

	guardianRank?: ProfileGuardianRank
	power: number
	characters: ProfileCharacter[]
	emblem?: ProfileEmblem
	classType?: DestinyClass
	clan?: ProfileClan

	lastUpdate: string
	lastAccess: string
	version: string
}

export interface ProfileCharacter {
	id: string
	classType: DestinyClass
	emblem?: ProfileEmblem
	power: number
	lastPlayed: string
}

export interface ProfileEmblem {
	hash: number
	displayProperties: DestinyDisplayPropertiesDefinition
	background: number
	secondaryIcon: string
	secondaryOverlay: string
	secondarySpecial: string
}

export interface ProfileClan {
	name: string
	callsign: string
}

export interface ProfileGuardianRank {
	rank: number
	name: string
}
