/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { DestinyComponentType, type DestinyProfileResponse } from 'bungie-api-ts/destiny2'
import { ProfiledModel } from 'model/ProfiledModel'
import Broadcast from 'utility/Broadcast'
import Bungie from 'utility/Bungie'
import Store from 'utility/Store'

interface ProfileOverrideBase {
	time: number
	type: string
}

interface ProfileOverrideDelete extends ProfileOverrideBase {
	type: 'delete'
	path: string[]
}

interface ProfileOverrideSet extends ProfileOverrideBase {
	type: 'set'
	path: string[]
	value: unknown
}

interface ProfileOverrideMove extends ProfileOverrideBase {
	type: 'move'
	fromPath: string[]
	toPath: string[]
}

export interface ProfileOverrideWhereEquals {
	path: string[]
	value: unknown
}

export interface ProfileOverrideWhereNotEquals {
	path: string[]
	value: unknown
}

export interface ProfileOverrideWhereOr {
	or: ProfileOverrideWhere[]
}

export interface ProfileOverrideWhereAnd {
	and: ProfileOverrideWhere[]
}

export type ProfileOverrideWhere =
	| ProfileOverrideWhereEquals
	| ProfileOverrideWhereNotEquals
	| ProfileOverrideWhereOr
	| ProfileOverrideWhereAnd

interface ProfileOverrideSpliceWhere extends ProfileOverrideBase {
	type: 'splice-where'
	arrayPath: string[]
	where: ProfileOverrideWhere[]
}

interface ProfileOverrideMoveWhere extends ProfileOverrideBase {
	type: 'move-where'
	fromArrayPath: string[]
	where: ProfileOverrideWhere[]
	toArrayPath: string[]
}

interface ProfileOverrideSetWhere extends ProfileOverrideBase {
	type: 'set-where'
	arrayPath: string[]
	where: ProfileOverrideWhere[]
	modifyPath: string[]
	value: unknown
}

type ProfileOverride =
	| ProfileOverrideDelete
	| ProfileOverrideSet
	| ProfileOverrideMove
	| ProfileOverrideSpliceWhere
	| ProfileOverrideMoveWhere
	| ProfileOverrideSetWhere

declare module 'utility/Store' {
	export interface LocalStorage {
		destinyProfileOverrides: Record<string, ProfileOverride[]>
	}
}

export interface DestinyProfile extends
	Partial<Omit<DestinyProfileResponse, 'responseMintedTimestamp' | 'secondaryComponentsMintedTimestamp'>>,
	Pick<DestinyProfileResponse, 'responseMintedTimestamp' | 'secondaryComponentsMintedTimestamp'>,
	Object { }

