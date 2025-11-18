import Store from 'utility/Store'

declare module 'utility/Store' {
	export interface LocalStorage {
		verboseLogging: true | undefined
	}
}
namespace Log {
	export const VERBOSE = Store.verboseLogging.state(false)

	export function info (...args: any[]) {
		// log with coloured prefix [conduit.deepsight.gg]
		console[VERBOSE.value ? 'info' : 'debug'](`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/`, 'color: #888;', 'color: #58946c;', 'color:#888;', ...args)
	}
}

export default Log
