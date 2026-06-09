import type { ModelVersion } from 'utility/Database'
import { db } from 'utility/Database'

export interface ModelValue<T> {
	version: string
	value: T | (() => Promise<T>)
}

interface Model<T> {
	id: string
	get (): Promise<T>
	getCached (onUpdate?: (value: T) => unknown): Promise<T>
	getVersioned (cacheVersion?: string): Promise<ModelVersionedResponse<T>>
	getCachedVersioned (cacheVersion?: string, onUpdate?: (value: T) => unknown): Promise<ModelVersionedResponse<T>>
	use (hard?: true): Promise<{ version: string, value: T, updated: boolean }>
}

export type ModelVersionedResponse<T> =
	| {
		version: string
		value: T
	}
	| {
		version: string
		unchanged: true
	}

interface ModelDefinition<T> {
	cacheDirtyTime: number
	fetch (): Promise<ModelValue<T>>
	tweak?(value: T): unknown
}

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
		async getCached (onUpdate) {
			const cached = await db.data.get(id).then(data => data?.data as T | undefined)
			if (cached === undefined)
				return await this.get()

			void this.use()
				.then(async ({ value, updated }) => {
					await def.tweak?.(value)
					if (updated)
						await onUpdate?.(value)
				})
				.catch(console.error)

			await def.tweak?.(cached)
			return cached
		},
		async getVersioned (cacheVersion) {
			return versionedResponse(await this.use(), cacheVersion)
		},
		async getCachedVersioned (cacheVersion, onUpdate) {
			let version: ModelVersion | undefined
			let cached: T | undefined
			await db.transaction('r', db.versions, db.data, async db => {
				version = await db.versions.get(id)
				cached = await db.data.get(id).then(data => data?.data as T | undefined)
			})

			if (cached === undefined || !version)
				return await this.getVersioned(cacheVersion)

			void this.use()
				.then(async ({ value, updated }) => {
					await def.tweak?.(value)
					if (updated)
						await onUpdate?.(value)
				})
				.catch(console.error)

			await def.tweak?.(cached)
			return cacheVersion === version.version
				? {
					version: version.version,
					unchanged: true,
				}
				: {
					version: version.version,
					value: cached,
				}
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
				try {
					return await tryUpdate(updateId, hard)
				}
				catch (err) {
					promise = undefined
					currentUpdateId = undefined
					currentIsSoft = false
					throw err
				}
			})()
		},
	} satisfies Model<T>)

	async function getCachedValue () {
		let version: ModelVersion | undefined
		let result: T | undefined
		await db.transaction('r', db.versions, db.data, async db => {
			version = await db.versions.get(id)
			result = await db.data.get(id).then(data => data?.data as T | undefined)
		})

		if (result === undefined || !version)
			return undefined

		return {
			version: version.version,
			value: result,
		}
	}

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

		let newVersion: ModelValue<T>
		try {
			newVersion = await def.fetch()
		}
		catch (err) {
			const cached = await getCachedValue()
			if (cached) {
				console.warn(`Using stale cache for ${id} after update failed`, err)
				promise = undefined
				currentUpdateId = undefined
				return { ...cached, updated: false }
			}

			throw err
		}

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

	async function versionedResponse (result: { version: string, value: T }, cacheVersion?: string): Promise<ModelVersionedResponse<T>> {
		await def.tweak?.(result.value)
		return cacheVersion === result.version
			? {
				version: result.version,
				unchanged: true,
			}
			: {
				version: result.version,
				value: result.value,
			}
	}
}

export default Model
