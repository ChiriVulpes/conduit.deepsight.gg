import Network from 'utility/Network'

namespace Popularityreport {

	const origin = 'https://definition.deepsight.gg'

	export async function get<T> (url: string) {
		return getText(url)
			.then(handlePopularityreportResponse) as Promise<T>
	}

	export async function getText (url: string) {
		if (!url.startsWith('/')) url = `/${url}`
		return Network.fetch(`${origin}${url}`)
			.then(response => response.text())
	}

	function handlePopularityreportResponse<T> (text: string) {
		return JSON.parse(text) as T
	}

}

export default Popularityreport
