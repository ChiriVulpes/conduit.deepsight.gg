namespace Clarity {

	const origin = 'https://database-clarity.github.io/Live-Clarity-Database'

	export async function get<T> (url: string) {
		if (!url.startsWith('/')) url = `/${url}`
		return self.fetch(`${origin}${url}`)
			.then(handleClarityResponse) as Promise<T>
	}

	async function handleClarityResponse<T> (response: Response) {
		return await (response.text())
			.then(text => {
				return JSON.parse(text) as T
			})
	}
}

export default Clarity
