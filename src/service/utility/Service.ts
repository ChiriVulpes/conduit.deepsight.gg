import Log from 'utility/Log'

interface Service<BROADCASTS extends Record<string, any> = Record<string, any>> extends ServiceWorkerGlobalScope {
	onInstall (event: ExtendableEvent): Promise<unknown>
	onActivate (event: ExtendableEvent): Promise<unknown>
	onCall (event: ExtendableMessageEvent): Promise<unknown>
	setRegistered (): void
	broadcast: { [KEY in keyof BROADCASTS]: (data: BROADCASTS[KEY] | ((origin: string) => BROADCASTS[KEY] | typeof SKIP_CLIENT | Promise<BROADCASTS[KEY] | typeof SKIP_CLIENT>), options?: StructuredSerializeOptions) => Promise<void> }
}

// const origins = new Map<string, string>()

export const SKIP_CLIENT = Symbol('SKIP_CLIENT')
const ORIGIN_CACHE_TTL = 1000

const service: Service = Object.assign(self as any as Service, {
	broadcast: new Proxy({}, {
		get: (target, type: string) => {
			return async <T extends object> (data: T | ((origin: string) => T | Promise<T>), options?: StructuredSerializeOptions) => {
				if (typeof type !== 'string' || !type)
					throw new Error('Invalid broadcast type')

				const clients = await service.clients.matchAll({ includeUncontrolled: true, type: 'window' })
				const delivery = {
					delivered: 0,
					skipped: 0,
					missingOrigin: 0,
					failed: 0,
				}
				await Promise.all(clients.map(async client => {
					try {
						if (typeof data === 'function') {
							const origin = await getOrigin(client)
							if (!origin) {
								delivery.missingOrigin++
								return
							}

							const clientData = await data(origin)
							if (clientData === SKIP_CLIENT) {
								delivery.skipped++
								return
							}

							client.postMessage({ id: 'global', type, data: clientData }, options)
							delivery.delivered++
						}
						else {
							client.postMessage({ id: 'global', type, data }, options)
							delivery.delivered++
						}
					}
					catch (err) {
						delivery.failed++
						Log.warn('Broadcast delivery failed', type, `client=${client.id}`, err)
					}
				}))

				if (clients.length && delivery.delivered === 0)
					Log.info(
						'Broadcast delivered to no clients',
						type,
						`clients=${clients.length}`,
						`delivered=${delivery.delivered}`,
						`skipped=${delivery.skipped}`,
						`missingOrigin=${delivery.missingOrigin}`,
						`failed=${delivery.failed}`,
					)
			}
		},
	}),
})

interface CachedOrigin {
	origin: string
	expires: number
}

interface AwaitingOrigin {
	promise: Promise<string | undefined>
	resolve (origin: string | undefined): void
}

const cachedOrigins = new Map<string, CachedOrigin>()
const awaitingOrigins: Map<string, AwaitingOrigin> = new Map()
async function getOrigin (client: WindowClient): Promise<string | undefined> {
	const cachedOrigin = cachedOrigins.get(client.id)
	if (cachedOrigin) {
		if (cachedOrigin.expires > Date.now())
			return cachedOrigin.origin

		cachedOrigins.delete(client.id)
	}

	const awaitingOrigin = awaitingOrigins.get(client.id)
	if (awaitingOrigin)
		return awaitingOrigin.promise

	let timeout: number | undefined
	let resolveOrigin!: (origin: string | undefined) => void
	const promise = new Promise<string | undefined>(resolve => {
		resolveOrigin = origin => {
			if (timeout !== undefined)
				clearTimeout(timeout)

			awaitingOrigins.delete(client.id)
			if (origin)
				cachedOrigins.set(client.id, { origin, expires: Date.now() + ORIGIN_CACHE_TTL })
			resolve(origin)
		}
		timeout = self.setTimeout(() => resolveOrigin(undefined), 500)
	})
	awaitingOrigins.set(client.id, { promise, resolve: resolveOrigin })
	client.postMessage({ id: 'global', type: '_getOrigin' })
	return promise
}

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
		if (id === 'global' && type === 'resolve:_getOrigin') {
			if (Array.isArray(data) && typeof data[0] === 'string')
				awaitingOrigins.get((event.source as WindowClient).id)?.resolve(data[0])
			return
		}

		Object.defineProperty(event, 'origin', { get () { return origin ?? 'bad.origin' }, configurable: true })

		// const clientId = (event.source as WindowClient).id
		// if (!frame || !origins.has(clientId))
		// 	origins.set(clientId, origin ?? 'bad.origin')

		try {
			const fn = definition.onCall[type]
			if (!fn)
				throw new Error(`The function '${type}' does not exist`)

			const params: any[] = data === undefined ? [] : !Array.isArray(data) ? [data] : data
			const result = await Promise.resolve(definition.onCall[type](event, ...params as never))

			event.source?.postMessage({ id, type: `resolve:${type}`, origin, data: result, frame })
		}
		catch (err) {
			event.source?.postMessage({ id, type: `reject:${type}`, origin, data: err, frame })
		}
	}
	service.setRegistered()
	definition.onRegistered?.(realService)
	return realService
}

export default Service
