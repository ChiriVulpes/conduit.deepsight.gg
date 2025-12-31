import type { DestinyManifest } from 'bungie-api-ts/destiny2'
import Model from 'model/Model'
import Broadcast from 'utility/Broadcast'
import Bungie from 'utility/Bungie'

export default Model('DestinyManifest', {
	cacheDirtyTime: 1000 * 60 * 60, // 1 hour cache time
	async fetch () {
		const manifest = await Broadcast.operation('Checking for new definitions', () =>
			Bungie.get<DestinyManifest>('/Destiny2/Manifest/', undefined, { cache: 'reload' })
		)
		if (typeof manifest?.version !== 'string')
			throw new Error('Invalid Destiny manifest response')

		return {
			version: manifest.version,
			value: manifest.jsonWorldComponentContentPaths,
		}
	},
})
