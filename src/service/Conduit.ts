import type { ConduitBroadcastRegistry, ConduitFunctionRegistry } from 'ConduitMessageRegistry'
import Auth from 'model/Auth'
import Definitions from 'model/Definitions'
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
		async getNeedsAuth (event, origin) {
			return !await Auth.isOriginAuthed(origin)
		},
	},
})
