import type {
	InventoryPatch,
	InventoryPatchItemReference,
	InventoryPatchLocation,
	ItemTransferAction,
	ItemTransferIntent,
	ItemTransferReference,
	RelatedItem,
} from '@shared/ConduitMessageRegistry'
import type { Profile } from '@shared/Profile'
import { BucketScope, type DestinyItemTransferRequest, type DestinyPostmasterTransferRequest } from 'bungie-api-ts/destiny2'
import { InventoryBucketHashes } from 'deepsight.gg/Enums'
import Auth from 'model/Auth'
import Definitions from 'model/Definitions'
import type {
	ProfileOverride,
	ProfileOverrideMoveWhere,
	ProfileOverrideSetWhere,
	ProfileOverrideWhere,
	ProfilePatchRecord,
} from 'model/DestinyProfiles'
import {
	ProfilePatch,
	type ProfilePatchApplyContext,
} from 'model/ProfilePatch'
import Profiles from 'model/Profiles'
import Broadcast from 'utility/Broadcast'
import Bungie from 'utility/Bungie'
import { SKIP_CLIENT } from 'utility/Service'

interface ItemMovementProfilePatchParams {
	item: InventoryPatchItemReference
	from: InventoryPatchLocation
	to: InventoryPatchLocation
	destinationBucketHash?: number
}

interface PostmasterBucketCorrectionProfilePatchParams {
	item: InventoryPatchItemReference
	characterId: string
	bucketHash: number
}

interface ProfileInventoryBucketCorrectionProfilePatchParams {
	item: InventoryPatchItemReference
	fromBucketHash: number
	bucketHash: number
}

interface EquipItemOnCharacterProfilePatchParams {
	item: InventoryPatchItemReference
	characterId: string
	bucketHash?: number
}

const CharacterInventoryToVaultPatch = new ProfilePatch<ItemMovementProfilePatchParams>({
	id: 'character-inventory-to-vault',
	fromParams: (params, time) => [
		moveWhereOverride(params, time),
		bucketHashWhereOverride({
			item: params.item,
			location: params.to,
			bucketHash: InventoryBucketHashes.General,
		}, time),
	],
	toParams: record => movementFromRecord(record, 'character-inventory-to-vault',
		override => ({ container: 'characterInventory', characterId: override.type === 'move-where' ? override.fromArrayPath[2] : '' }),
		() => ({ container: 'vault' })
	),
	onApply: (profile, params, _record, context) => broadcastInventoryPatches(profile, movementInventoryPatches(params), context),
})

const VaultToCharacterInventoryPatch = new ProfilePatch<ItemMovementProfilePatchParams>({
	id: 'vault-to-character-inventory',
	fromParams: (params, time) => [
		moveWhereOverride(params, time),
		...params.destinationBucketHash === undefined ? [] : [
			bucketHashWhereOverride({
				item: params.item,
				location: params.to,
				bucketHash: params.destinationBucketHash,
			}, time),
		],
	],
	toParams: record => movementFromRecord(record, 'vault-to-character-inventory',
		() => ({ container: 'vault' }),
		override => ({ container: 'characterInventory', characterId: override.type === 'move-where' ? override.toArrayPath[2] : '' })
	),
	onApply: (profile, params, _record, context) => broadcastInventoryPatches(profile, movementInventoryPatches(params), context),
})

const PostmasterBucketCorrectionPatch = new ProfilePatch<PostmasterBucketCorrectionProfilePatchParams>({
	id: 'postmaster-bucket-correction',
	fromParams: (params, time) => bucketHashWhereOverride({
		item: params.item,
		location: { container: 'characterInventory', characterId: params.characterId },
		bucketHash: params.bucketHash,
	}, time),
	toParams: record => {
		const override = singleOverride(record, 'postmaster-bucket-correction')
		return override && postmasterBucketCorrectionFromOverride(override)
	},
	onApply: (profile, params, _record, context) => broadcastInventoryPatch(profile, {
		type: 'bucket-correction',
		item: params.item,
		location: { container: 'characterInventory', characterId: params.characterId },
		bucketHash: params.bucketHash,
	}, context),
})

