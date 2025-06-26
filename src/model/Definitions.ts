import type { AllDestinyManifestComponents, DestinyManifestComponentName } from 'bungie-api-ts/destiny2'
import Manifest from 'model/Manifest'
import Model from 'model/Model'

type Definitions = {
	[NAME in DestinyManifestComponentName]: Record<string, Model<AllDestinyManifestComponents[NAME]>>
}

const Definitions = new Proxy({} as Definitions, {
	get<NAME extends DestinyManifestComponentName> (target: Definitions, componentName: NAME) {
		return target[componentName] ??= new Proxy({} as Record<string, Model<AllDestinyManifestComponents[NAME]>>, {
			get (target, language: string) {
				return target[language] ??= Model<AllDestinyManifestComponents[NAME]>(`destiny2/${componentName}/${language}`, {
					cacheDirtyTime: 1000 * 60 * 1, // 1 minute cache time (shorter due to first getting the current version from the whole manifest)
					async fetch () {
						const manifest = await Manifest.use()
						return {
							version: manifest.version,
							value: async () => {
								const componentURI = manifest.value[language][componentName]
								return fetch(`https://www.bungie.net${componentURI}`)
									.then(response => response.json()) as Promise<AllDestinyManifestComponents[NAME]>
							},
						}
					},
				})
			},
		}) as never
	},
})

export default Definitions
