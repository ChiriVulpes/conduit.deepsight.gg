export interface ConduitFunctionRegistry {
	getNeedsAuth (origin: string): boolean
}

export interface ConduitBroadcastRegistry {
	testBroadcast: string
}
