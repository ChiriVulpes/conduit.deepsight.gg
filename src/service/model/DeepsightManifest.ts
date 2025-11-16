import type { DeepsightManifest } from 'deepsight.gg'
import Model from 'model/Model'
import Deepsight from 'utility/Deepsight'

const DeepsightManifest = Model('DeepsightManifest', {
	cacheDirtyTime: 1000 * 60 * 1, // 1 minute cache time
	async fetch () {
		const manifestPromise = Deepsight.get<DeepsightManifest>(`/manifest.json?_=${Math.random().toString(36).slice(2)}`)
		const manifest = await manifestPromise
		if (typeof manifest?.deepsight !== 'number')
			throw new Error('Invalid Destiny manifest response')

		return {
			version: `${manifest.deepsight}`,
			value: { manifest, isLocal: manifestPromise.isLocal },
		}
	},
})

export default DeepsightManifest
