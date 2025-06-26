import type { ConduitBroadcastRegistry, ConduitFunctionRegistry } from 'ConduitMessageRegistry'
import Definitions from 'model/Definitions'
import Env from 'utility/Env'
import Service from './utility/Service'

if (!Env.BUNGIE_API_KEY)
	throw new Error('BUNGIE_API_KEY is not set')

Service<ConduitFunctionRegistry, ConduitBroadcastRegistry>({
	async onInstall (service, event) {
	},
	async onActivate (service, event) {
		service.broadcast.testBroadcast('7')
		console.log(await Definitions.DestinySeasonDefinition.en.get())
	},
	onCall: {
		testFunction: (event, message) => {
			console.log(event)
		},
	},
})
