import type { Profile } from '@shared/Profile'
import type { EntityTable } from 'dexie'
import Dexie from 'dexie'

export interface ModelVersion {
	component: string
	version: string
	cacheTime: number
}

export interface ModelData {
	component: string
	data: unknown
}

export interface StoreProperty {
	key: string
	value: unknown
}

export const db = new Dexie('relic') as Dexie & {
	versions: EntityTable<ModelVersion, 'component'>
	data: EntityTable<ModelData, 'component'>
	store: EntityTable<StoreProperty, 'key'>
	profiles: EntityTable<Profile, 'id'>
}
db.version(1).stores({
	versions: 'component, version, cacheTime',
	data: 'component',
	store: 'key',
	profiles: 'id, name',
})
