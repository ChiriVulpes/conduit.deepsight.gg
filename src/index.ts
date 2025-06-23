declare function getModule<T> (moduleName: string): T
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
void getModule<typeof import('Init')>('Init').default()

interface Service extends ServiceWorkerGlobalScope {
	onInstall (event: Event): Promise<unknown>
	onActivate (event: Event): Promise<unknown>
	setRegistered (): void
}

const service = self as any as Service
const registrationPromise = new Promise<void>(resolve => service.setRegistered = resolve)

service.addEventListener('install', event => {
	event.waitUntil((async () => {
		await registrationPromise
		await service.onInstall(event)
	})())
})

service.addEventListener('activate', event => {
	event.waitUntil((async () => {
		await service.onActivate(event)
		await service.clients.claim()
	})())
})
