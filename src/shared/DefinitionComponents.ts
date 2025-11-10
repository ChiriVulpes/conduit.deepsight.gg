import type { AllDestinyManifestComponents, DestinyManifestComponentName } from 'bungie-api-ts/destiny2'
import type { ClarityDescription } from 'Clarity'
import type { DeepsightDefinitionLinkDefinition, DeepsightEnumDefinition, DeepsightEnumLinkDefinition, DeepsightManifestComponentsMap } from 'deepsight.gg/Interfaces'

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

export type AllDefinitions = { [NAME in AllComponentNames]: DefinitionsForComponentName<NAME> }

export interface DefinitionsFilter {
	nameContainsOrHashIs?: string | string[]
	deepContains?: string | string[]
	jsonPathExpression?: string | string[]
	/** @deprecated This is only available when the client page has been granted permission by the user. When no permission is granted, it does nothing. */
	evalExpression?: string
}

export interface DefinitionsPage<DEFINITION> {
	definitions: Record<string | number, DEFINITION>
	page: number
	pageSize: number
	totalPages: number
	totalDefinitions: number
}

export interface DefinitionReferencesPage {
	references: AllDefinitions
	page: number
	pageSize: number
	totalPages: number
	totalReferences: number
}

export interface DefinitionLinks {
	augmentations?: Partial<{ [NAME in AllComponentNames]: DefinitionsForComponentName<NAME> extends infer D ? D[keyof D] : never }>
	links?: (DeepsightDefinitionLinkDefinition | DeepsightEnumLinkDefinition)[]
	definitions?: Partial<{ [NAME in AllComponentNames]: DefinitionsForComponentName<NAME> }>
	enums?: Partial<Record<string, DeepsightEnumDefinition>>
}

export interface DefinitionWithLinks<DEFINITION> {
	definition: DEFINITION
	links?: DefinitionLinks
}
