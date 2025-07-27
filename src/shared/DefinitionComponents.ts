import type { AllDestinyManifestComponents, DestinyManifestComponentName } from 'bungie-api-ts/destiny2'
import type { ClarityDescription } from 'Clarity'
import type { DeepsightManifestComponentsMap } from 'deepsight.gg/Interfaces'

export type DeepsightManifestComponentName = keyof DeepsightManifestComponentsMap

export interface AllClarityManifestComponents {
	ClarityDescriptions: Record<number, ClarityDescription>
}

export type ClarityManifestComponentName = keyof AllClarityManifestComponents

export type AllComponentNames =
	| DestinyManifestComponentName
	| DeepsightManifestComponentName
	| ClarityManifestComponentName

export type DefinitionsForComponentName<NAME extends AllComponentNames> = (
	NAME extends DestinyManifestComponentName ? AllDestinyManifestComponents[NAME]
	: NAME extends DeepsightManifestComponentName ? DeepsightManifestComponentsMap[NAME]
	: NAME extends ClarityManifestComponentName ? AllClarityManifestComponents[NAME]
	: never
)
