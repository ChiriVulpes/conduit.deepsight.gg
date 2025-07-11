import { db } from 'utility/Database'

export interface LocalStorage {
}

type StoreProxy = { [KEY in keyof LocalStorage]: {
	has (): Promise<boolean>
	get (): Promise<LocalStorage[KEY] | undefined>
	set (value: LocalStorage[KEY]): Promise<void>
	delete (): Promise<void>
} }

const methods = {
	has: async (key: string) => !!await db.store.get(key),
	get: async (key: string) => await db.store.get(key).then(item => item?.value),
	set: async (key: string, value: any) => await db.store.put({ key, value }),
	delete: async (key: string) => await db.store.delete(key),
}

const methodNames = Object.keys(methods) as (keyof typeof methods)[]
type CachedMethods = { [NAME in keyof typeof methods]: (...params: Parameters<(typeof methods)[NAME]> extends [unknown, ...infer PARAMS] ? PARAMS : never) => ReturnType<(typeof methods)[NAME]> }
const methodCache = new Map<string, CachedMethods>()

const Store = new Proxy({} as StoreProxy, {
	get (target, key) {
		if (typeof key !== 'string')
			return undefined

		let cache = methodCache.get(key)
		if (cache)
			return cache

		// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
		cache = Object.fromEntries(methodNames.map(methodName => [methodName, (methods[methodName] as any).bind(null, key)])) as any as CachedMethods
		methodCache.set(key, cache)
		return cache
	},
})

export default Store

Object.assign(self, { Store })
