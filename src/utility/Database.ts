import type { EntityTable } from 'dexie'
import Dexie from 'dexie'

export interface Versions {
	component: string
	version: string
}

export const db = new Dexie('relic') as Dexie & {
	versions: EntityTable<Versions, 'component'>
}
db.version(1).stores({
	versions: 'component, version',
})