const ProfileInventoryBucketCorrectionPatch = new ProfilePatch<ProfileInventoryBucketCorrectionProfilePatchParams>({
	id: 'profile-inventory-bucket-correction',
	fromParams: (params, time) => bucketHashWhereOverride({
		item: params.item,
		location: { container: 'vault' },
		fromBucketHash: params.fromBucketHash,
		bucketHash: params.bucketHash,
	}, time),
	toParams: record => {
		const override = singleOverride(record, 'profile-inventory-bucket-correction')
		const correction = override && bucketHashWhereFromOverride(override)
		if (correction?.location.container !== 'vault')
			return undefined
		if (typeof correction.fromBucketHash !== 'number')
			return undefined

		return {
			item: correction.item,
			fromBucketHash: correction.fromBucketHash,
			bucketHash: correction.bucketHash,
		}
	},
	onApply: (profile, params, _record, context) => broadcastInventoryPatch(profile, {
		type: 'bucket-correction',
		item: params.item,
		location: { container: 'vault' },
		fromBucketHash: params.fromBucketHash,
		bucketHash: params.bucketHash,
	}, context),
})

const EquipItemOnCharacterPatch = new ProfilePatch<EquipItemOnCharacterProfilePatchParams>({
	id: 'equip-item-on-character',
	fromParams: equipItemOnCharacterOverrides,
	toParams: record => equipItemOnCharacterFromRecord(record),
	onApply: (profile, params, _record, context) => broadcastInventoryPatch(profile, {
		type: 'move',
		item: params.item,
		from: { container: 'characterInventory', characterId: params.characterId },
		to: { container: 'characterEquipment', characterId: params.characterId },
	}, context),
})

function singleOverride (record: ProfilePatchRecord, id: string): ProfileOverride | undefined {
	if (record.id !== id || record.overrides.length !== 1)
		return undefined

	return record.overrides[0]
}

function movementFromRecord (
	record: ProfilePatchRecord,
	id: string,
	from: (override: ProfileOverrideMoveWhere) => InventoryPatchLocation,
	to: (override: ProfileOverrideMoveWhere) => InventoryPatchLocation
): ItemMovementProfilePatchParams | undefined {
	if (record.id !== id)
		return undefined

	let movement: ItemMovementProfilePatchParams | undefined
	const bucketCorrections: BucketHashWhereParams[] = []
	for (const override of record.overrides) {
		if (override.type === 'move-where') {
			movement ??= movementFromOverride(
				override,
				from(override),
				to(override)
			)
			continue
		}

		const bucketCorrection = bucketHashWhereFromOverride(override)
		if (bucketCorrection)
			bucketCorrections.push(bucketCorrection)
	}

	if (!movement)
		return undefined

	const destinationBucketHash = bucketCorrections
		.find(correction => locationsEqual(correction.location, movement.to) && itemReferencesEqual(correction.item, movement.item))
		?.bucketHash

	return {
		...movement,
		destinationBucketHash,
	}
}

function equipItemOnCharacterOverrides (params: EquipItemOnCharacterProfilePatchParams, time = Date.now()): ProfileOverrideMoveWhere[] {
	return [
		...(params.bucketHash === undefined ? [] : [{
			type: 'move-where',
			fromArrayPath: locationItemsPath({ container: 'characterEquipment', characterId: params.characterId }),
			toArrayPath: locationItemsPath({ container: 'characterInventory', characterId: params.characterId }),
			where: [{ path: ['bucketHash'], value: params.bucketHash }],
			time,
		} satisfies ProfileOverrideMoveWhere]),
		moveWhereOverride({
			item: params.item,
			from: { container: 'characterInventory', characterId: params.characterId },
			to: { container: 'characterEquipment', characterId: params.characterId },
		}, time),
	]
}

