import type { DestinyManifest } from 'bungie-api-ts/destiny2'
import Model from 'model/Model'
import Bungie from 'utility/Bungie'

export default Model('DestinyManifest', {
	cacheDirtyTime: 1000 * 60 * 60, // 1 hour cache time
	async fetch () {
		const manifest = await Bungie.get<DestinyManifest>(`/Destiny2/Manifest/?_=${Math.random().toString(36).slice(2)}`)
		if (typeof manifest?.version !== 'string')
			throw new Error('Invalid Destiny manifest response')

		return {
			version: manifest.version,
			value: manifest.jsonWorldComponentContentPaths,
		}
	},
})
