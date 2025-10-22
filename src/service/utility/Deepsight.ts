import Env from 'utility/Env'

namespace Deepsight {

	const origin = 'https://definition.deepsight.gg'

	interface DeepsightResultPromise<T> extends Promise<T> {
		isLocal?: true
	}

	export function get<T> (url: string, skipLocal?: boolean): DeepsightResultPromise<T> {
		if (!url.startsWith('/')) url = `/${url}`
		return fetchTryLocalThenRemote(url, skipLocal) as DeepsightResultPromise<T>
	}

	function fetchTryLocalThenRemote (url: string, skipLocal = false) {
		const promise: DeepsightResultPromise<unknown> = (async () => {
			if (Env.LOCAL_DEEPSIGHT_MANIFEST_ORIGIN && !skipLocal) {
				const localResult = await self.fetch(`${Env.LOCAL_DEEPSIGHT_MANIFEST_ORIGIN}/definitions${url}`)
					.then(handleDeepsightResponse)
					.catch(() => null)
				if (localResult !== null) {
					// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
					promise!.isLocal = true
					return localResult
				}
			}

			return await self.fetch(`${origin}${url}`)
				.then(handleDeepsightResponse)
		})()
		return promise
	}

	async function handleDeepsightResponse<T> (response: Response) {
		return await (response.text())
			.then(text => {
				return JSON.parse(text) as T
			})
	}
}

export default Deepsight
