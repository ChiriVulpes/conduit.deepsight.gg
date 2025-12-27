import type { DestinyCharacterComponent, DestinyDisplayPropertiesDefinition } from 'bungie-api-ts/destiny2'

export interface Character {
	id: string
	metadata: DestinyCharacterComponent
	emblem?: Emblem
}

export interface Emblem {
	hash: number
	displayProperties: DestinyDisplayPropertiesDefinition
	background: number
	secondaryIcon: string
	secondaryOverlay: string
	secondarySpecial: string
}
