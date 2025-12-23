import type { Profile } from '@shared/Profile'
import type { ModelValue } from 'model/Model'
import Model from 'model/Model'

interface ProfiledModelDefinition<T> {
	cacheDirtyTime: number
	fetch (profile?: Profile): Promise<ModelValue<T>>
}

export function ProfiledModel<T> (name: string, definition: ProfiledModelDefinition<T>) {
	const cache: Record<string, Model<T>> = {}
	return {
		for (profile?: Profile) {
			const membershipTypeAndId = !profile ? 'none' : `${profile.type}/${profile.id}`
			return cache[membershipTypeAndId] ??= Model<T>(`${name}:${membershipTypeAndId}`, {
				cacheDirtyTime: definition.cacheDirtyTime,
				fetch: () => definition.fetch(profile),
			})
		},
	}
}
