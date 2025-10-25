import type { AllComponentNames, DeepsightManifestComponentName } from '@shared/DefinitionComponents'
import type { AllDestinyManifestComponents } from 'bungie-api-ts/destiny2'
import DeepsightManifest from 'model/DeepsightManifest'
import DestinyManifest from 'model/DestinyManifest'
import Model from 'model/Model'

export default Model<AllComponentNames[]>('DefinitionsComponentNames', {
	cacheDirtyTime: 1000 * 60 * 1, // 1 minute cache
	async fetch () {
		const [
			destiny,
			deepsight,
			// clarity,
		] = await Promise.all([
			DestinyManifest.use(),
			DeepsightManifest.use(),
			// ClarityManifest.use(),
		])

		const version = `destiny:${destiny.version} deepsight:${deepsight.version} clarity:${/* clarity.version */'N/A'}`
		return {
			version,
			value: [
				...Object.keys(destiny.value.en) as (keyof AllDestinyManifestComponents)[],
				...((Object.keys(deepsight.value.manifest) as (keyof DeepsightManifest | DeepsightManifestComponentName)[])
					.filter((name): name is DeepsightManifestComponentName => name.startsWith('Deepsight'))
				),
				'ClarityDescriptions',
			],
		}
	},
})
