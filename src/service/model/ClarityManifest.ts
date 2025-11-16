import Model from 'model/Model'
import Clarity from 'utility/Clarity'

interface ClarityManifest {
	descriptions: number
}

export default Model('ClarityManifest', {
	cacheDirtyTime: 1000 * 60 * 60, // 1 hour cache time
	async fetch () {
		const manifest = await Clarity.get<ClarityManifest>(`/versions.json?_=${Math.random().toString(36).slice(2)}`)
		if (typeof manifest?.descriptions !== 'number')
			throw new Error('Invalid Destiny manifest response')

		return {
			version: `${manifest.descriptions}`,
			value: manifest,
		}
	},
})
