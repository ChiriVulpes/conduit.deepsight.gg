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
		async getOriginAccess (event, origin) {
			return await Auth.getOriginAccess(origin)
		},
		async isAuthenticated (event) {
			return await Auth.checkBungie()
		},
		async getProfiles (event) {
			return await db.profiles.toArray()
		},
		async authenticate (event, code) {
			if (event.origin !== self.origin)
				throw new Error('This action can only be performed using a code provided by an iframe from the deepsight.gg conduit origin')
			return await Auth.complete(code)
		},
		async grantAccess (event, origin) {
			if (event.origin !== self.origin)
				throw new Error('This action can only be performed using a code provided by an iframe from the deepsight.gg conduit origin')
			return await Auth.grantAccess(origin)
		},
		async denyAccess (event, origin) {
			if (event.origin !== self.origin)
				throw new Error('This action can only be performed using a code provided by an iframe from the deepsight.gg conduit origin')
			return await Auth.denyAccess(origin)
		},
	},
})
