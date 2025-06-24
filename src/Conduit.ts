import type { ConduitBroadcastRegistry, ConduitFunctionRegistry } from 'ConduitMessageRegistry'
import Service from './utility/Service'

Service<ConduitFunctionRegistry, ConduitBroadcastRegistry>({
	async onInstall (service, event) {
	},
	async onActivate (service, event) {
		service.broadcast.testBroadcast('3')
	},
	onCall: {
		testFunction: data => {
			console.log('Test function called:', data)
			return data + ' and this is server data appended'
		},
	},
})
