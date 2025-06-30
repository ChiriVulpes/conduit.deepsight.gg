import type { Profile } from './Profile'

export interface ConduitFunctionRegistry {
	getOriginNeedsAuth (origin: string): boolean
	getProfiles (): Profile[]
}

export interface ConduitBroadcastRegistry {
	testBroadcast: string
}
