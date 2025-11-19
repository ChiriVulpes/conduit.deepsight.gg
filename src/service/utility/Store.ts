import type { ConduitSettings } from '@shared/Settings'
import { db } from 'utility/Database'

export interface LocalStorage extends ConduitSettings {
}

export interface StoreState<T> {
	value: T | undefined
}

const trackedStoreStates: { [KEY in keyof LocalStorage]?: StoreState<LocalStorage[KEY]> } = {}

type StoreProxy = { [KEY in keyof LocalStorage]: {
	has (): Promise<boolean>
	get (): Promise<LocalStorage[KEY] | undefined>
	set (value: LocalStorage[KEY]): Promise<void>
	delete (): Promise<void>
	state<T> (orElse: T): StoreState<LocalStorage[KEY] | T>
	state (): Promise<StoreState<LocalStorage[KEY]>>
} }

const methods = {
	has: async (key: string) => !!await db.store.get(key),
	get: async (key: string) => await db.store.get(key).then(item => item?.value),
	set: async (key: string, value: any) => {
		await db.store.put({ key, value })
		const tracked = trackedStoreStates[key as keyof LocalStorage]
		if (tracked)
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			tracked.value = value
		for (const handler of updateStoreHandlers)
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			void handler(key as keyof LocalStorage, value)
	},
	delete: async (key: string) => {
		await db.store.delete(key)
		const tracked = trackedStoreStates[key as keyof LocalStorage]
		if (tracked)
			tracked.value = undefined
		for (const handler of updateStoreHandlers)
			void handler(key as keyof LocalStorage, undefined)
	},
	state: (...args: [key: string] | [key: string, orElse: unknown]) => {
		const [key, orElse] = args

		let state: StoreState<unknown> | undefined = trackedStoreStates[key as keyof LocalStorage]
		if (state)
			return state

		if (args.length === 2) {
			state = { value: orElse } as StoreState<any>
			trackedStoreStates[key as keyof LocalStorage] = state as StoreState<never>
			return state
		}

		return methods.get(key).then(value => {
			state = { value } as StoreState<any>
			trackedStoreStates[key as keyof LocalStorage] = state as StoreState<never>
			return state
		})
	},
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

type UpdateStoreHandler = (key: keyof LocalStorage, value: LocalStorage[keyof LocalStorage]) => unknown
const updateStoreHandlers: UpdateStoreHandler[] = []
export function onUpdateStore (callback: UpdateStoreHandler) {
	updateStoreHandlers.push(callback)
}

Object.assign(self, { Store })
