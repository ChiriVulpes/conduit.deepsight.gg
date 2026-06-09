import type { OfflineCacheCounts, OfflineCacheFailure, OfflineCacheProgress, OfflineCacheRun, OfflineCacheStage, OfflineCacheSummary } from '@shared/ConduitMessageRegistry'
import type { Profile } from '@shared/Profile'
import { PlatformErrorCodes, type ServerResponse } from 'bungie-api-ts/common'
import type { DestinyActivityHistoryResults, DestinyHistoricalStatsPeriodGroup, DestinyPostGameCarnageReportData } from 'bungie-api-ts/destiny2'
import Collections from 'model/Collections'
import { getVersions } from 'model/CombinedManifestVersion'
import Definitions from 'model/Definitions'
import DefinitionsComponentNames from 'model/DefinitionsComponentNames'
import DestinyProfileFull from 'model/DestinyProfileFull'
import Inventory from 'model/Inventory'
import Auth from 'model/Auth'
import Bungie from 'utility/Bungie'
import { db } from 'utility/Database'
import Log from 'utility/Log'
import Network from 'utility/Network'
import Store from 'utility/Store'

const ACTIVITY_PAGE_SIZE = 250
const DEFINITION_CONCURRENCY = 16
const PGCR_CONCURRENCY = 32
const PGCR_ORIGIN = 'https://stats.bungie.net/Platform/Destiny2/Stats/PostGameCarnageReport'

type ProgressCallback = (progress: OfflineCacheProgress) => unknown

declare module 'utility/Store' {
	export interface LocalStorage {
		offlineCacheProgress: OfflineCacheProgress
		offlineCacheSummary: OfflineCacheSummary
		offlineCacheRun: OfflineCacheRun
	}
}

export interface ActivityHistoryCache {
	cachedAt: string
	activities: DestinyHistoricalStatsPeriodGroup[]
}

export interface PgcrUnavailable {
	unavailable: true
	cachedAt: string
	message: string
}

namespace OfflineCache {

	const clearDataPrefixes = [
		'destiny2/profile-full:',
		'destiny2/activity-history:',
		'destiny2/pgcr:',
		'destiny2/pgcr-unavailable:',
	]

	let activeRun: { state: OfflineCacheRun, promise: Promise<OfflineCacheSummary> } | undefined

	export async function getState () {
		const [run, progress, summary] = await Promise.all([
			Store.offlineCacheRun.get(),
			Store.offlineCacheProgress.get(),
			Store.offlineCacheSummary.get(),
		])

		return { run, progress, summary }
	}

	export async function clear () {
		if (activeRun)
			throw new Error('Cannot clear offline cache while a cache run is active')

		await db.transaction('rw', db.data, db.versions, async db => {
			const dataKeys = await db.data
				.filter(entry => clearDataPrefixes.some(prefix => entry.component.startsWith(prefix)))
				.primaryKeys()
			const versionKeys = await db.versions
				.filter(entry => entry.component.startsWith('destiny2/profile-full:'))
				.primaryKeys()

			await Promise.all([
				db.data.bulkDelete(dataKeys as string[]),
				db.versions.bulkDelete(versionKeys as string[]),
			])
		})

		await Promise.all([
			Store.offlineCacheRun.delete(),
			Store.offlineCacheProgress.delete(),
			Store.offlineCacheSummary.delete(),
		])
	}

	export async function start (progressCallback: ProgressCallback, completeCallback: (summary: OfflineCacheSummary) => unknown): Promise<OfflineCacheRun> {
		if (activeRun)
			return { ...activeRun.state, alreadyRunning: true }

		const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
		const state: OfflineCacheRun = {
			runId,
			startedAt: new Date().toISOString(),
			running: true,
		}
		await Store.offlineCacheRun.set(state)
		const promise = runInner(state, progressCallback)
			.then(async summary => {
				const completedState = { ...state, running: false }
				await Store.offlineCacheRun.set(completedState)
				await completeCallback(summary)
				return summary
			})
			.catch(async err => {
				await Store.offlineCacheRun.set({ ...state, running: false })
				throw err
			})
			.finally(() => activeRun = undefined)
		activeRun = { state, promise }
		void promise.catch(err => Log.warn('Offline cache failed', state.runId, err))
		return state
	}

