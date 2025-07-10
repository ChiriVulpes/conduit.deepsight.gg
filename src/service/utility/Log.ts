namespace Log {
	export function info (...args: any[]) {
		// log with coloured prefix [conduit.deepsight.gg]
		console.info('%cconduit.deepsight.gg %c/', 'color: #58946c; font-weight: bold;', 'color:#888;', ...args)
	}
}

export default Log