function equipItemOnCharacterFromRecord (record: ProfilePatchRecord): EquipItemOnCharacterProfilePatchParams | undefined {
	if (record.id !== 'equip-item-on-character')
		return undefined

	let bucketHash: number | undefined
	let movement: ItemMovementProfilePatchParams | undefined
	for (const override of record.overrides) {
		if (override.type !== 'move-where')
			continue

		const from = locationFromItemsPath(override.fromArrayPath)
		const to = locationFromItemsPath(override.toArrayPath)
		if (from?.container === 'characterEquipment' && to?.container === 'characterInventory' && from.characterId === to.characterId) {
			const value = valueForWherePath(override.where, ['bucketHash'])
			if (typeof value === 'number')
				bucketHash = value
			continue
		}

		if (from?.container === 'characterInventory' && to?.container === 'characterEquipment' && from.characterId === to.characterId) {
			movement = movementFromOverride(
				override,
				from,
				to
			)
		}
	}

	if (!movement || movement.to.container !== 'characterEquipment')
		return undefined

	return {
		item: movement.item,
		characterId: movement.to.characterId,
		bucketHash,
	}
}

function itemMatcher (item: InventoryPatchItemReference): ProfileOverrideWhere {
	const conditions: ProfileOverrideWhere[] = []
	if (item.instanceId)
		conditions.push({ path: ['itemInstanceId'], value: item.instanceId })

	conditions.push({
		and: [
			{ path: ['itemInstanceId'], value: undefined },
			{ path: ['itemHash'], value: item.itemHash },
			{ path: ['quantity'], value: item.stackSize },
			...item.bucketHash === undefined ? [] : [{ path: ['bucketHash'], value: item.bucketHash }],
		],
	})

	return {
		or: conditions,
	}
}

function itemFromMatcher (where: ProfileOverrideWhere[]): InventoryPatchItemReference | undefined {
	const matcher = where[0]
	if (!matcher || !('or' in matcher))
		return undefined

	const byInstance = matcher.or.find(condition => isWherePath(condition, ['itemInstanceId']))
	const byStack = matcher.or.find(condition => 'and' in condition)
	if (!byStack || !('and' in byStack))
		return undefined

	const itemHash = valueForWherePath(byStack.and, ['itemHash'])
	const stackSize = valueForWherePath(byStack.and, ['quantity'])
	const bucketHash = valueForWherePath(byStack.and, ['bucketHash'])
	if (typeof itemHash !== 'number')
		return undefined

	return {
		instanceId: typeof byInstance?.value === 'string' ? byInstance.value : undefined,
		itemHash,
		stackSize: typeof stackSize === 'number' ? stackSize : undefined,
		bucketHash: typeof bucketHash === 'number' ? bucketHash : undefined,
	}
}

function valueForWherePath (conditions: ProfileOverrideWhere[], path: string[]) {
	return conditions.find(condition => isWherePath(condition, path))?.value
}

function isWherePath (condition: ProfileOverrideWhere, path: string[]): condition is Extract<ProfileOverrideWhere, { path: string[], value: unknown }> {
	return 'path' in condition && arrayEquals(condition.path, path)
}

function moveWhereOverride (params: ItemMovementProfilePatchParams, time = Date.now()): ProfileOverrideMoveWhere {
	return {
		type: 'move-where',
		fromArrayPath: locationItemsPath(params.from),
		toArrayPath: locationItemsPath(params.to),
		where: [itemMatcher(params.item)],
		time,
	}
}

function movementFromOverride (override: ProfileOverride, from: InventoryPatchLocation, to: InventoryPatchLocation): ItemMovementProfilePatchParams | undefined {
	if (override.type !== 'move-where')
		return undefined

	if (!arrayEquals(override.fromArrayPath, locationItemsPath(from)) || !arrayEquals(override.toArrayPath, locationItemsPath(to)))
		return undefined

	const item = itemFromMatcher(override.where)
	if (!item)
		return undefined

	return { item, from, to }
}

