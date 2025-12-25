import Store from 'utility/Store'

declare module 'utility/Store' {
	export interface LocalStorage {
		verboseLogging: true | undefined
	}
}
namespace Log {
	export const VERBOSE = Store.verboseLogging.state(false)

	const SERVICE_FORMAT = 'color: #58946c;'
	const PUNCT_FORMAT = 'color: #888;'
	const WARN_FORMAT = 'color: #ee942e;'
	const ERROR_FORMAT = 'color: #d9534f;'
	export function info (...args: any[]) {
		// log with coloured prefix [conduit.deepsight.gg]
		console[VERBOSE.value ? 'info' : 'debug'](`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/`,
			PUNCT_FORMAT,
			SERVICE_FORMAT,
			PUNCT_FORMAT,
			...args,
		)
	}

	export function warn (...args: any[]) {
		// log with coloured prefix [conduit.deepsight.gg]
		console.warn(`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/`,
			WARN_FORMAT,
			SERVICE_FORMAT,
			PUNCT_FORMAT,
			...args,
		)
	}

	export function error (...args: any[]) {
		// log with coloured prefix [conduit.deepsight.gg]
		console.error(`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/`,
			ERROR_FORMAT,
			SERVICE_FORMAT,
			PUNCT_FORMAT,
			...args,
		)
	}
}

export default Log