	async function runInner (run: OfflineCacheRun, progressCallback: ProgressCallback): Promise<OfflineCacheSummary> {
		const counts = emptyCounts()
		const failures: OfflineCacheFailure[] = []
		const pgcrIds = new Set<string>()
		let lastProgressPersist = 0

		const progress = async (stage: OfflineCacheStage, label: string, current: number, total?: number, detail?: string) => {
			const payload: OfflineCacheProgress = {
				runId: run.runId,
				stage,
				label,
				current,
				total,
				detail,
				counts: { ...counts },
			}
			Log.info('Offline cache progress', run.runId, stage, `${current}/${total ?? '?'}`, detail ?? label)
			const shouldPersist = stage !== 'pgcr' || Date.now() - lastProgressPersist > 1000 || current === total
			if (shouldPersist) {
				lastProgressPersist = Date.now()
				await Store.offlineCacheProgress.set(payload)
			}
			await progressCallback(payload)
		}

		const fail = (stage: OfflineCacheStage, key: string, err: unknown) => {
			const failure = {
				stage,
				key,
				message: errorMessage(err),
			}
			failures.push(failure)
			counts.failures = failures.length
			Log.warn('Offline cache failure', run.runId, stage, key, failure.message)
		}

		await progress('versions', 'Checking cached versions', 0, 1)
		await getVersions()
			.catch(err => fail('versions', 'versions', err))

		const componentNames = await DefinitionsComponentNames.get()
			.catch(err => {
				fail('definitions', 'component-names', err)
				return []
			})
		counts.definitionsTotal = componentNames.length
		let definitionsComplete = 0
		await progress('definitions', 'Caching definitions', definitionsComplete, componentNames.length)
		await parallelLimit(componentNames, DEFINITION_CONCURRENCY, async componentName => {
			await (Definitions.en[componentName] as any).get()
				.then(() => counts.definitionsCached++)
				.catch((err: unknown) => fail('definitions', componentName, err))
			definitionsComplete++
			await progress('definitions', 'Caching definitions', definitionsComplete, componentNames.length, componentName)
		})
		await progress('definitions', 'Caching definitions', componentNames.length, componentNames.length)

		const profiles = await getProfiles(fail)
		counts.profiles = profiles.length
		for (let i = 0; i < profiles.length; i++) {
			const profile = profiles[i]
			await progress('profiles', 'Caching profiles', i, profiles.length, profileKey(profile))
			await DestinyProfileFull.for(profile).get()
				.catch(err => fail('profiles', profileKey(profile), err))
		}
		await progress('profiles', 'Caching profiles', profiles.length, profiles.length)

		for (let i = 0; i < profiles.length; i++) {
			const profile = profiles[i]
			await progress('inventory', 'Caching inventory', i, profiles.length, profileKey(profile))
			await Inventory.for(profile).get()
				.then(() => counts.inventoriesCached++)
				.catch(err => fail('inventory', profileKey(profile), err))
		}
		await progress('inventory', 'Caching inventory', profiles.length, profiles.length)

		for (let i = 0; i < profiles.length; i++) {
			const profile = profiles[i]
			await progress('collections', 'Caching collections', i, profiles.length, profileKey(profile))
			await Collections.for(profile).get()
				.then(() => counts.collectionsCached++)
				.catch(err => fail('collections', profileKey(profile), err))
		}
		await progress('collections', 'Caching collections', profiles.length, profiles.length)

		for (let i = 0; i < profiles.length; i++) {
			const profile = profiles[i]
			const characters = profile.authed ? profile.characters : []
			for (let c = 0; c < characters.length; c++) {
				const character = characters[c]
				await progress('activity-history', 'Caching activity history', c, characters.length, character.id)
				const activities = await cacheActivityHistory(profile, character.id, counts, fail)
				for (const activity of activities)
					pgcrIds.add(activity.activityDetails.instanceId)
			}
			await progress('activity-history', 'Caching activity history', characters.length, characters.length, profileKey(profile))
		}

		const pgcrIdList = [...pgcrIds].sort((a, b) => +a - +b)
		counts.pgcrsDiscovered = pgcrIdList.length
		await cachePgcrs(pgcrIdList, counts, fail, progress)

		const summary: OfflineCacheSummary = {
			runId: run.runId,
			startedAt: run.startedAt,
			finishedAt: new Date().toISOString(),
			counts: { ...counts },
			failures,
		}
		await Store.offlineCacheSummary.set(summary)
		await progress('complete', 'Offline cache complete', 1, 1, `${counts.pgcrsDownloaded} PGCRs downloaded`)
		return summary
	}