interface BucketHashWhereParams {
	item: InventoryPatchItemReference
	location: InventoryPatchLocation
	fromBucketHash?: number
	bucketHash: number
}

function bucketHashWhereOverride (params: BucketHashWhereParams, time = Date.now()): ProfileOverrideSetWhere {
	return {
		type: 'set-where',
		arrayPath: locationItemsPath(params.location),
		where: [itemMatcher(params.fromBucketHash === undefined ? params.item : { ...params.item, bucketHash: params.fromBucketHash })],
		modifyPath: ['bucketHash'],
		value: params.bucketHash,
		time,
	}
}

function bucketHashWhereFromOverride (override: ProfileOverride): BucketHashWhereParams | undefined {
	if (override.type !== 'set-where' || !arrayEquals(override.modifyPath, ['bucketHash']) || typeof override.value !== 'number')
		return undefined

	const location = locationFromItemsPath(override.arrayPath)
	if (!location)
		return undefined

	const item = itemFromMatcher(override.where)
	if (!item)
		return undefined
	const { bucketHash: fromBucketHash, ...reference } = item

	return {
		item: reference,
		location,
		fromBucketHash,
		bucketHash: override.value,
	}
}

function postmasterBucketCorrectionFromOverride (override: ProfileOverride): PostmasterBucketCorrectionProfilePatchParams | undefined {
	const correction = bucketHashWhereFromOverride(override)
	if (correction?.location.container !== 'characterInventory')
		return undefined

	return {
		item: correction.item,
		characterId: correction.location.characterId,
		bucketHash: correction.bucketHash,
	}
}

function broadcastInventoryPatch (profile: Profile, patch: InventoryPatch, context: ProfilePatchApplyContext) {
	return broadcastInventoryPatches(profile, [patch], context)
}

function broadcastInventoryPatches (profile: Profile, patches: InventoryPatch[], context: ProfilePatchApplyContext) {
	if (!context.operationId)
		return Promise.resolve()

	return service.broadcast.inventoryPatch(origin => {
		if (context.origin && origin !== context.origin)
			return SKIP_CLIENT

		return {
			operationId: context.operationId!,
			profile,
			patches,
		}
	})
}

function movementInventoryPatches (params: ItemMovementProfilePatchParams): InventoryPatch[] {
	return [
		{ type: 'move', item: params.item, from: params.from, to: params.to },
		...params.destinationBucketHash === undefined ? [] : [{
			type: 'bucket-correction' as const,
			item: params.item,
			location: params.to,
			bucketHash: params.destinationBucketHash,
		}],
	]
}

function locationItemsPath (location: InventoryPatchLocation): string[] {
	switch (location.container) {
		case 'vault': return ['profileInventory', 'data', 'items']
		case 'characterInventory': return ['characterInventories', 'data', location.characterId, 'items']
		case 'characterEquipment': return ['characterEquipment', 'data', location.characterId, 'items']
		case 'postmaster': return ['characterInventories', 'data', location.characterId, 'items']
	}
}

function locationFromItemsPath (path: string[]): InventoryPatchLocation | undefined {
	const key = pathKey(path)
	if (key === 'profileInventory:data:items')
		return { container: 'vault' }

	const characterItemsMatch = /^(characterInventories|characterEquipment):data:([^:]+):items$/.exec(key)
	if (!characterItemsMatch)
		return undefined

	return {
		container: characterItemsMatch[1] === 'characterInventories' ? 'characterInventory' : 'characterEquipment',
		characterId: characterItemsMatch[2],
	}
}

function pathKey (path: readonly string[]) {
	return path.join(':')
}

function arrayEquals (a: readonly unknown[], b: readonly unknown[]) {
	return a.length === b.length && a.every((value, i) => value === b[i])
}

