namespace Log {
	export function info (...args: any[]) {
		// log with coloured prefix [conduit.deepsight.gg]
		console.info(`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/`, 'color: #888;', 'color: #58946c;', 'color:#888;', ...args)
	}
}

export default Log
