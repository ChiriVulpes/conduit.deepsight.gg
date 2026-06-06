import type { ProfileOverride } from 'model/DestinyProfiles'
import type { Profile } from '@shared/Profile'
import Log from 'utility/Log'
import Store from 'utility/Store'

export interface ProfilePatchApplyContext {
	operationId?: string
	origin?: string
	step?: string
}

interface ProfilePatchDefinition<PARAMS extends object> {
	id: string
	fromParams (params: PARAMS): ProfileOverride
	toParams (override: ProfileOverride): PARAMS | undefined
	onApply? (profile: Profile, params: PARAMS, override: ProfileOverride, context: ProfilePatchApplyContext): unknown
}

export class ProfilePatch<PARAMS extends object> {

	static readonly registry: ProfilePatch<object>[] = []

	readonly id: string
	readonly fromParams: ProfilePatchDefinition<PARAMS>['fromParams']
	readonly toParams: ProfilePatchDefinition<PARAMS>['toParams']
	readonly onApply?: ProfilePatchDefinition<PARAMS>['onApply']

	constructor (definition: ProfilePatchDefinition<PARAMS>) {
		this.id = definition.id
		this.fromParams = definition.fromParams
		this.toParams = definition.toParams
		this.onApply = definition.onApply

		if (ProfilePatch.registry.some(patch => patch.id === this.id))
			Log.error(`Duplicate ProfilePatch id registered: ${this.id}`)

		ProfilePatch.registry.push(this as never)
	}

	async apply (profile: Profile, params: PARAMS, context: ProfilePatchApplyContext = {}) {
		const profileOverrides = await Store.destinyProfileOverrides.get() ?? {}
		const overrides = profileOverrides[profile.id] ??= []
		const override = this.fromParams(params)

		overrides.push(override)
		await Store.destinyProfileOverrides.set(profileOverrides)

		await ProfilePatch.dispatchApply(profile, override, context)
		return override
	}

	static async dispatchApply (profile: Profile, override: ProfileOverride, context: ProfilePatchApplyContext = {}) {
		await Promise.all(ProfilePatch.registry.map(async patch => {
			const params = patch.toParams(override)
			if (!params)
				return

			await patch.onApply?.(profile, params, override, context)
		}))
	}

}
