export interface AccessGrant {
	appName?: string
	origin: string
	authTimestamp: number
	fullTrust?: true
}

export interface CustomBungieApp {
	apiKey: string
	clientId: string
	clientSecret: string
}

export interface AuthState {
	authenticated: boolean
	accessGrants: AccessGrant[]
	bungieAuthURL: string
	customApp?: CustomBungieApp
}
