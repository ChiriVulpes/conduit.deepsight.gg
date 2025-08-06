import Env from 'utility/Env'

namespace Deepsight {

	const origin = 'https://deepsight.gg/manifest'

	export async function get<T> (url: string) {
		if (!url.startsWith('/')) url = `/${url}`
		return fetchTryLocalThenRemote(url) as Promise<T>
	}

	async function fetchTryLocalThenRemote (url: string) {
		if (Env.LOCAL_DEEPSIGHT_MANIFEST_ORIGIN) {
			const localResult = await self.fetch(`${Env.LOCAL_DEEPSIGHT_MANIFEST_ORIGIN}/manifest${url}`)
				.then(handleDeepsightResponse)
				.catch(() => null)
			if (localResult !== null)
				return localResult
		}

		return await self.fetch(`${origin}${url}`)
			.then(handleDeepsightResponse)
	}

	async function handleDeepsightResponse<T> (response: Response) {
		return await (response.text())
			.then(text => {
				return JSON.parse(text) as T
			})
	}
}

export default Deepsight
