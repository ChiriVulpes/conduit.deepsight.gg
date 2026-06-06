import type { DestinyCharacterComponent, DestinyDisplayPropertiesDefinition } from 'bungie-api-ts/destiny2'

export interface Character {
	is: 'character'
	id: string
	metadata: DestinyCharacterComponent
	emblem?: Emblem
	title?: string
}

export interface Emblem {
	hash: number
	displayProperties: DestinyDisplayPropertiesDefinition
	background: number
	secondaryIcon: string
	secondaryOverlay: string
	secondarySpecial: string
}
