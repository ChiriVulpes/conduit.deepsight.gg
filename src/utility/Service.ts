interface Service<BROADCASTS extends Record<string, any> = Record<string, any>> extends ServiceWorkerGlobalScope {
	onInstall (event: ExtendableEvent): Promise<unknown>
	onActivate (event: ExtendableEvent): Promise<unknown>
	onCall (event: ExtendableMessageEvent): Promise<unknown>
	setRegistered (): void
	broadcast: { [KEY in keyof BROADCASTS]: (data: BROADCASTS[KEY], options?: StructuredSerializeOptions) => Promise<void> }
}

const service: Service = Object.assign(self as any as Service, {
	broadcast: new Proxy({}, {
		get: (target, type: string) => {
			return async (data: unknown, options?: StructuredSerializeOptions) => {
				if (typeof type !== 'string' || !type)
					throw new Error('Invalid broadcast type')

				for (const client of await service.clients.matchAll({ includeUncontrolled: true, type: 'window' }))
					client.postMessage({ type, data }, options)
			}
		},
	}),
})

type Messages = Record<string, any>
interface ServiceDefinition<FUNCTIONS extends Messages = Messages, BROADCASTS extends Messages = Messages> {
	/**
	 * Prepare the service worker by downloading or caching necessary data before the actual changeover happens.
	 * Until this promise resolves, the old service worker will continue to serve requests.
	 */
	onInstall (service: Service<BROADCASTS>, event: ExtendableEvent): Promise<unknown>
	/**
	 * Complete setup of the service worker.
	 * Until this promise resolves, the new service worker will buffer any requests it receives.
	 */
	onActivate (service: Service<BROADCASTS>, event: ExtendableEvent): Promise<unknown>
	onCall: { [KEY in keyof FUNCTIONS]: (data: FUNCTIONS[KEY]) => unknown }
}

function Service<FUNCTIONS extends Messages, BROADCASTS extends Messages> (definition: NoInfer<ServiceDefinition<FUNCTIONS, BROADCASTS>>): Service<BROADCASTS> {
	const realService = service as Service<BROADCASTS>
	service.onInstall = event => definition.onInstall(realService, event)
	service.onActivate = event => definition.onActivate(realService, event)
	service.onCall = async event => {
		if (typeof event.data !== 'object' || !('type' in event.data))
			throw new Error('Unsupported message type')

		const result = await definition.onCall[event.data.type](event.data.data)
		event.source?.postMessage({ type: `return:${event.data.type}`, data: result })
	}
	service.setRegistered()
	return realService
}

export default Service
