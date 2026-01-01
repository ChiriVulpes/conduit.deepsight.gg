import type { ModelVersion } from 'utility/Database'
import { db } from 'utility/Database'

export interface ModelValue<T> {
	version: string
	value: T | (() => Promise<T>)
}

interface Model<T> {
	id: string
	get (): Promise<T>
	use (hard?: true): Promise<{ version: string, value: T, updated: boolean }>
}

interface ModelDefinition<T> {
	cacheDirtyTime: number
	fetch (): Promise<ModelValue<T>>
	tweak?(value: T): unknown
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

function Model<T> (id: string, def: ModelDefinition<T>): Model<T> {
	let promise: Promise<{ version: string, value: T, updated: boolean }> | undefined
	let currentUpdateId: string | undefined
	let currentIsSoft = false
	return Object.assign(def, {
		id,
		async get () {
			const value = (await this.use()).value
			await def.tweak?.(value)
			return value
		},
		async use (hard?: true) {
			if (hard && currentIsSoft) {
				promise = undefined
				currentUpdateId = undefined
				currentIsSoft = false
			}

			let updateId: string | undefined
			return promise ??= (async () => {
				currentUpdateId = updateId = `${Date.now().toString(36)}-${(+(performance.now() % 1).toFixed(2) * 100).toString(36)}-${Math.random().toString(36).slice(2)}`
				let delayCount = 0
				while (true) {
					try {
						return await tryUpdate(updateId, hard)
					}
					catch (err) {
						console.error(err)
						await sleep(Math.min(1000 * 2 ** delayCount++, 1000 * 60 * 5))
					}
				}
			})()
		},
	} satisfies Model<T>)

	async function tryUpdate (updateId?: string, hard = false) {
		if (currentUpdateId !== updateId && promise)
			return promise

		let version: ModelVersion | undefined
		let result: T | undefined
		await db.transaction('r', db.versions, db.data, async db => {
			version = await db.versions.get(id)
			const cacheExpiryTime = (version?.cacheTime ?? 0) + def.cacheDirtyTime
			if (Date.now() < cacheExpiryTime && !hard) {
				currentIsSoft = !hard
				result = await db.data.get(id).then(data => data?.data as T | undefined)
			}
		})

		if (currentUpdateId !== updateId && promise)
			// switch to newer update, probably a hard update now
			return promise

		if (result !== undefined) {
			promise = undefined
			currentUpdateId = undefined
			return { version: version!.version, value: result, updated: false }
		}

		// if we reach here, this is functionally a hard update, so no cancelling anymore.
		// technically `currentIsSoft` should already be `false`, but let's make it explicit:
		currentIsSoft = false

		const newVersion = await def.fetch()
		if (version?.version === newVersion.version)
			result = await db.data.get(id).then(data => data?.data as T | undefined)

		if (result !== undefined) {
			promise = undefined
			currentUpdateId = undefined
			return { version: newVersion.version, value: result, updated: false }
		}

		result = typeof newVersion.value === 'function' ? await (newVersion.value as () => T)() : newVersion.value
		await db.transaction('rw', db.versions, db.data, async db => {
			await db.versions.put({ component: id, version: newVersion.version, cacheTime: Date.now() })
			await db.data.put({ component: id, data: result })
		})

		promise = undefined
		currentUpdateId = undefined
		return { version: newVersion.version, value: result, updated: true }
	}
}

export default Model
