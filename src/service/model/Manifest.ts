import Auth from 'model/Auth'
import Model from 'model/Model'

interface Manifest {
	Response: {
		version: string
		jsonWorldComponentContentPaths: Record<string, Record<string, string>>
	}
}

export default Model('manifest', {
	cacheDirtyTime: 1000 * 60 * 60, // 1 hour cache time
	async fetch () {
		const manifest = await fetch('https://www.bungie.net/Platform/Destiny2/Manifest/', {
			headers: { 'X-API-Key': await Auth.getAPIKey() },
		}).then(response => response.json()) as Manifest
		if (typeof manifest?.Response?.version !== 'string')
			throw new Error('Invalid Destiny manifest response')

		return {
			version: manifest.Response.version,
			value: manifest.Response.jsonWorldComponentContentPaths,
		}
	},
})
