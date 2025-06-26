import type { ModelVersion } from 'utility/Database'
import { db } from 'utility/Database'

interface ModelValue<T> {
	version: string
	value: T | (() => Promise<T>)
}

interface Model<T> {
	id: string
	get (): Promise<T>
	use (): Promise<{ version: string, value: T }>
}

interface ModelDefinition<T> {
	cacheDirtyTime: number
	fetch (): Promise<ModelValue<T>>
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

function Model<T> (id: string, def: ModelDefinition<T>): Model<T> {
	let promise: Promise<{ version: string, value: T }> | undefined
	return Object.assign(def, {
		id,
		async get () {
			return (await this.use()).value
		},
		async use () {
			return promise ??= (async () => {
				let delayCount = 0
				while (true) {
					try {
						return await tryUpdate()
					}
					catch (err) {
						console.error(err)
						await sleep(Math.min(1000 * 2 ** delayCount++, 1000 * 60 * 5))
					}
				}
			})()
		},
	} satisfies Model<T>)

	async function tryUpdate () {
		let version: ModelVersion | undefined
		let result: T | undefined
		await db.transaction('r', db.versions, db.data, async db => {
			version = await db.versions.get(id)
			const cacheExpiryTime = (version?.cacheTime ?? 0) + def.cacheDirtyTime
			if (Date.now() < cacheExpiryTime)
				result = await db.data.get(id).then(data => data?.data as T | undefined)
		})

		if (result !== undefined) {
			promise = undefined
			return { version: version!.version, value: result }
		}

		const newVersion = await def.fetch()
		if (version?.version === newVersion.version)
			result = await db.data.get(id).then(data => data?.data as T | undefined)

		if (result !== undefined) {
			promise = undefined
			return { version: newVersion.version, value: result }
		}

		result = typeof newVersion.value === 'function' ? await (newVersion.value as () => T)() : newVersion.value
		await db.transaction('rw', db.versions, db.data, async db => {
			await db.versions.put({ component: id, version: newVersion.version, cacheTime: Date.now() })
			await db.data.put({ component: id, data: result })
		})

		promise = undefined
		return { version: newVersion.version, value: result }
	}
}

export default Model
