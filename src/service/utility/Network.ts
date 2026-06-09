import Store from 'utility/Store'

const blockedOrigins = new Set([
	'https://www.bungie.net',
	'https://stats.bungie.net',
	'https://definition.deepsight.gg',
	'https://database-clarity.github.io',
])

namespace Network {

	export async function fetch (input: RequestInfo | URL, init?: RequestInit) {
		const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, self.origin)
		if (blockedOrigins.has(url.origin) && await Store.simulateOfflineApi.get()) {
			switch (Math.floor(Math.random() * 3)) {
				case 0:
					throw new Error(`Simulated API outage: ${url.href}`)
				case 1:
					return new Response('<!DOCTYPE html><html><body><h2>500 - Server Error</h2><h3>Simulated API outage</h3></body></html>', {
						status: 500,
						statusText: 'Simulated API outage',
						headers: {
							'Content-Type': 'text/html',
						},
					})
				default:
					return Response.json({
						Response: null,
						ErrorCode: 5,
						ThrottleSeconds: 0,
						ErrorStatus: 'SystemDisabled',
						Message: 'Simulated Bungie API outage',
						MessageData: {},
					}, {
						status: 503,
						statusText: 'Simulated API outage',
					})
			}
		}

		return self.fetch(input, init)
	}

}

export default Network
