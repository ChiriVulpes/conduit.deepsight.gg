namespace Deepsight {

	const origin = 'https://deepsight.gg/manifest'

	export async function get<T> (url: string) {
		if (!url.startsWith('/')) url = `/${url}`
		return self.fetch(`${origin}${url}`)
			.then(handleDeepsightResponse) as Promise<T>
	}

	async function handleDeepsightResponse<T> (response: Response) {
		return await (response.text())
			.then(text => {
				return JSON.parse(text) as T
			})
	}
}

export default Deepsight
