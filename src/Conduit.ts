import Service from './Service'

Service({
	async onInstall (service, event) {
	},
	async onActivate (service, event) {
		service.postMessageAll('activated')
	},
})
