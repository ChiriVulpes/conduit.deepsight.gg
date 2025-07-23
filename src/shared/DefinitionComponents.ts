import type { AllDestinyManifestComponents, DestinyManifestComponentName } from 'bungie-api-ts/destiny2'
import type { DeepsightPlugCategorisation, DeepsightSocketCategorisationDefinition } from 'deepsight.gg/DeepsightPlugCategorisation'
import type { DeepsightAdeptDefinition, DeepsightBreakerTypeDefinition, DeepsightCollectionsDefinitionManifest, DeepsightDropTableDefinition, DeepsightEmblemDefinition, DeepsightMomentDefinition, DeepsightSocketExtendedDefinition, DeepsightStats, DeepsightTierTypeDefinition, DeepsightWallpaperDefinition } from 'deepsight.gg/Interfaces'

export interface AllDeepsightManifestComponents {
	DeepsightPlugCategorisation: Record<number, DeepsightPlugCategorisation>
	DeepsightSocketCategorisation: Record<number, DeepsightSocketCategorisationDefinition>
	DeepsightMomentDefinition: Record<number, DeepsightMomentDefinition>
	DeepsightDropTableDefinition: Record<number, DeepsightDropTableDefinition>
	DeepsightTierTypeDefinition: Record<number, DeepsightTierTypeDefinition>
	DeepsightCollectionsDefinition: DeepsightCollectionsDefinitionManifest
	DeepsightAdeptDefinition: Record<number, DeepsightAdeptDefinition>
	DeepsightSocketExtendedDefinition: Record<number, DeepsightSocketExtendedDefinition>
	DeepsightBreakerTypeDefinition: Record<number, DeepsightBreakerTypeDefinition>
	DeepsightEmblemDefinition: Record<number, DeepsightEmblemDefinition>
	DeepsightStats: Record<number, DeepsightStats>
	DeepsightWallpaperDefinition: Record<number, DeepsightWallpaperDefinition>
}

export type DeepsightManifestComponentName = keyof AllDeepsightManifestComponents

export type AllComponentNames =
	| DestinyManifestComponentName
	| DeepsightManifestComponentName

export type DefinitionsForComponentName<NAME extends AllComponentNames> = (
	NAME extends DestinyManifestComponentName ? AllDestinyManifestComponents[NAME]
	: NAME extends DeepsightManifestComponentName ? AllDeepsightManifestComponents[NAME]
	: never
)
