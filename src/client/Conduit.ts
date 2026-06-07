import type Frame from '@frame/FrameFunctions'
import type { ConduitBroadcastRegistry, ConduitFunctionRegistry } from 'conduit.deepsight.gg/ConduitMessageRegistry'
import Definitions from 'Definitions'

export { default as Inventory } from 'conduit.deepsight.gg/Inventory'

if (!('serviceWorker' in navigator))
	throw new Error('Service Worker is not supported in this browser')

const REQUEST_TIMEOUT = 1000 * 60 * 2
const STARTUP_TIMEOUT = 1000 * 30

interface ConduitOptions {
	service?: string
	authOptions?:
	| 'blank'
	| 'navigate'
	| { type: 'popup', width?: number, height?: number }
}

export type Unsubscribe = () => void

interface ConduitImplementation {
	on: { [TYPE in keyof ConduitBroadcastRegistry]: (handler: (data: ConduitBroadcastRegistry[TYPE]) => unknown) => Unsubscribe }
	readonly definitions: Definitions
	update (): Promise<void>
	ensureAuthenticated (appName?: string): Promise<boolean>
}

interface Conduit extends ConduitFunctionRegistry, ConduitImplementation {
}

const loaded = document.readyState === 'loading'
	? new Promise<unknown>(resolve => window.addEventListener('DOMContentLoaded', resolve, { once: true }))
	: Promise.resolve()

interface SerializedError {
	__conduitError: true
	name?: string
	message: string
	stack?: string
	cause?: unknown
}

function toError (data: unknown): Error {
	if (data instanceof Error)
		return data

	if (data && typeof data === 'object' && '__conduitError' in data) {
		const serialized = data as SerializedError
		const err = new Error(serialized.message, { cause: serialized.cause })
		err.name = serialized.name ?? err.name
		err.stack = serialized.stack
		return err
	}

	return new Error('Promise message rejected', { cause: data })
}

function timeoutError (label: string, timeout: number): Error {
	return new Error(`${label} timed out after ${timeout}ms`)
}

function withTimeout<T> (promise: Promise<T>, label: string, timeout = REQUEST_TIMEOUT): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timeoutId = setTimeout(() => reject(timeoutError(label, timeout)), timeout)
		promise.then(
			value => {
				clearTimeout(timeoutId)
				resolve(value)
			},
			err => {
				clearTimeout(timeoutId)
				reject(err instanceof Error ? err : new Error('Promise rejected', { cause: err }))
			},
		)
	})
}

async function Conduit (options: ConduitOptions): Promise<Conduit> {
	await loaded

	const iframe = document.createElement('iframe')
	const serviceRoot = new URL(options.service ?? 'https://conduit.deepsight.gg')
	const serviceOrigin = serviceRoot.origin
	iframe.src = `${serviceRoot}service`
	iframe.style.display = 'none'
	document.body.appendChild(iframe)

	interface MessageListener {
		id: string
		type: string
		expiry?: number
		once?: true
		callback: (data: any) => void
	}
	const messageListeners: MessageListener[] = []
	function addListener (id: string, type: string, callback: (data: any) => void, once = false): MessageListener {
		const expiry = !once ? undefined : Date.now() + 1000 * 60 * 2 // 2 minute expiry for once listeners
		const listener: MessageListener = {
			id,
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
	function removeListeners (id: string): void {
		for (let i = 0; i < messageListeners.length; i++) {
			if (messageListeners[i].id !== id)
				continue

			messageListeners.splice(i, 1)
			i--
		}
	}
	function addPromiseListener<T> (type: string): { id: string, promise: Promise<T> } {
		const id = Math.random().toString(36).slice(2, 13)
		let timeout: ReturnType<typeof setTimeout> | undefined
		let settled = false
		function settle (callback: (value: any) => void, value: any) {
			if (settled)
				return

			settled = true
			if (timeout)
				clearTimeout(timeout)
			callback(value)
		}
		return {
			id,
			promise: new Promise<T>((resolve, reject) => {
				timeout = setTimeout(() => {
					settled = true
					removeListeners(id)
					reject(timeoutError(`Conduit request '${type}' (${id})`, REQUEST_TIMEOUT))
				}, REQUEST_TIMEOUT)
				addListener(id, `resolve:${type}`, data => {
					settle(resolve, data as T)
					removeListener(id)
				}, true)
				addListener(id, `reject:${type}`, data => {
					settle(reject, toError(data))
					removeListener(id)
				}, true)
			}),
		}
	}

	function callPromiseFunction<T> (type: string, ...params: any[]): Promise<T> {
		if (!iframe.contentWindow)
			return Promise.reject(new Error(`Conduit iframe is unavailable for '${type}'`))

		const { id, promise } = addPromiseListener<T>(type)
		iframe.contentWindow?.postMessage({ type, id, data: params }, serviceOrigin)
		return promise
	}

	let setActive: (() => void) | undefined
	const activePromise = withTimeout(new Promise<void>(resolve => setActive = resolve), 'Conduit iframe active signal', STARTUP_TIMEOUT)

	window.addEventListener('message', event => {
		if (event.source !== iframe.contentWindow)
			return

		const data = event.data as { id: string, type: string, data: unknown }
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
			if (listener.type === data.type && listener.id === data.id) {
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

	await withTimeout(new Promise<unknown>(resolve => iframe.addEventListener('load', resolve, { once: true })), 'Conduit iframe load', STARTUP_TIMEOUT)
	await activePromise

	const implementation: ConduitImplementation = {
		definitions: undefined!,
		on: new Proxy({} as never, {
			get (target, eventName: string) {
				return (handler: (data: any) => unknown) => {
					addListener('global', eventName, handler)
					return () => {
						const index = messageListeners.findIndex(listener => listener.id === 'global' && listener.type === eventName && listener.callback === handler)
						if (index !== -1) messageListeners.splice(index, 1)
					}
				}
			},
		}),
		async update () {
			return frame.update()
		},
		async ensureAuthenticated (appName: string) {
			if (!await frame.needsAuth())
				return true

			let proxy: WindowProxy | null = null
			const authURL = `${serviceRoot}?auth=${encodeURIComponent(window.origin)}${appName ? `&app=${encodeURIComponent(appName)}` : ''}`
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

			return !await frame.needsAuth()
		},
	}

	const frame = new Proxy({}, {
		get (target, fname: keyof Frame.Functions) {
			if (fname as any === 'then')
				return undefined

			return (...params: unknown[]) => callPromiseFunction(`_${fname}`, ...params)
		},
	}) as any as Frame.Functions

	const conduit = new Proxy(implementation, {
		get (target, fname: keyof Conduit) {
			if (fname as any === 'then')
				return undefined

			if (fname in target)
				return target[fname as keyof typeof target]

			return (...params: unknown[]) => callPromiseFunction(fname, ...params)
		},
	}) as Conduit

	await conduit.setOrigin()

	Object.assign(conduit, { definitions: Definitions(conduit) })
	return conduit
}

export default Conduit