function locationsEqual (a: InventoryPatchLocation, b: InventoryPatchLocation): boolean {
	return a.container === b.container
		&& ('characterId' in a ? a.characterId : undefined) === ('characterId' in b ? b.characterId : undefined)
}

function itemReferencesEqual (a: InventoryPatchItemReference, b: InventoryPatchItemReference): boolean {
	return a.instanceId === b.instanceId
		&& a.itemHash === b.itemHash
		&& a.stackSize === b.stackSize
		&& a.bucketHash === b.bucketHash
}

function itemReferenceFromTransferBody (body: DestinyItemTransferRequest | DestinyPostmasterTransferRequest) {
	return {
		instanceId: body.itemId === '0' ? undefined : body.itemId,
		itemHash: body.itemReferenceHash,
		stackSize: body.stackSize,
	}
}

function itemReferenceFromItem (item: ItemTransferReference): InventoryPatchItemReference {
	return {
		instanceId: item.instanceId,
		itemHash: item.itemHash,
		stackSize: item.stackSize,
		bucketHash: item.bucketHash,
	}
}

function relatedItem (item: ItemTransferReference | InventoryPatchItemReference): RelatedItem {
	return {
		is: 'item-reference',
		itemHash: item.itemHash,
		instanceId: item.instanceId,
		stackSize: item.stackSize,
	}
}

function relatedCharacter (characterId: string | undefined): RelatedItem[] {
	return characterId ? [{ is: 'character-reference', characterId }] : []
}

function relatedTransferBody (body: DestinyItemTransferRequest | DestinyPostmasterTransferRequest): RelatedItem[] {
	return [
		relatedItem(itemReferenceFromTransferBody(body)),
		...relatedCharacter(body.characterId),
	]
}