	async function getProfiles (fail: (stage: OfflineCacheStage, key: string, err: unknown) => void): Promise<Profile[]> {
		const profiles = await db.profiles.toArray()
		const auth = await Auth.getValid().catch(err => {
			fail('profiles', 'auth', err)
			return undefined
		})
		const current = auth?.profileId
			? await db.profiles.get(auth.profileId).catch(err => {
				fail('profiles', 'current', err)
				return undefined
			})
			: undefined

		const byId = new Map<string, Profile>()
		for (const profile of profiles)
			byId.set(profile.id, profile)
		if (current)
			byId.set(current.id, current)

		return [...byId.values()].sort((a, b) => +!!b.authed - +!!a.authed)
	}

	async function cacheActivityHistory (
		profile: Profile,
		characterId: string,
		counts: OfflineCacheCounts,
		fail: (stage: OfflineCacheStage, key: string, err: unknown) => void
	): Promise<DestinyHistoricalStatsPeriodGroup[]> {
		const key = activityHistoryKey(profile, characterId)
		const cached = await getCachedData<ActivityHistoryCache>(key)
		const activities: DestinyHistoricalStatsPeriodGroup[] = []
		try {
			for (let page = 0; ; page++) {
				const result = await Bungie.getForUser<DestinyActivityHistoryResults>(
					`/Destiny2/${profile.type}/Account/${profile.id}/Character/${characterId}/Stats/Activities/`,
					{
						count: ACTIVITY_PAGE_SIZE,
						page,
					},
				)
				const pageActivities = result?.activities ?? []
				counts.activityHistoryPages++
				counts.activityHistoryActivities += pageActivities.length
				activities.push(...pageActivities)
				if (pageActivities.length < ACTIVITY_PAGE_SIZE)
					break
			}

			await putCachedData(key, {
				cachedAt: new Date().toISOString(),
				activities,
			} satisfies ActivityHistoryCache)
			return activities
		}
		catch (err) {
			if (cached)
				return cached.activities

			fail('activity-history', key, err)
			return []
		}
	}

	async function cachePgcrs (
		pgcrIds: string[],
		counts: OfflineCacheCounts,
		fail: (stage: OfflineCacheStage, key: string, err: unknown) => void,
		progress: (stage: OfflineCacheStage, label: string, current: number, total?: number, detail?: string) => Promise<void>
	) {
		let cursor = 0
		let completed = 0
		await progress('pgcr', 'Caching PGCRs', 0, pgcrIds.length)
		await Promise.all(Array.from({ length: Math.min(PGCR_CONCURRENCY, pgcrIds.length) }, async () => {
			while (cursor < pgcrIds.length) {
				const pgcrId = pgcrIds[cursor++]
				await cachePgcr(pgcrId, counts, fail)
				completed++
				await progress('pgcr', 'Caching PGCRs', completed, pgcrIds.length, pgcrId)
			}
		}))
	}

