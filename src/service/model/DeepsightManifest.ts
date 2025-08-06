import type { DeepsightManifest } from 'deepsight.gg'
import Model from 'model/Model'
import Deepsight from 'utility/Deepsight'

export default Model('DeepsightManifest', {
	cacheDirtyTime: 1000 * 60 * 1, // 1 minute cache time
	async fetch () {
		const manifest = await Deepsight.get<DeepsightManifest>('/versions.json')
		if (typeof manifest?.deepsight !== 'number')
			throw new Error('Invalid Destiny manifest response')

		return {
			version: `${manifest.deepsight}`,
			value: manifest,
		}
	},
})
