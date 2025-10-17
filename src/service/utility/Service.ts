interface Service<BROADCASTS extends Record<string, any> = Record<string, any>> extends ServiceWorkerGlobalScope {
	onInstall (event: ExtendableEvent): Promise<unknown>
	onActivate (event: ExtendableEvent): Promise<unknown>
	onCall (event: ExtendableMessageEvent): Promise<unknown>
	setRegistered (): void
	broadcast: { [KEY in keyof BROADCASTS]: (data: BROADCASTS[KEY] | ((origin: string) => BROADCASTS[KEY] | Promise<BROADCASTS[KEY]>), options?: StructuredSerializeOptions) => Promise<void> }
}

const origins = new Map<string, string>()

const service: Service = Object.assign(self as any as Service, {
	broadcast: new Proxy({}, {
		get: (target, type: string) => {
			return async <T extends object> (data: T | ((origin: string) => T | Promise<T>), options?: StructuredSerializeOptions) => {
				if (typeof type !== 'string' || !type)
					throw new Error('Invalid broadcast type')

				for (const client of await service.clients.matchAll({ includeUncontrolled: true, type: 'window' })) {
					if (typeof data === 'function')
						client.postMessage({ id: 'global', type, data: await data(origins.get(client.id) ?? 'bad.origin') }, options)
					else
						client.postMessage({ id: 'global', type, data }, options)
				}
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
	onRegistered (service: Service<BROADCASTS>): unknown
	onCall: { [KEY in keyof FUNCTIONS]: (event: ExtendableMessageEvent, ...data: Parameters<FUNCTIONS[KEY]>) => ReturnType<FUNCTIONS[KEY]> | Awaited<ReturnType<FUNCTIONS[KEY]>> }
}

function Service<FUNCTIONS extends Messages, BROADCASTS extends Messages> (definition: NoInfer<ServiceDefinition<FUNCTIONS, BROADCASTS>>): Service<BROADCASTS> {
	const realService = service as Service<BROADCASTS>
	service.onInstall = event => definition.onInstall(realService, event)
	service.onActivate = event => definition.onActivate(realService, event)
	service.onCall = async event => {
		if (typeof event.data !== 'object' || !('type' in event.data))
			throw new Error('Unsupported message type')

		const { id, type, origin, data, frame } = event.data as { id: string, type: string, origin: string, data?: unknown, frame?: true }
		Object.defineProperty(event, 'origin', { get () { return origin ?? 'bad.origin' }, configurable: true })

		const clientId = (event.source as WindowClient).id
		if (!frame || !origins.has(clientId))
			origins.set(clientId, origin ?? 'bad.origin')

		try {
			const fn = definition.onCall[type]
			if (!fn)
				throw new Error(`The function '${type}' does not exist`)

			const params: any[] = data === undefined ? [] : !Array.isArray(data) ? [data] : data
			const result = await Promise.resolve(fn(event, ...params as never))

			event.source?.postMessage({ id, type: `resolve:${type}`, origin, data: result })
		}
		catch (err) {
			event.source?.postMessage({ id, type: `reject:${type}`, origin, data: err })
		}
	}
	service.setRegistered()
	definition.onRegistered?.(realService)
	return realService
}

export default Service
