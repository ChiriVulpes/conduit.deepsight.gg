import ClarityManifest from 'model/ClarityManifest'
import DeepsightManifest from 'model/DeepsightManifest'
import DestinyManifest from 'model/DestinyManifest'
import Model from 'model/Model'

export default Model<string>('CombinedManifestVersion', {
	cacheDirtyTime: 1000 * 60 * 1, // 1 minute cache
	async fetch () {
		const [destiny, deepsight, clarity] = await Promise.all([
			DestinyManifest.use(),
			DeepsightManifest.use(),
			ClarityManifest.use(),
		])

		const version = `destiny:${destiny.version} deepsight:${deepsight.version} clarity:${clarity.version}`
		return {
			version,
			value: version,
		}
	},
})
