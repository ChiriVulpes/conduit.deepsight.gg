/// <reference lib="webworker" />

/**
 * @typedef {Object} Service
 * @property {function(): void} setRegistered
 * @property {function(ExtendableEvent): Promise<unknown>} onInstall
 * @property {function(ExtendableEvent): Promise<unknown>} onActivate
 * @property {function(ExtendableMessageEvent): Promise<unknown>} onCall
 */

const serviceWorkerSelf = /** @type {ServiceWorkerGlobalScope & Service} */ (self)
const registrationPromise = new Promise(resolve => serviceWorkerSelf.setRegistered = resolve)

serviceWorkerSelf.addEventListener('install', event => {
	event.waitUntil((async () => {
		await registrationPromise
		await serviceWorkerSelf.onInstall?.(event)
	})())

	void serviceWorkerSelf.skipWaiting()
})

serviceWorkerSelf.addEventListener('activate', event => {
	event.waitUntil((async () => {
		await serviceWorkerSelf.onActivate?.(event)
		await serviceWorkerSelf.clients.claim()
	})())
})

serviceWorkerSelf.addEventListener('message', event => {
	event.waitUntil((async () => {
		await serviceWorkerSelf.onCall?.(event)
	})())
})

// eslint-disable-next-line @typescript-eslint/no-unsafe-call, no-undef, @typescript-eslint/no-unsafe-member-access
getModule('Init').default()
