import type { ConduitBroadcastRegistry, ConduitFunctionRegistry } from '@shared/ConduitMessageRegistry'
import Auth from 'model/Auth'
import Definitions from 'model/Definitions'
import { db } from 'utility/Database'
import Env from 'utility/Env'
import Service from './utility/Service'

if (!Env.BUNGIE_API_KEY)
	throw new Error('BUNGIE_API_KEY is not set')

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
		async getOriginAccess (event, origin) {
			if (origin !== self.origin && event.origin !== self.origin)
				throw new Error('This action can only be performed using a code provided by an iframe from the deepsight.gg conduit origin')
			return await Auth.getOriginAccess(origin)
		},
		async getOriginGrants (event) {
			if (event.origin !== self.origin)
				throw new Error('This action can only be performed using a code provided by an iframe from the deepsight.gg conduit origin')
			return await Auth.getOriginGrants()
		},
		async getProfiles (event) {
			return await db.profiles.toArray()
		},
		async _authenticate (event, code) {
			if (event.origin !== self.origin)
				throw new Error('This action can only be performed using a code provided by an iframe from the deepsight.gg conduit origin')
			return await Auth.complete(code)
		},
		async _grantAccess (event, origin, appName) {
			if (event.origin !== self.origin)
				throw new Error('This action can only be performed using a code provided by an iframe from the deepsight.gg conduit origin')
			return await Auth.grantAccess(origin, appName)
		},
		async _denyAccess (event, origin) {
			if (event.origin !== self.origin)
				throw new Error('This action can only be performed using a code provided by an iframe from the deepsight.gg conduit origin')
			return await Auth.denyAccess(origin)
		},
	},
})
