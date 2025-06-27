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

export const db = new Dexie('relic') as Dexie & {
	versions: EntityTable<ModelVersion, 'component'>
	data: EntityTable<ModelData, 'component'>
}
db.version(1).stores({
	versions: 'component, version, cacheTime',
	data: 'component',
})
