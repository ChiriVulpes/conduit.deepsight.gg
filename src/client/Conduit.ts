import type { AuthedOrigin } from '@shared/Auth'
import type { ConduitFunctionRegistry } from '@shared/ConduitMessageRegistry'

if (!('serviceWorker' in navigator))
	throw new Error('Service Worker is not supported in this browser')

interface ConduitOptions {
	service?: string
	authOptions?:
	| 'blank'
	| 'navigate'
	| { type: 'popup', width?: number, height?: number }
}

type ConduitFunctions = { [KEY in keyof ConduitFunctionRegistry]: (...params: Parameters<ConduitFunctionRegistry[KEY]>) => Promise<ReturnType<ConduitFunctionRegistry[KEY]>> }
interface ConduitImplementation {
	update (): Promise<void>
	requestGrant (): Promise<boolean>
	getOriginAccess (origin?: string): Promise<AuthedOrigin | undefined>
}

interface Conduit extends Omit<ConduitFunctions, keyof ConduitImplementation>, ConduitImplementation {
}

const loaded = new Promise<unknown>(resolve => window.addEventListener('DOMContentLoaded', resolve, { once: true }))
async function Conduit (options: ConduitOptions): Promise<Conduit> {
	await loaded

	const iframe = document.createElement('iframe')
	const serviceRoot = new URL(options.service ?? 'https://conduit.deepsight.gg')
	const serviceOrigin = serviceRoot.origin
	iframe.src = `${serviceRoot}service`
	iframe.style.display = 'none'
	document.body.appendChild(iframe)

	await new Promise<unknown>(resolve => iframe.addEventListener('load', resolve, { once: true }))

	interface MessageListener {
		id: string
		type: string
		expiry?: number
		once?: true
		callback: (data: any) => void
	}
	const messageListeners: MessageListener[] = []
	function addListener (type: string, callback: (data: any) => void, once = false): MessageListener {
		const expiry = !once ? undefined : Date.now() + 1000 * 60 * 2 // 2 minute expiry for once listeners
		const listener: MessageListener = {
			id: Math.random().toString(36).slice(2),
			type,
			callback,
			once: once ? true : undefined,
			expiry,
		}
		messageListeners.push(listener)
		return listener
	}
	function removeListener (id: string): void {
		const index = messageListeners.findIndex(listener => listener.id === id)
		if (index !== -1) messageListeners.splice(index, 1)
	}
	function addPromiseListener<T> (type: string): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const resolveListener = addListener(`resolve:${type}`, data => {
				resolve(data as T)
				removeListener(rejectListener.id)
			}, true)
			const rejectListener = addListener(`reject:${type}`, data => {
				reject(data instanceof Error ? data : new Error('Promise message rejected', { cause: data }))
				removeListener(resolveListener.id)
			}, true)
		})
	}

	function callPromiseFunction<T> (type: string, ...params: any[]): Promise<T> {
		iframe.contentWindow?.postMessage({ type, data: params }, serviceOrigin)
		return addPromiseListener<T>(type)
	}

	let setActive: (() => void) | undefined
	const activePromise = new Promise<void>(resolve => setActive = resolve)

	window.addEventListener('message', event => {
		if (event.source !== iframe.contentWindow)
			return

		const data = event.data as { type: string, data: unknown }
		if (typeof data !== 'object' || typeof data.type !== 'string') {
			console.warn('Incomprehensible message from Conduit iframe:', data)
			return
		}

		if (data.type === '_active') {
			setActive?.()
			return
		}

		let used = false
		for (let i = 0; i < messageListeners.length; i++) {
			const listener = messageListeners[i]
			if (listener.type === data.type) {
				listener.callback(data.data)
				used = true
				if (listener.once) {
					messageListeners.splice(i, 1)
					i--
					continue
				}
			}

			if (listener.expiry && listener.expiry < Date.now()) {
				messageListeners.splice(i, 1)
				i--
			}
		}

		if (used)
			return

		console.log('Unhandled message:', data)
	})

	await activePromise

	const implementation: ConduitImplementation = {
		async getOriginAccess (origin = window.origin) {
			return callPromiseFunction<AuthedOrigin | undefined>('getOriginAccess', origin).catch(() => undefined)
		},
		async update () {
			return callPromiseFunction('_update')
		},
		async requestGrant () {
			if (await this.getOriginAccess())
				return true

			let proxy: WindowProxy | null = null
			const authURL = `${serviceRoot}?auth=${encodeURIComponent(window.origin)}`
			switch (options.authOptions) {
				case 'blank':
					proxy = window.open(authURL, '_blank')
					break
				case 'navigate':
					window.location.href = `${authURL}&redirect=${encodeURIComponent(window.location.href)}`
					break

				default: {
					const width = options.authOptions?.width ?? 600
					const height = options.authOptions?.height ?? 800

					const screenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX
					const screenTop = window.screenTop !== undefined ? window.screenTop : window.screenY

					const screenWidth = window.innerWidth ? window.innerWidth : document.documentElement.clientWidth ? document.documentElement.clientWidth : screen.width
					const screenHeight = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight ? document.documentElement.clientHeight : screen.height

					const left = ((screenWidth - width) / 2) + screenLeft
					const top = ((screenHeight - height) / 2) + screenTop
					proxy = window.open(authURL, '_blank', `width=${width},height=${height},left=${left},top=${top}`)
					break
				}
			}

			if (proxy)
				await new Promise<void>(resolve => {
					const interval = setInterval(() => {
						if (proxy?.closed) {
							clearInterval(interval)
							resolve()
						}
					}, 10)
				})
			return !await this.getOriginAccess()
		},
	}

	return new Proxy(implementation, {
		get (target, fname: keyof Conduit) {
			if (fname as any === 'then')
				return undefined

			if (fname in target)
				return target[fname as keyof typeof target]

			return (...params: unknown[]) => callPromiseFunction(fname, ...params)
		},
	}) as Conduit
}

export default Conduit
