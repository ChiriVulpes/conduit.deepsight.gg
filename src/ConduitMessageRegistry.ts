export interface ConduitFunctionRegistry {
	testFunction (language: string): void
}

export interface ConduitBroadcastRegistry {
	testBroadcast: string
}
