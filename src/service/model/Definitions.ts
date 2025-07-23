import type { AllComponentNames, DefinitionsForComponentName } from '@shared/DefinitionComponents'
import DeepsightManifest from 'model/DeepsightManifest'
import DestinyManifest from 'model/DestinyManifest'
import Model from 'model/Model'
import Deepsight from 'utility/Deepsight'

type Definitions = {
	[NAME in AllComponentNames]: Model<DefinitionsForComponentName<NAME>>
}

const Definitions = new Proxy({} as Record<string, Definitions>, {
	get (target: Record<string, Definitions>, language: string) {
		return target[language] ??= new Proxy({} as Definitions, {
			get<NAME extends AllComponentNames> (target: { [K in NAME]: Model<DefinitionsForComponentName<NAME>> }, componentName: NAME): Model<DefinitionsForComponentName<NAME>> {
				const prefix = componentName.startsWith('Destiny') ? 'destiny2'
					: componentName.startsWith('Deepsight') ? 'deepsight'
						: null
				if (!prefix)
					throw new Error(`Unsupported component name: ${componentName}`)

				const componentLanguage = prefix === 'deepsight' ? 'en' : language

				return target[componentName] ??= Model<DefinitionsForComponentName<NAME>>(`${prefix}/${componentName}/${componentLanguage}`, {
					cacheDirtyTime: 1000 * 60 * 1, // 1 minute cache time (shorter due to first getting the current version from the whole manifest)
					async fetch () {
						switch (prefix) {

							case 'destiny2': {
								const manifest = await DestinyManifest.use()
								return {
									version: manifest.version,
									value: async () => {
										const componentURI = manifest.value[componentLanguage][componentName]
										return fetch(`https://www.bungie.net${componentURI}`)
											.then(response => response.json()) as Promise<DefinitionsForComponentName<NAME>>
									},
								}
							}

							case 'deepsight': {
								const manifest = await DeepsightManifest.use()
								return {
									version: `${(manifest.value as any as Record<string, number>)[componentName]}`,
									value: async () => await Deepsight.get<DefinitionsForComponentName<NAME>>(`/${componentName}.json`),
								}
							}

							default:
								throw new Error('This is impossible')
						}
					},
				})
			},
		}) as never
	},
})

export default Definitions