function operationId () {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export async function transferItem (profile: Profile, body: DestinyItemTransferRequest, context: ProfilePatchApplyContext = {}) {
	await Broadcast.operation(body.transferToVault ? 'Transferring item to vault' : 'Transferring item to character', relatedTransferBody(body), async () => {
		await Bungie.postForUser('/Destiny2/Actions/Items/TransferItem/', body as never)
		const itemInventoryBucket = await getItemInventoryBucket(body.itemReferenceHash)
		if (itemInventoryBucket?.isAccountScopedTransferBucket)
			await ProfileInventoryBucketCorrectionPatch.apply(profile, {
				item: itemReferenceFromTransferBody(body),
				fromBucketHash: body.transferToVault ? itemInventoryBucket.bucketHash : InventoryBucketHashes.General,
				bucketHash: body.transferToVault ? InventoryBucketHashes.General : itemInventoryBucket.bucketHash,
			}, context)
		else if (body.transferToVault)
			await CharacterInventoryToVaultPatch.apply(profile, {
				item: itemReferenceFromTransferBody(body),
				from: { container: 'characterInventory', characterId: body.characterId },
				to: { container: 'vault' },
			}, context)
		else
			await VaultToCharacterInventoryPatch.apply(profile, {
				item: itemReferenceFromTransferBody(body),
				from: { container: 'vault' },
				to: { container: 'characterInventory', characterId: body.characterId },
				destinationBucketHash: await getItemInventoryBucketHash(body.itemReferenceHash),
			}, context)
	})
}

async function getItemInventoryBucketHash (itemHash: number) {
	return await getItemInventoryBucket(itemHash).then(bucket => bucket?.bucketHash)
}

async function getItemInventoryBucket (itemHash: number) {
	const [DestinyInventoryItemDefinition, DestinyInventoryBucketDefinition] = await Promise.all([
		Definitions.en.DestinyInventoryItemDefinition.get(),
		Definitions.en.DestinyInventoryBucketDefinition.get(),
	])
	const bucketHash = DestinyInventoryItemDefinition[itemHash]?.inventory?.bucketTypeHash
	const bucket = bucketHash === undefined ? undefined : DestinyInventoryBucketDefinition[bucketHash]

	return bucketHash === undefined || !bucket ? undefined : {
		bucketHash,
		isAccountScopedTransferBucket: bucket.hasTransferDestination && bucket.scope === BucketScope.Account,
	}
}

function broadcastIntent (origin: string, data: ItemTransferIntent) {
	return service.broadcast.itemTransferIntent(clientOrigin => {
		if (clientOrigin !== origin)
			return SKIP_CLIENT

		return data
	})
}

function broadcastFailure (origin: string, operationId: string, failedStep: string, err: unknown) {
	return service.broadcast.itemTransferFailure(clientOrigin => {
		if (clientOrigin !== origin)
			return SKIP_CLIENT

		return {
			operationId,
			failedStep,
			reason: interpretFailureReason(err),
			recoveryResult: 'not-attempted',
		}
	})
}

function broadcastComplete (origin: string, operationId: string, actions: ItemTransferAction[]) {
	return service.broadcast.itemTransferComplete(clientOrigin => {
		if (clientOrigin !== origin)
			return SKIP_CLIENT

		return {
			operationId,
			actions,
		}
	})
}

function interpretFailureReason (err: unknown) {
	if (err instanceof Error) {
		const message = err.message.toLowerCase()
		if (message.includes('auth') || message.includes('token'))
			return 'auth'
		if (message.includes('bungie') || message.includes('destiny'))
			return 'bungie'
	}

	return 'unknown'
}

async function runTransferOperation (origin: string, operationId: string, failedStep: string, action: () => Promise<ItemTransferAction[]>) {
	try {
		const actions = await action()
		await broadcastComplete(origin, operationId, actions)
		return actions
	}
	catch (err) {
		await broadcastFailure(origin, operationId, failedStep, err)
		throw err
	}
}

export async function pullFromPostmaster (profile: Profile, body: DestinyPostmasterTransferRequest, context: ProfilePatchApplyContext = {}) {
	const itemDef = await Definitions.en.DestinyInventoryItemDefinition.get().then(DestinyInventoryItemDefinition => DestinyInventoryItemDefinition[body.itemReferenceHash])
	if (!itemDef.inventory?.bucketTypeHash) {
		Broadcast.warning('user', 'Unable to pull item from postmaster: Unknown item')
		return
	}
	const bucketHash = itemDef.inventory.bucketTypeHash

	await Broadcast.operation('Pulling item from postmaster', relatedTransferBody(body), async () => {
		await Bungie.postForUser('/Destiny2/Actions/Items/PullFromPostmaster/', body as never)
		await PostmasterBucketCorrectionPatch.apply(profile, {
			item: itemReferenceFromTransferBody(body),
			characterId: body.characterId,
			bucketHash,
		}, context)
	})
}

async function equipItem (profile: Profile, characterId: string, item: ItemTransferReference, context: ProfilePatchApplyContext = {}) {
	if (!item.instanceId) {
		Broadcast.warning('user', 'Unable to equip item: Instance required')
		throw new Error('Unable to equip item: Instance required')
	}

	if (item.characterId !== characterId) {
		Broadcast.warning('user', 'Unable to equip item: Planner support required')
		throw new Error('Unable to equip item: Planner support required')
	}

	await Broadcast.operation('Equipping item', [relatedItem(item), ...relatedCharacter(characterId)], async () => {
		await Bungie.postForUser('/Destiny2/Actions/Items/EquipItem/', {
			membershipType: profile.type,
			itemId: item.instanceId,
			characterId,
		} as never)

		await EquipItemOnCharacterPatch.apply(profile, {
			item: itemReferenceFromItem(item),
			characterId,
			bucketHash: item.bucketHash,
		}, context)
	})
}

namespace ItemTransfer {

	export async function vaultItem (origin: string, item: ItemTransferReference): Promise<ItemTransferAction[]> {
		const id = operationId()
		await broadcastIntent(origin, {
			operationId: id,
			action: 'vault-item',
			item,
			to: 'vault',
		})

		return await Broadcast.operation('Vaulting item', [relatedItem(item), ...relatedCharacter(item.characterId)], async () => await runTransferOperation(origin, id, 'vault-item', async () => {
			const auth = await Auth.getValid()
			const profile = await Profiles.getCurrentProfile(auth)
			if (!profile) {
				Broadcast.warning('user', 'Unable to transfer item: Not authenticated')
				return []
			}

			const instanceId = item.instanceId ?? '0'
			if (!item.characterId) {
				Broadcast.warning('user', 'Unable to transfer item: Character required')
				return []
			}

			const context = { operationId: id, origin }
			if (item.isLostItem)
				await pullFromPostmaster(profile, {
					membershipType: profile.type,
					itemId: instanceId,
					itemReferenceHash: item.itemHash,
					stackSize: item.stackSize ?? 1,
					characterId: item.characterId,
				}, context)

			await transferItem(profile, {
				membershipType: profile.type,
				itemId: instanceId,
				itemReferenceHash: item.itemHash,
				stackSize: item.stackSize ?? 1,
				characterId: item.characterId,
				transferToVault: true,
			}, context)

			return [
				{ item, to: 'vault' },
			]
		}))
	}

	export async function moveItemToCharacter (origin: string, characterId: string, item: ItemTransferReference): Promise<ItemTransferAction[]> {
		const id = operationId()
		await broadcastIntent(origin, {
			operationId: id,
			action: 'move-item-to-character',
			item,
			to: 'character',
			characterId,
		})

		return await Broadcast.operation('Moving item to character', [relatedItem(item), ...relatedCharacter(characterId)], async () => await runTransferOperation(origin, id, 'move-item-to-character', async () => {
			const auth = await Auth.getValid()
			const profile = await Profiles.getCurrentProfile(auth)
			if (!profile) {
				Broadcast.warning('user', 'Unable to transfer item: Not authenticated')
				return []
			}

			const instanceId = item.instanceId ?? '0'
			const context = { operationId: id, origin }

			let needsVaultTransfer = true
			if (item.isLostItem) {
				if (!item.characterId) {
					Broadcast.warning('user', 'Unable to transfer item: Character required')
					return []
				}

				needsVaultTransfer = false
				await pullFromPostmaster(profile, {
					membershipType: profile.type,
					itemId: instanceId,
					itemReferenceHash: item.itemHash,
					stackSize: item.stackSize ?? 1,
					characterId: item.characterId,
				}, context)
			}

			if (item.characterId && item.characterId !== characterId) {
				needsVaultTransfer = true
				await transferItem(profile, {
					membershipType: profile.type,
					itemId: instanceId,
					itemReferenceHash: item.itemHash,
					stackSize: item.stackSize ?? 1,
					characterId: item.characterId,
					transferToVault: true,
				}, context)
			}

			if (needsVaultTransfer)
				await transferItem(profile, {
					membershipType: profile.type,
					itemId: instanceId,
					itemReferenceHash: item.itemHash,
					stackSize: item.stackSize ?? 1,
					characterId,
					transferToVault: false,
				}, context)

			return [
				{ item, to: 'character', newCharacterId: characterId },
			]
		}))
	}

	export async function equipItemOnCharacter (origin: string, characterId: string, item: ItemTransferReference): Promise<ItemTransferAction[]> {
		const id = operationId()
		await broadcastIntent(origin, {
			operationId: id,
			action: 'equip-item-on-character',
			item,
			to: 'equipped',
			characterId,
		})

		return await runTransferOperation(origin, id, 'equip-item-on-character', async () => {
			const auth = await Auth.getValid()
			const profile = await Profiles.getCurrentProfile(auth)
			if (!profile) {
				Broadcast.warning('user', 'Unable to transfer item: Not authenticated')
				return []
			}

			await equipItem(profile, characterId, item, { operationId: id, origin })

			return [
				{ item, to: 'equipped', newCharacterId: characterId },
			]
		})
	}

}

export default ItemTransfer