export default ProfiledModel<DestinyProfile | undefined>('destiny2/profile', {
	cacheDirtyTime: 1000 * 30, // 30 second cache time
	async fetch (profile) {
		const profileResponse = profile && await Broadcast.operation('Fetching Destiny profile', () =>
			Bungie.getForUser<DestinyProfile>(`/Destiny2/${profile.type}/Profile/${profile.id}/`, {
				components: [
					DestinyComponentType.Profiles,

					// Characters
					DestinyComponentType.Characters,
					DestinyComponentType.ProfileProgression,
					DestinyComponentType.CharacterLoadouts,

					// Items
					DestinyComponentType.CharacterInventories,
					DestinyComponentType.CharacterEquipment,
					DestinyComponentType.ProfileInventories,
					DestinyComponentType.ItemInstances,
					DestinyComponentType.ItemPlugObjectives,
					DestinyComponentType.ItemStats,
					DestinyComponentType.Records,
					DestinyComponentType.ItemSockets,
					DestinyComponentType.ItemReusablePlugs,
					DestinyComponentType.ItemPlugStates,
					DestinyComponentType.ItemPerks,
					DestinyComponentType.CharacterProgressions,

					// Collections
					DestinyComponentType.Collectibles,
					DestinyComponentType.CharacterActivities, // displaying whether items are currently obtainable

					// Misc
					DestinyComponentType.StringVariables,
				],
			})
		)
		return {
			version: profileResponse?.responseMintedTimestamp ?? 'n/a',
			value: profileResponse,
		}
	},
	async tweak (value, profile) {
		const allOverrides = await Store.destinyProfileOverrides.get()
		const overrides = allOverrides?.[profile?.id ?? ''] ?? []
		if (!overrides || !value)
			return

		const profileMinted = new Date(value.responseMintedTimestamp).getTime()
		for (const override of overrides) {
			if (profileMinted > override.time)
				continue

			switch (override.type) {
				case 'delete': {
					const parent = getNestedParent(value, override.path)
					if (parent)
						delete parent[override.path.at(-1)!]
					break
				}
				case 'set': {
					const parent = getNestedParent(value, override.path)
					if (parent)
						parent[override.path.at(-1)!] = override.value
					break
				}
				case 'move': {
					const fromParent = getNestedParent(value, override.fromPath)
					const toParent = getNestedParent(value, override.toPath)
					if (fromParent && toParent) {
						toParent[override.toPath.at(-1)!] = fromParent[override.fromPath.at(-1)!]

						delete fromParent[override.fromPath.at(-1)!]
					}
					break
				}
				case 'splice-where': {
					const arrayCursor = getNestedObject(value, override.arrayPath)
					if (Array.isArray(arrayCursor)) {
						const index = arrayCursor.findIndex(item => meetsEveryCondition(item, override.where))
						if (index !== -1)
							arrayCursor.splice(index, 1)
					}
					break
				}
				case 'move-where': {
					const fromArrayCursor = getNestedObject(value, override.fromArrayPath)
					const toArrayCursor = getNestedObject(value, override.toArrayPath)
					if (Array.isArray(fromArrayCursor) && Array.isArray(toArrayCursor)) {
						const index = fromArrayCursor.findIndex(item => meetsEveryCondition(item, override.where))
						if (index !== -1) {
							const [item] = fromArrayCursor.splice(index, 1)
							toArrayCursor.push(item)
						}
					}
					break
				}
				case 'set-where': {
					const arrayCursor = getNestedObject(value, override.arrayPath)
					if (Array.isArray(arrayCursor)) {
						const item = arrayCursor.find(item => meetsEveryCondition(item, override.where))
						if (item) {
							const parent = getNestedParent(item, override.modifyPath)
							if (parent)
								parent[override.modifyPath.at(-1)!] = override.value
						}
					}
					break
				}
			}
		}

		overrides.splice(0, Infinity, ...overrides.filter(override => override.time > profileMinted))
		await Store.destinyProfileOverrides.set(allOverrides!)
	},
})

function meetsCondition (value: any, where: ProfileOverrideWhere): boolean {
	if ('and' in where) {
		if (!meetsEveryCondition(value, where.and))
			return false
		return true
	}

	if ('or' in where) {
		if (!meetsAnyCondition(value, where.or))
			return false
		return true
	}

	if ('path' in where && 'value' in where) {
		if (getNestedObject(value, where.path) !== where.value)
			return false
		return true
	}

	where satisfies never
	return false
}

function meetsEveryCondition (value: any, where: ProfileOverrideWhere[]): boolean {
	for (const cond of where)
		if (!meetsCondition(value, cond))
			return false
	return true
}

function meetsAnyCondition (value: any, where: ProfileOverrideWhere[]): boolean {
	for (const cond of where)
		if (meetsCondition(value, cond))
			return true
	return false
}

function getNestedObject (obj: any, path: string[]): any {
	let cursor = obj
	const targetPath = path

	for (const part of targetPath) {
		if (cursor === undefined || cursor === null) return undefined

		cursor = cursor[part]
	}
	return cursor
}

function getNestedParent (obj: any, path: string[]): any {
	let cursor = obj
	const targetPath = path

	for (let i = 0; i < targetPath.length - 1; i++) {
		if (cursor === undefined || cursor === null) return undefined

		cursor = cursor[targetPath[i]]
	}
	return cursor
}
