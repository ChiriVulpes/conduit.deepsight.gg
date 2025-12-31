import type { AllComponentNames, DefinitionsForComponentName } from '@shared/DefinitionComponents'
import ClarityManifest from 'model/ClarityManifest'
import DeepsightManifest from 'model/DeepsightManifest'
import DestinyManifest from 'model/DestinyManifest'
import Model from 'model/Model'
import Broadcast from 'utility/Broadcast'
import Clarity from 'utility/Clarity'
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
						: componentName.startsWith('Clarity') ? 'clarity'
							: null
				if (!prefix)
					throw new Error(`Unsupported component name: ${componentName}`)

				const componentLanguage = prefix === 'deepsight' || prefix === 'clarity' ? 'en' : language

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
										return Broadcast.operation('Downloading definitions', () =>
											fetch(`https://www.bungie.net${componentURI}`)
												.then(response => response.json()) as Promise<DefinitionsForComponentName<NAME>>
										)
									},
								}
							}

							case 'deepsight': {
								const manifest = await DeepsightManifest.use()
								return {
									version: `${(manifest.value.manifest as any as Record<string, number>)[componentName]}`,
									value: async () => await Broadcast.operation('Downloading definitions', () =>
										Deepsight.get<DefinitionsForComponentName<NAME>>(`/${componentName}.json`, !manifest.value.isLocal)
									),
								}
							}

							case 'clarity': {
								const manifest = await ClarityManifest.use()
								const filename = componentName === 'ClarityDescriptions' ? '/descriptions/clarity.json'
									: undefined
								if (!filename)
									throw new Error(`Unsupported Clarity component name: ${componentName}`)

								return {
									version: manifest.version,
									value: async () => await Broadcast.operation('Downloading definitions', () =>
										Clarity.get<DefinitionsForComponentName<NAME>>(filename)
									),
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
