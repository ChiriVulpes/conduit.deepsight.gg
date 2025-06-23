type GlobalThis = typeof globalThis
interface ServiceWorkerGlobalBase extends ServiceWorkerGlobalScope, Omit<GlobalThis, keyof ServiceWorkerGlobalScope> { }

interface ServiceDefinition {
	/**
	 * Prepare the service worker by downloading or caching necessary data before the actual changeover happens.
	 * Until this promise resolves, the old service worker will continue to serve requests.
	 */
	onInstall (service: Service, event: Event): Promise<unknown>
	/**
	 * Complete setup of the service worker.
	 * Until this promise resolves, the new service worker will buffer any requests it receives.
	 */
	onActivate (service: Service, event: Event): Promise<unknown>
}

interface Service extends ServiceWorkerGlobalBase {
	postMessageAll (message: any, options?: StructuredSerializeOptions): void
}

function Service (definition: ServiceDefinition): Service {
	const service: Service = Object.assign(self as any as ServiceWorkerGlobalBase, {
		async postMessageAll (message: any, options?: StructuredSerializeOptions) {
			for (const client of await service.clients.matchAll({ includeUncontrolled: true, type: 'window' }))
				client.postMessage(message, options)
		},
	})

	service.addEventListener('install', event => {
		event.waitUntil(definition.onInstall(service, event))
	})

	service.addEventListener('activate', event => {
		event.waitUntil((async () => {
			await definition.onActivate(service, event)
			await service.clients.claim()
		})())
	})

	return service
}

export default Service
