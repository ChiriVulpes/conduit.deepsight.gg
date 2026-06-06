import type { ProfileOverride, ProfilePatchRecord } from 'model/DestinyProfiles'
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
	fromParams (params: PARAMS, time: number): ProfileOverride | ProfileOverride[]
	toParams (record: ProfilePatchRecord): PARAMS | undefined
	onApply? (profile: Profile, params: PARAMS, record: ProfilePatchRecord, context: ProfilePatchApplyContext): unknown
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
		const time = Date.now()
		const record: ProfilePatchRecord = {
			id: this.id,
			time,
			overrides: array(this.fromParams(params, time)),
		}

		overrides.push(record)
		await Store.destinyProfileOverrides.set(profileOverrides)

		await this.dispatchApply(profile, record, context)
		return record
	}

	async dispatchApply (profile: Profile, record: ProfilePatchRecord, context: ProfilePatchApplyContext = {}) {
		const params = this.toParams(record)
		if (!params)
			return

		await this.onApply?.(profile, params, record, context)
	}

}

function array<T> (value: T | T[]): T[] {
	return Array.isArray(value) ? value : [value]
}