	async function cachePgcr (
		pgcrId: string,
		counts: OfflineCacheCounts,
		fail: (stage: OfflineCacheStage, key: string, err: unknown) => void
	) {
		const key = pgcrKey(pgcrId)
		if (await getCachedData<DestinyPostGameCarnageReportData>(key)) {
			counts.pgcrsCached++
			return
		}

		const unavailableKey = pgcrUnavailableKey(pgcrId)
		if (await getCachedData<PgcrUnavailable>(unavailableKey)) {
			counts.pgcrsUnavailable++
			return
		}

		try {
			const pgcr = await fetchPgcr(pgcrId)
			await putCachedData(key, pgcr)
			counts.pgcrsDownloaded++
		}
		catch (err) {
			if (isUnavailablePgcr(err)) {
				await putCachedData(unavailableKey, {
					unavailable: true,
					cachedAt: new Date().toISOString(),
					message: errorMessage(err),
				} satisfies PgcrUnavailable)
				counts.pgcrsUnavailable++
				return
			}

			fail('pgcr', key, err)
		}
	}

	export async function fetchPgcr (pgcrId: string): Promise<DestinyPostGameCarnageReportData> {
		const headers = await Auth.getHeaders()
		const response = await Network.fetch(`${PGCR_ORIGIN}/${pgcrId}/`, { headers: { ...headers } })
		const json = await response.json().catch(() => undefined) as ServerResponse<DestinyPostGameCarnageReportData> | undefined
		if (!response.ok || !json)
			throw Object.assign(new Error(response.statusText || 'Unable to fetch PGCR'), { code: response.status })

		if (json.ErrorCode && json.ErrorCode !== PlatformErrorCodes.Success)
			throw Object.assign(new Error(json.Message), {
				name: json.ErrorStatus,
				code: json.ErrorCode,
			})

		return json.Response
	}

	export async function getCachedData<T> (component: string): Promise<T | undefined> {
		return await db.data.get(component).then(data => data?.data as T | undefined)
	}

	export async function putCachedData (component: string, data: unknown) {
		await db.data.put({ component, data })
	}

	async function parallelLimit<T> (items: T[], limit: number, worker: (item: T) => Promise<unknown>) {
		let cursor = 0
		await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
			while (cursor < items.length)
				await worker(items[cursor++])
		}))
	}

	function emptyCounts (): OfflineCacheCounts {
		return {
			profiles: 0,
			definitionsTotal: 0,
			definitionsCached: 0,
			inventoriesCached: 0,
			collectionsCached: 0,
			activityHistoryPages: 0,
			activityHistoryActivities: 0,
			pgcrsDiscovered: 0,
			pgcrsCached: 0,
			pgcrsDownloaded: 0,
			pgcrsUnavailable: 0,
			failures: 0,
		}
	}

	function profileKey (profile: Profile) {
		return `${profile.type}/${profile.id}`
	}

	export function activityHistoryKey (profile: Profile, characterId: string) {
		return `destiny2/activity-history:${profile.type}/${profile.id}/${characterId}`
	}

	export function pgcrKey (pgcrId: string) {
		return `destiny2/pgcr:${pgcrId}`
	}

	export function pgcrUnavailableKey (pgcrId: string) {
		return `destiny2/pgcr-unavailable:${pgcrId}`
	}

	export function errorMessage (err: unknown) {
		return err instanceof Error ? err.message : `${err}`
	}

	export function isUnavailablePgcr (err: unknown) {
		const message = errorMessage(err).toLowerCase()
		const code = typeof err === 'object' && err !== null && 'code' in err ? `${err.code}` : ''
		return code.startsWith('16')
			|| message.includes('privilege')
			|| message.includes('privacy')
			|| message.includes('not found')
			|| message.includes('unavailable')
	}

}

export default OfflineCache
