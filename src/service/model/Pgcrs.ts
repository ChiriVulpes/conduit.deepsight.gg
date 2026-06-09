import type { PgcrsPage, PgcrsPageEntry } from '@shared/ConduitMessageRegistry'
import type { Profile } from '@shared/Profile'
import type { DestinyActivityHistoryResults, DestinyHistoricalStatsPeriodGroup, DestinyPostGameCarnageReportData } from 'bungie-api-ts/destiny2'
import type { ActivityHistoryCache, PgcrUnavailable } from 'model/OfflineCache'
import OfflineCache from 'model/OfflineCache'
import Bungie from 'utility/Bungie'

const ACTIVITY_PAGE_SIZE = 250
const MAX_PAGE_SIZE = 250

interface ActivitySource {
	characterId: string
	activities: DestinyHistoricalStatsPeriodGroup[]
	exhausted: boolean
}

interface ActivityEntry {
	characterId: string
	activity: DestinyHistoricalStatsPeriodGroup
}

namespace Pgcrs {

	export async function get (profile: Profile, pageSize = MAX_PAGE_SIZE, page = 0): Promise<PgcrsPage> {
		pageSize = Math.min(Math.max(Math.trunc(pageSize), 1), MAX_PAGE_SIZE)
		page = Math.max(Math.trunc(page), 0)

		const start = page * pageSize
		const end = start + pageSize
		const requiredActivities = end + 1
		const sources = await Promise.all(profile.characters.map(character =>
			getActivitySource(profile, character.id, requiredActivities)
		))

		const allActivities = sources
			.flatMap(source => source.activities.map(activity => ({ characterId: source.characterId, activity } satisfies ActivityEntry)))
			.toSorted((a, b) => new Date(b.activity.period).getTime() - new Date(a.activity.period).getTime())

		const allSourcesExhausted = sources.every(source => source.exhausted)
		const totalActivities = allSourcesExhausted ? allActivities.length : undefined
		const hasMore = allActivities.length > end || !allSourcesExhausted
		const entries = await Promise.all(allActivities.slice(start, end).map(toPgcrEntry))

		return {
			profile,
			page,
			pageSize,
			hasMore,
			totalActivities,
			totalPages: totalActivities === undefined ? undefined : Math.ceil(totalActivities / pageSize),
			entries,
		}
	}

	async function getActivitySource (profile: Profile, characterId: string, requiredActivities: number): Promise<ActivitySource> {
		const key = OfflineCache.activityHistoryKey(profile, characterId)
		const cached = await OfflineCache.getCachedData<ActivityHistoryCache>(key)
		if (cached)
			return {
				characterId,
				activities: cached.activities,
				exhausted: true,
			}

		const activities: DestinyHistoricalStatsPeriodGroup[] = []
		for (let page = 0; activities.length < requiredActivities; page++) {
			const result = await Bungie.getForUser<DestinyActivityHistoryResults>(
				`/Destiny2/${profile.type}/Account/${profile.id}/Character/${characterId}/Stats/Activities/`,
				{
					count: ACTIVITY_PAGE_SIZE,
					page,
				},
			)

			const pageActivities = result?.activities ?? []
			activities.push(...pageActivities)
			if (pageActivities.length < ACTIVITY_PAGE_SIZE) {
				await OfflineCache.putCachedData(key, {
					cachedAt: new Date().toISOString(),
					activities,
				} satisfies ActivityHistoryCache)
				return {
					characterId,
					activities,
					exhausted: true,
				}
			}
		}

		return {
			characterId,
			activities,
			exhausted: false,
		}
	}

	async function toPgcrEntry ({ characterId, activity }: ActivityEntry): Promise<PgcrsPageEntry> {
		const pgcrId = activity.activityDetails.instanceId
		const key = OfflineCache.pgcrKey(pgcrId)
		const cached = await OfflineCache.getCachedData<DestinyPostGameCarnageReportData>(key)
		if (cached)
			return {
				characterId,
				activity,
				pgcr: cached,
				pgcrStatus: 'cached',
			}

		const unavailableKey = OfflineCache.pgcrUnavailableKey(pgcrId)
		const unavailable = await OfflineCache.getCachedData<PgcrUnavailable>(unavailableKey)
		if (unavailable)
			return {
				characterId,
				activity,
				pgcrStatus: 'unavailable',
				message: unavailable.message,
			}

		try {
			const pgcr = await OfflineCache.fetchPgcr(pgcrId)
			await OfflineCache.putCachedData(key, pgcr)
			return {
				characterId,
				activity,
				pgcr,
				pgcrStatus: 'fetched',
			}
		}
		catch (err) {
			const message = OfflineCache.errorMessage(err)
			if (OfflineCache.isUnavailablePgcr(err)) {
				await OfflineCache.putCachedData(unavailableKey, {
					unavailable: true,
					cachedAt: new Date().toISOString(),
					message,
				} satisfies PgcrUnavailable)
				return {
					characterId,
					activity,
					pgcrStatus: 'unavailable',
					message,
				}
			}

			return {
				characterId,
				activity,
				pgcrStatus: 'failed',
				message,
			}
		}
	}

}

export default Pgcrs
