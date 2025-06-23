interface Service extends ServiceWorkerGlobalScope {
	onInstall (event: Event): Promise<unknown>
	onActivate (event: Event): Promise<unknown>
	setRegistered (): void
	postMessageAll (message: any, options?: StructuredSerializeOptions): void
}

const service: Service = Object.assign(self as any as Service, {
	async postMessageAll (message: any, options?: StructuredSerializeOptions) {
		for (const client of await service.clients.matchAll({ includeUncontrolled: true, type: 'window' }))
			client.postMessage(message, options)
	},
})

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

function Service (definition: ServiceDefinition): Service {
	service.onInstall = event => definition.onInstall(service, event)
	service.onActivate = event => definition.onActivate(service, event)
	service.setRegistered()
	return service
}

export default Service
