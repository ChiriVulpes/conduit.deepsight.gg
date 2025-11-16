interface ConduitState {
	version: {
		combined: string
		destiny: string
		deepsight: string
		clarity: string
		updated: boolean
	}
	authed: boolean
	profiles: number
}

export default ConduitState
