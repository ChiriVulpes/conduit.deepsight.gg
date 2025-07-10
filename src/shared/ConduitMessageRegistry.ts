import type { AuthedOrigin } from './Auth'
import type { Profile } from './Profile'

export interface ConduitFunctionRegistry {
	isAuthenticated (): boolean
	getOriginAccess (origin: string): AuthedOrigin | undefined
	authenticate (code: string): boolean
	grantAccess (origin: string): void
	denyAccess (origin: string): void
	getProfiles (): Profile[]
}

export interface ConduitBroadcastRegistry {
	testBroadcast: string
}
