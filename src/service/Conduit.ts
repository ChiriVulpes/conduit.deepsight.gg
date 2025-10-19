import type { ConduitBroadcastRegistry, ConduitFunctionRegistry } from '@shared/ConduitMessageRegistry'
import type { Profile } from '@shared/Profile'
import Auth from 'model/Auth'
import Collections from 'model/Collections'
import Definitions from 'model/Definitions'
import DefinitionsComponentNames from 'model/DefinitionsComponentNames'
import Profiles from 'model/Profiles'
import { db } from 'utility/Database'
import Env from 'utility/Env'
import Service, { SKIP_CLIENT } from 'utility/Service'
import Store from 'utility/Store'

if (!Env.BUNGIE_API_KEY)
	throw new Error('BUNGIE_API_KEY is not set')

class ConduitPrivateFunctionError extends Error {

	constructor () {
		super('This is an internal action that can only be performed by the conduit iframe')
	}

}

class ConduitFunctionRequiresTrustedOriginError extends Error {

	constructor () {
		super('This action can only be performed by a trusted origin')
	}

}

const service = Service<ConduitFunctionRegistry, ConduitBroadcastRegistry>({
	async onInstall (service, event) {
	},
	async onActivate (service, event) {
		console.log(await Definitions.en.DestinySeasonDefinition.get())
	},
	onRegistered (service) {
		void service.broadcast.ready()
	},
	onCall: {

		////////////////////////////////////
		//#region Profiles
		async getProfiles (event) {
			void updateProfiles()
			const profiles = (await db.profiles.toArray())
				.sort((a, b) => +!!b.authed - +!!a.authed)
			return getProfilesForOrigin(profiles, event.origin)
		},
		updateProfiles: () => updateProfiles(),
		async getProfile (event, displayName, displayNameCode): Promise<Profile | undefined> {
			const profile = await Profiles.searchDestinyPlayerByBungieName(displayName, displayNameCode)

			if (!profile || await Auth.getOriginAccess(event.origin))
				return profile

			return { ...profile, authed: undefined }
		},
		async bumpProfile (event, displayName, displayNameCode) {
			await Profiles.searchDestinyPlayerByBungieName(displayName, displayNameCode)
		},
		//#endregion
		////////////////////////////////////

		async getCollections (event) {
			return await Collections.get()
		},

		async getComponentNames () {
			return await DefinitionsComponentNames.get()
		},

		////////////////////////////////////
		//#region Private

		setOrigin (event) { },
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
			const authed = !!await Auth.complete(code)
			if (authed)
				await updateProfiles()
			return authed
		},
		async _grantAccess (event, origin, appName) {
			if (event.origin !== self.origin)
				throw new ConduitPrivateFunctionError()
			const granted = await Auth.grantAccess(origin, appName)
			if (granted) {
				await updateProfiles(origin)
			}
		},
		async _denyAccess (event, origin) {
			if (event.origin !== self.origin)
				throw new ConduitPrivateFunctionError()
			return await Auth.denyAccess(origin)
		},
		async _getDefinitionsComponent (event, language, component) {
			return await Definitions[language][component].get()
		},
		async _getDefinition (event, language, component, hash) {
			const defs = await Definitions[language][component].get()
			return defs[hash as keyof typeof defs]
		},
		async _getFilteredDefinitionsComponent (event, language, component, filter) {
			if (!await Auth.isOriginTrusted(event.origin))
				throw new ConduitFunctionRequiresTrustedOriginError()

			const predicate = eval(filter) as (def: any) => boolean
			if (typeof predicate !== 'function')
				throw new Error('Filter did not evaluate to a function')

			const defs = await Definitions[language][component].get()
			return Object.fromEntries(Object.values(defs)
				.filter(predicate)
				.map(def => [(def as { hash: number }).hash, def] as const))
		},

		//#endregion
		////////////////////////////////////

	},
})

async function updateProfiles (forceOriginUpdate?: string) {
	let [{ profiles, updated }, auth] = await Promise.all([
		Profiles.get(),
		Auth.getValid(),
	])

	profiles.sort((a, b) => new Date(b.lastAccess).getTime() - new Date(a.lastAccess).getTime())

	if (!auth)
		return

	let profile = profiles.find(profile => profile.name === auth.displayName && profile.code === auth.displayNameCode)
	if (!profile) {
		profile = await Profiles.getCurrentProfile(auth)
		if (profile) {
			updated = true
			const existingProfileIndex = profiles.findIndex(p => p.id === profile!.id)
			if (existingProfileIndex === -1)
				// authed a completely new profile
				profiles.push(profile)
			else
				// authed an existing profile with a new name/code
				profiles[existingProfileIndex] = profile
		}
	}

	if (profile && !profile.authed) {
		profile.authed = true
		updated = true
	}

	if (updated)
		void db.profiles.bulkPut(profiles)

	if (updated || forceOriginUpdate)
		void service.broadcast.profilesUpdated(async origin => {
			if (forceOriginUpdate && forceOriginUpdate !== origin)
				return SKIP_CLIENT

			return getProfilesForOrigin(profiles, origin)
		})
}

async function getProfilesForOrigin (profiles: Profile[], origin: string): Promise<Profile[]> {
	const grantedAccess = await Auth.getOriginAccess(origin)
	if (grantedAccess)
		return profiles

	return profiles.map(profile => ({
		...profile,
		authed: undefined,
	}))
}
