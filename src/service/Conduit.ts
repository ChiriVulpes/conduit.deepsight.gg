import type { ConduitBroadcastRegistry, ConduitFunctionRegistry } from '@shared/ConduitMessageRegistry'
import Auth from 'model/Auth'
import Definitions from 'model/Definitions'
import Profiles from 'model/Profiles'
import Env from 'utility/Env'
import Service from 'utility/Service'
import Store from 'utility/Store'

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
		console.log(await Definitions.en.DestinySeasonDefinition.get())
	},
	onRegistered (service) {
		void service.broadcast.ready()
	},
	onCall: {
		async getProfiles (event) {
			const [profiles, auth] = await Promise.all([
				Profiles.get(),
				Auth.getValid(),
			])

			if (!auth)
				return profiles

			let profile = profiles.find(profile => profile.name === auth.displayName && profile.code === auth.displayNameCode)
			if (!profile) {
				profile = await Profiles.getCurrentProfile(auth)
				const existingProfile = profiles.find(p => p.id === profile!.id)
				if (profile && !existingProfile)
					profiles.push(profile)
				else
					profile = existingProfile
			}

			if (profile)
				profile.authed = true

			return profiles
		},
		async getProfile (event, displayName, displayNameCode) {
			return await Profiles.searchDestinyPlayerByBungieName(displayName, displayNameCode)
		},
		async bumpProfile (event, displayName, displayNameCode) {
			await Profiles.searchDestinyPlayerByBungieName(displayName, displayNameCode)
		},
		async _getAuthState (event) {
			if (event.origin !== self.origin)
				throw new ConduitPrivateFunctionError()
			return await Auth.getAuthState()
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
			return !!await Auth.complete(code)
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
