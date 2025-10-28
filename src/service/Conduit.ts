import type { ConduitBroadcastRegistry, ConduitFunctionRegistry } from '@shared/ConduitMessageRegistry'
import type { AllComponentNames, DefinitionLinks } from '@shared/DefinitionComponents'
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
		async _getDefinitionsComponentPage (event, language, component, pageSize, page) {
			if (page < 0 || pageSize <= 0)
				return {
					definitions: {} as never,
					page,
					pageSize,
					totalPages: 0,
					totalDefinitions: 0,
				}

			const defs = await Definitions[language][component].get()
			const keys = Object.keys(defs)
			const totalPages = Math.ceil(keys.length / pageSize)
			if (totalPages === 1)
				return {
					definitions: defs as never,
					page: 0,
					pageSize,
					totalPages,
					totalDefinitions: keys.length,
				}

			if (page >= totalPages)
				return {
					definitions: {} as never,
					page,
					pageSize,
					totalPages,
					totalDefinitions: keys.length,
				}

			const pageDefs = Object.fromEntries(keys
				.slice(page * pageSize, (page + 1) * pageSize)
				.map(key => [key, defs[key as keyof typeof defs]] as const)
			)
			return {
				definitions: pageDefs as never,
				page,
				pageSize,
				totalPages,
				totalDefinitions: keys.length,
			}
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
		async _getDefinitionLinks (event, language, component, hash) {
			const defs = await Definitions[language][component].get()
			const def = defs[hash as keyof typeof defs]
			if (!def)
				return undefined

			const { components, enums } = await Definitions.en.DeepsightLinksDefinition.get()
			const linksDef = components[component]
			if (!linksDef)
				return undefined

			let augmentations: DefinitionLinks['augmentations'] | undefined
			const links: DefinitionLinks['links'] = linksDef.links
			let usedEnums: DefinitionLinks['enums'] | undefined
			let definitions: DefinitionLinks['definitions'] | undefined
			let defsToGrab: Map<AllComponentNames, Set<number | string>> | undefined

			for (const link of linksDef.links ?? []) {
				if ('enum' in link) {
					usedEnums ??= {}
					usedEnums[link.enum] ??= enums[link.enum]
				}
				else {
					const hashes = followLinkPath(def, link.path.split('.'))
					if (!hashes.length)
						continue

					defsToGrab ??= new Map()
					let set = defsToGrab.get(link.component)
					if (!set) {
						set = new Set()
						defsToGrab.set(link.component, set)
					}

					for (const hash of hashes)
						set.add(hash)
				}
			}

			await Promise.all([
				...(linksDef.augmentations ?? [])
					.map(async augmentationComponent => {
						const defs = await Definitions[language][augmentationComponent].get()
						const def = defs?.[hash as never]
						if (!def)
							return

						augmentations ??= {}
						augmentations[augmentationComponent] = def
					}),
				...(defsToGrab?.entries().toArray() ?? [])
					.map(async ([component, hashes]) => {
						const defs = await Definitions[language][component].get()
						for (const hash of hashes) {
							const def = defs[hash as keyof typeof defs]
							if (!def)
								continue
							definitions ??= {}
							if (!definitions[component])
								definitions[component] = {} as never
							definitions[component][hash as never] = def
						}
					}),
			])

			return {
				augmentations,
				links,
				enums: usedEnums,
				definitions,
			}

			function followLinkPath (obj: any = def, path: (string | number)[]): (number | string)[] {
				if (!path.length && (typeof obj === 'number' || typeof obj === 'string'))
					return [obj]

				if (!obj || typeof obj !== 'object')
					return []

				const key = path.shift()
				if (!key)
					return []

				if (key === '[]') {
					if (!Array.isArray(obj))
						return []

					if (!path.length)
						return obj.filter(item => typeof item === 'number' || typeof item === 'string')

					return obj.flatMap((item: any) => followLinkPath(item, path.slice()))
				}

				if (key === '{}') {
					if (!path.length)
						// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
						return Object.keys(obj)

					// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
					return Object.values(obj).flatMap(value => followLinkPath(value, path.slice()))
				}

				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				return followLinkPath(obj[key], path)
			}
		},
		async _getDefinitionWithLinks (event, language, component, hash) {
			const [def, links] = await Promise.all([
				this._getDefinition(event, language, component, hash),
				this._getDefinitionLinks(event, language, component, hash),
			])
			if (!def)
				return undefined

			return { definition: def, links }
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
