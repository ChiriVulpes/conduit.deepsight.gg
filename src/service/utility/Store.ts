import { db } from 'utility/Database'

export interface LocalStorage {
}

type StoreProxy = (
	& { [KEY in keyof LocalStorage as `has${Capitalize<KEY & string>}`]: () => Promise<boolean> }
	& { [KEY in keyof LocalStorage as `get${Capitalize<KEY & string>}`]: () => Promise<LocalStorage[KEY] | undefined> }
	& { [KEY in keyof LocalStorage as `set${Capitalize<KEY & string>}`]: (value: LocalStorage[KEY]) => Promise<void> }
	& { [KEY in keyof LocalStorage as `delete${Capitalize<KEY & string>}`]: () => Promise<void> }
) extends infer STORE ? { [KEY in keyof STORE]: STORE[KEY] } : never

const methods = {
	has: async (key: string) => !!await db.store.get(key),
	get: async (key: string) => await db.store.get(key).then(item => item?.value),
	set: async (key: string, value: any) => await db.store.put({ key, value }),
	delete: async (key: string) => await db.store.delete(key),
}

const methodNames = Object.keys(methods) as (keyof typeof methods)[]
const methodCache = new Map<string, (...params: any[]) => any>()

const Store = new Proxy({} as StoreProxy, {
	get (target, key) {
		if (typeof key !== 'string')
			return undefined

		const method = methodCache.get(key)
		if (method)
			return method

		for (const methodName of methodNames)
			if (key.startsWith(methodName)) {
				const realKey = key[methodName.length].toLowerCase() + key.slice(methodName.length + 1)
				// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
				const boundMethod = (methods[methodName] as any).bind(null, realKey) as (...params: any[]) => any
				methodCache.set(key, boundMethod)
				return boundMethod
			}
	},
})

export default Store

Object.assign(self, { Store })
