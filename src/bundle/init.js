/// <reference lib="webworker" />

/**
 * @typedef {Object} Service
 * @property {function(): void} setRegistered
 * @property {function(ExtendableEvent): Promise<unknown>} onInstall
 * @property {function(ExtendableEvent): Promise<unknown>} onActivate
 * @property {function(ExtendableMessageEvent): Promise<unknown>} onCall
 */

const service = /** @type {ServiceWorkerGlobalScope & Service} */ (self)
const registrationPromise = new Promise(resolve => service.setRegistered = resolve)

service.addEventListener('install', event => {
	event.waitUntil((async () => {
		await registrationPromise
		await service.onInstall?.(event)
	})())
})

service.addEventListener('activate', event => {
	event.waitUntil((async () => {
		await service.onActivate?.(event)
		await service.clients.claim()
	})())
})

service.addEventListener('message', event => {
	event.waitUntil((async () => {
		await service.onCall?.(event)
	})())
})

// eslint-disable-next-line @typescript-eslint/no-unsafe-call, no-undef, @typescript-eslint/no-unsafe-member-access
getModule('Init').default()
