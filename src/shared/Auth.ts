export interface AuthedOrigin {
	appName?: string
	origin: string
	authTimestamp: number
}

export interface CustomBungieApp {
	apiKey: string
	clientId: string
	clientSecret: string
}
