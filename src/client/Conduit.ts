if (!('serviceWorker' in navigator))
	throw new Error('Service Worker is not supported in this browser')

interface ConduitOptions {
	service?: string
}

interface Conduit {
	update (): Promise<void>
}

async function Conduit (options: ConduitOptions): Promise<Conduit> {
	await new Promise<unknown>(resolve => window.addEventListener('DOMContentLoaded', resolve))

	const iframe = document.createElement('iframe')
	const serviceRoot = options.service ?? 'https://conduit.deepsight.gg'
	const serviceOrigin = new URL(serviceRoot).origin
	iframe.src = `${serviceRoot}/index.html`
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

	window.addEventListener('message', event => {
		if (event.source !== iframe.contentWindow)
			return

		const data = event.data as { type: string, data: unknown }
		if (typeof data !== 'object' || typeof data.type !== 'string') {
			console.warn('Incomprehensible message from Conduit iframe:', data)
			return
		}

		let used = false
		for (let i = 0; i < messageListeners.length; i++) {
			const listener = messageListeners[i]
			if (listener.type === data.type) {
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

		if (used)
			return

		console.log('Unhandled message:', data)
	})

	return {
		update () {
			iframe.contentWindow?.postMessage({ type: '_update' }, serviceOrigin)
			return addPromiseListener('_update')
		},
	}
}

export default Conduit
