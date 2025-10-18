import type { ConduitFunctionRegistry } from '@shared/ConduitMessageRegistry'
import type Frame from 'FrameFunctions'

const parentWindow = window.parent
if (!parentWindow)
	throw new Error('This page must be loaded in an iframe')

void (async () => {
	const registration = await navigator.serviceWorker.register('./index.js')
	let service = registration.active ?? await new Promise(resolve => {
		const service = registration.waiting ?? registration.installing
		service?.addEventListener('statechange', onStateChange)
		function onStateChange () {
			if (service?.state !== 'activated')
				return

			service.removeEventListener('statechange', onStateChange)
			resolve(service)
		}
	})

	interface Message<T = any> {
		id: string
		type: keyof T & string
		data?: unknown
		origin?: string
		frame?: true
	}

	const unresolvedMessages = new Map<string, any>()

	const MAIN_FORMAT = 'color: #58946c;'
	const PUNCT_FORMAT = 'color: #888;'
	const SERVICE_FORMAT = 'color: #58946c;'
	const FRAME_FORMAT = 'color: #8651db;'
	const HOST_FORMAT = 'color: #537cc9;'
	const MESSAGE_FORMAT = 'color: #4ef0bc;'
	const ERROR_FORMAT = 'color: #d9534f;'
	navigator.serviceWorker.addEventListener('message', event => {
		const { id, type, data, frame } = event.data as Message

		////////////////////////////////////
		// #region Internal SW > Frame

		let used = false
		for (let i = 0; i < messageListeners.length; i++) {
			const listener = messageListeners[i]
			if (listener.type === type && listener.id === id) {
				console.log(
					`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/ %cFrame %c\u2B9C Service %c/ %c${type} %o`,
					PUNCT_FORMAT, MAIN_FORMAT, PUNCT_FORMAT, FRAME_FORMAT, SERVICE_FORMAT, PUNCT_FORMAT, MESSAGE_FORMAT,
					data,
				)

				listener.callback(data)
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

		// check if this is an internal message that should not be forwarded to parent
		if (used || frame)
			return

		// #endregion
		////////////////////////////////////

		if (id !== 'global' && !unresolvedMessages.has(id)) {
			console.log(
				`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/ %cHost %c\u2B9C Service %c/ %cReceived response for unknown message ID %o %o %o`,
				PUNCT_FORMAT, MAIN_FORMAT, PUNCT_FORMAT, HOST_FORMAT, SERVICE_FORMAT, PUNCT_FORMAT, ERROR_FORMAT,
				id, type, data,
			)
			return
		}

		if (id === 'global' && type === 'ready') {
			resend()
			return
		}

		unresolvedMessages.delete(id)

		// forward messages from the service worker to the parent window
		console.log(
			`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/ %cHost %c\u2B9C Service %c/ %c${type} %o`,
			PUNCT_FORMAT, MAIN_FORMAT, PUNCT_FORMAT, HOST_FORMAT, SERVICE_FORMAT, PUNCT_FORMAT, MESSAGE_FORMAT,
			data,
		)
		parentWindow.postMessage(event.data, '*')
	})

	window.addEventListener('message', event => {
		if (event.source !== parentWindow)
			return

		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		if (typeof event.data !== 'object' || typeof event.data.type !== 'string') {
			console.log(
				`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/ %cHost %c\u2B9E Service %c/ %cUnsupported message %o`,
				PUNCT_FORMAT, MAIN_FORMAT, PUNCT_FORMAT, HOST_FORMAT, SERVICE_FORMAT, PUNCT_FORMAT, ERROR_FORMAT,
				event.data,
			)
			return
		}

		const message = { ...event.data } as Message<Frame.Functions>
		delete message.frame

		// special messages that the iframe will handle
		const frameFunctionType = message.type.slice(1) as keyof Frame.Functions
		const frameFunction = message.type.startsWith('_') ? functions[frameFunctionType] as ((event: MessageEvent<any>, ...data: unknown[]) => Promise<any>) | undefined : undefined
		if (frameFunction) {
			console.log(
				`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/ %cHost \u2B9E %cFrame %c/ %c${message.type.slice(1)} %o`,
				PUNCT_FORMAT, MAIN_FORMAT, PUNCT_FORMAT, HOST_FORMAT, FRAME_FORMAT, PUNCT_FORMAT, MESSAGE_FORMAT,
				message.data,
			)
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			void Promise.resolve(frameFunction(event, ...Array.isArray(message.data) ? message.data : [])).then(
				result => {
					reply({ type: `resolve:${message.type}`, id: message.id, data: result })
				},
				err => {
					reply({ type: `reject:${message.type}`, id: message.id, data: err })
				},
			)

			function reply (message: Message) {
				console.log(
					`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/ %cHost %c\u2B9C Frame %c/ %c${message.type.replace(':_', ':')} %o`,
					PUNCT_FORMAT, MAIN_FORMAT, PUNCT_FORMAT, HOST_FORMAT, FRAME_FORMAT, PUNCT_FORMAT, MESSAGE_FORMAT,
					message.data,
				)
				const source = event.source as Window
				source?.postMessage(message, '*')
			}
			return
		}

		message.origin = event.origin

		// forward messages from the parent window to the service worker
		console.log(
			`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/ %cHost \u2B9E %cService %c/ %c${message.type} %o`,
			PUNCT_FORMAT, MAIN_FORMAT, PUNCT_FORMAT, HOST_FORMAT, SERVICE_FORMAT, PUNCT_FORMAT, MESSAGE_FORMAT,
			message.data,
		)
		unresolvedMessages.set(message.id, message)
		service?.postMessage(message)
	})

	const functions: { [KEY in keyof Frame.Functions]: (...params: [event: MessageEvent<any>, ...Parameters<Frame.Functions[KEY]>]) => ReturnType<Frame.Functions[KEY]> } = {
		async update () {
			await registration.update()
		},
		async needsAuth (event) {
			const authState = await conduit._getAuthState()
			return !(authState.authenticated && authState.accessGrants.some(grant => grant.origin === event.origin))
		},
	}

	const conduit = new Proxy({}, {
		get (target, fname: keyof ConduitFunctionRegistry) {
			if (fname as any === 'then')
				return undefined

			return (...params: unknown[]) => callPromiseFunction(fname, ...params)
		},
	}) as ConduitFunctionRegistry

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
	function addPromiseListener<T> (type: string): { id: string, promise: Promise<T> } {
		const id = Math.random().toString(36).slice(2)
		return {
			id,
			promise: new Promise<T>((resolve, reject) => {
				addListener(id, `resolve:${type}`, data => {
					resolve(data as T)
					removeListener(id)
				}, true)
				addListener(id, `reject:${type}`, data => {
					reject(data instanceof Error ? data : new Error('Promise message rejected', { cause: data }))
					removeListener(id)
				}, true)
			}),
		}
	}

	function callPromiseFunction<T> (type: string, ...params: any[]): Promise<T> {
		const { id, promise } = addPromiseListener<T>(type)

		console.log(
			`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/ %cFrame \u2B9E %cService %c/ %c${type} %o`,
			PUNCT_FORMAT, MAIN_FORMAT, PUNCT_FORMAT, FRAME_FORMAT, SERVICE_FORMAT, PUNCT_FORMAT, MESSAGE_FORMAT,
			params,
		)

		service?.postMessage({ type, id, data: params, origin: self.origin, frame: true })
		return promise
	}

	navigator.serviceWorker.addEventListener('controllerchange', () => {
		service = registration.active
		resend()
	})

	function resend () {
		if (!unresolvedMessages.size)
			return

		console.log(
			`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/`,
			PUNCT_FORMAT, MAIN_FORMAT, PUNCT_FORMAT,
			'Service updated, resending unresolved messages',
		)
		for (const [, data] of unresolvedMessages)
			service?.postMessage(data)
	}

	parentWindow.postMessage({ type: '_active' }, '*')
})()
