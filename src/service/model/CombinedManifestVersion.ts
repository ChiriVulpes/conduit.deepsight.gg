import ClarityManifest from 'model/ClarityManifest'
import DeepsightManifest from 'model/DeepsightManifest'
import DestinyManifest from 'model/DestinyManifest'
import Model from 'model/Model'

export async function getVersions (hard?: true) {
	const [destiny, deepsight, clarity] = await Promise.all([
		DestinyManifest.use(hard),
		DeepsightManifest.use(hard),
		ClarityManifest.use(hard),
	])

	if (hard)
		// trigger a hard update of CombinedManifestVersion, which will be a soft update of its dependencies
		void CombinedManifestVersion.use(hard).catch(() => { })

	return {
		combined: `destiny:${destiny.version} deepsight:${deepsight.version} clarity:${clarity.version}`,
		destiny: destiny.version,
		deepsight: deepsight.version,
		clarity: clarity.version,
		updated: destiny.updated || deepsight.updated || clarity.updated,
	}
}

const CombinedManifestVersion = Model<string>('CombinedManifestVersion', {
	cacheDirtyTime: 1000 * 60 * 1, // 1 minute cache
	async fetch () {
		const versions = await getVersions()
		const version = versions.combined
		return {
			version,
			value: version,
		}
	},
})

export default CombinedManifestVersion
