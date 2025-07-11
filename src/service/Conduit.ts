import type { ConduitBroadcastRegistry, ConduitFunctionRegistry } from '@shared/ConduitMessageRegistry'
import Auth from 'model/Auth'
import Definitions from 'model/Definitions'
import { db } from 'utility/Database'
import Env from 'utility/Env'
import Store from 'utility/Store'
import Service from './utility/Service'

if (!Env.BUNGIE_API_KEY)
	throw new Error('BUNGIE_API_KEY is not set')

class ConduitPrivateFunctionError extends Error {

	constructor () {
		super('This is an internal action that can only be performed by the conduit iframe')
	}

}

Service<ConduitFunctionRegistry, ConduitBroadcastRegistry>({
	async onInstall (service, event) {
	},
	async onActivate (service, event) {
		void service.broadcast.testBroadcast('21')
		console.log(await Definitions.DestinySeasonDefinition.en.get())
	},
	onCall: {
		async isAuthenticated (event) {
			return await Auth.checkBungie()
		},
		async getProfiles (event) {
			return await db.profiles.toArray()
		},
		async getOriginAccess (event, origin) {
			if (origin !== self.origin && event.origin !== self.origin)
				throw new ConduitPrivateFunctionError()
			return await Auth.getOriginAccess(origin)
		},
		async _getOriginGrants (event) {
			if (event.origin !== self.origin)
				throw new ConduitPrivateFunctionError()
			return await Auth.getOriginGrants()
		},
		async _getCustomApp (event) {
			if (event.origin !== self.origin)
				throw new ConduitPrivateFunctionError()
			return await Store.customApp.get()
		},
		async _setCustomApp (event, app) {
			if (event.origin !== self.origin)
				throw new ConduitPrivateFunctionError()
			if (app)
				await Store.customApp.set(app)
			else
				await Store.customApp.delete()
			await Store.auth.delete() // must re-auth when changing app
		},
		async _authenticate (event, code) {
			if (event.origin !== self.origin)
				throw new ConduitPrivateFunctionError()
			return await Auth.complete(code)
		},
		async _grantAccess (event, origin, appName) {
			if (event.origin !== self.origin)
				throw new ConduitPrivateFunctionError()
			return await Auth.grantAccess(origin, appName)
		},
		async _denyAccess (event, origin) {
			if (event.origin !== self.origin)
				throw new ConduitPrivateFunctionError()
			return await Auth.denyAccess(origin)
		},
	},
})
