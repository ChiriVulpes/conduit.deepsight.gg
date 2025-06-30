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
		async getOriginNeedsAuth (event, origin) {
			return !await Auth.isOriginAuthed(origin)
		},
		async getProfiles (event) {
			return await db.profiles.toArray()
		},
	},
})
