import type {
	InventoryPatch,
	InventoryPatchItemReference,
	InventoryPatchLocation,
	ItemTransferAction,
	ItemTransferFailureReason,
	ItemTransferIntent,
	ItemTransferOptions,
	ItemTransferRecoveryResult,
	ItemTransferReference,
	RelatedItem,
} from '@shared/ConduitMessageRegistry'
import type InventoryModel from '@shared/item/Inventory'
import type { ItemInstance } from '@shared/item/Item'
import type { Profile } from '@shared/Profile'
import { BucketScope, TierType, type DestinyInventoryBucketDefinition, type DestinyInventoryItemDefinition, type DestinyItemTransferRequest, type DestinyPostmasterTransferRequest } from 'bungie-api-ts/destiny2'
import { InventoryBucketHashes } from 'deepsight.gg/Enums'
import Auth from 'model/Auth'
import Definitions from 'model/Definitions'
import Inventory from 'model/Inventory'
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
		await Bungie.action.postForUser('/Destiny2/Actions/Items/TransferItem/', body as never)
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

function broadcastFailure (
	origin: string,
	operationId: string,
	failedStep: string,
	err: unknown,
	options: ItemTransferOptions = {},
	recoveryResult: ItemTransferRecoveryResult = 'not-attempted',
	finalBestKnownState?: InventoryPatch[]
) {
	return service.broadcast.itemTransferFailure(clientOrigin => {
		if (clientOrigin !== origin)
			return SKIP_CLIENT

		return {
			operationId,
			failedStep,
			reason: interpretFailureReason(err),
			recoveryPolicy: options.recoveryPolicy,
			recoveryResult,
			finalBestKnownState,
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

function interpretFailureReason (err: unknown): ItemTransferFailureReason {
	if (err instanceof TransferPlannerError)
		return err.reason

	if (err instanceof Error) {
		const message = err.message.toLowerCase()
		if (message.includes('auth') || message.includes('token'))
			return 'auth'
		if (message.includes('stale') || message.includes('not found') || message.includes('location'))
			return 'stale-location'
		if (message.includes('equipped') && message.includes('transfer'))
			return 'equipped-transfer-restriction'
		if (message.includes('full') || message.includes('space') || message.includes('bucket'))
			return 'bucket-full'
		if (message.includes('class'))
			return 'class-restriction'
		if (message.includes('exotic') || message.includes('unique'))
			return 'exotic-restriction'
		if (message.includes('equip'))
			return 'equip-restriction'
		if (message.includes('orbit') || message.includes('social'))
			return 'orbit-or-social-space-restriction'
		if (message.includes('network') || message.includes('fetch') || message.includes('throttle') || message.includes('timeout'))
			return 'transient'
		if (message.includes('bungie') || message.includes('destiny'))
			return 'bungie'
	}

	return 'unknown'
}

async function runTransferOperation (
	origin: string,
	operationId: string,
	failedStep: string,
	options: ItemTransferOptions,
	action: () => Promise<ItemTransferAction[]>
) {
	try {
		const actions = await action()
		await broadcastComplete(origin, operationId, actions)
		return actions
	}
	catch (err) {
		if (!(typeof err === 'object' && err && 'failureBroadcasted' in err))
			await broadcastFailure(origin, operationId, failedStep, err, options)
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
		await Bungie.action.postForUser('/Destiny2/Actions/Items/PullFromPostmaster/', body as never)
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

	await Broadcast.operation('Equipping item', [relatedItem(item), ...relatedCharacter(characterId)], async () => {
		await Bungie.action.postForUser('/Destiny2/Actions/Items/EquipItem/', {
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

class TransferPlannerError extends Error {

	constructor (message: string, readonly reason: ItemTransferFailureReason = 'unknown') {
		super(message)
	}

}

interface PlannerState {
	profile: Profile
	inventory: InventoryModel
	itemDefs: Record<number, DestinyInventoryItemDefinition>
	bucketDefs: Record<number, DestinyInventoryBucketDefinition>
	context: Required<Pick<ProfilePatchApplyContext, 'operationId' | 'origin'>>
	successful: ExecutedPlannerStep[]
	patches: InventoryPatch[]
	reservedItems: Set<string>
}

interface LocatedPlannerItem {
	item: ItemInstance
	location: InventoryPatchLocation
}

interface PlannerStep {
	label: string
	execute (state: PlannerState): Promise<InventoryPatch[]>
	revert? (state: PlannerState): Promise<InventoryPatch[]>
}

interface ExecutedPlannerStep {
	label: string
	revert?: PlannerStep['revert']
}

type PlannerNode =
	| { type: 'step', step: PlannerStep }
	| { type: 'series', nodes: PlannerNode[] }
	| { type: 'parallel', nodes: PlannerNode[] }

const EMPTY_PLAN: PlannerNode = { type: 'series', nodes: [] }

function step (step: PlannerStep): PlannerNode {
	return { type: 'step', step }
}

function series (...nodes: (PlannerNode | undefined)[]): PlannerNode {
	return { type: 'series', nodes: nodes.filter((node): node is PlannerNode => !!node && !isEmptyPlan(node)) }
}

function parallel (...nodes: (PlannerNode | undefined)[]): PlannerNode {
	const filtered = nodes.filter(node => node && !isEmptyPlan(node)) as PlannerNode[]
	return filtered.length <= 1 ? filtered[0] ?? EMPTY_PLAN : { type: 'parallel', nodes: filtered }
}

function isEmptyPlan (node: PlannerNode): boolean {
	return node.type === 'series' && !node.nodes.length
}

async function createPlannerState (profile: Profile, operationId: string, origin: string): Promise<PlannerState> {
	const [inventory, itemDefs, bucketDefs] = await Promise.all([
		Inventory.for(profile).get(),
		Definitions.en.DestinyInventoryItemDefinition.get(),
		Definitions.en.DestinyInventoryBucketDefinition.get(),
	])
	if (!inventory)
		throw new TransferPlannerError('Unable to transfer item: Inventory unavailable', 'stale-location')

	return {
		profile,
		inventory,
		itemDefs,
		bucketDefs,
		context: { operationId, origin },
		successful: [],
		patches: [],
		reservedItems: new Set(),
	}
}

async function executePlan (state: PlannerState, node: PlannerNode): Promise<void> {
	switch (node.type) {
		case 'series':
			for (const child of node.nodes)
				await executePlan(state, child)
			return

		case 'parallel': {
			const results = await Promise.allSettled(node.nodes.map(child => executePlan(state, child)))
			const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
			if (failure)
				throw failure.reason

			return
		}

		case 'step': {
			const patches = await node.step.execute(state)
			state.patches.push(...patches)
			state.successful.push({ label: node.step.label, revert: node.step.revert })
			return
		}
	}
}

async function recoverExecutedSteps (state: PlannerState): Promise<ItemTransferRecoveryResult> {
	let attempted = false
	for (const executed of [...state.successful].reverse()) {
		if (!executed.revert)
			return attempted ? 'failed' : 'not-attempted'

		attempted = true
		try {
			const patches = await executed.revert(state)
			state.patches.push(...patches)
		}
		catch {
			return 'failed'
		}
	}

	return attempted ? 'succeeded' : 'none'
}

function plannerStepErrorLabel (err: unknown, fallback: string) {
	return err instanceof TransferPlannerError ? err.message : fallback
}

function compileVaultRoute (state: PlannerState, item: ItemTransferReference): PlannerNode {
	const source = locatePlannerItem(state, item)
	if (source?.location.container === 'vault')
		return EMPTY_PLAN

	const prepared = prepareMovableCharacterInventorySource(state, item, source)
	if (!prepared.characterId)
		throw new TransferPlannerError('Unable to transfer item: Character required', 'stale-location')

	return series(
		prepared.plan,
		ensureVaultSpace(state),
		transferToVaultStep(referenceFromPlannerItem(prepared.item, prepared.characterId), prepared.characterId)
	)
}

function compileCharacterRoute (state: PlannerState, item: ItemTransferReference, targetCharacterId: string): PlannerNode {
	const source = locatePlannerItem(state, item)
	if (source?.location.container === 'characterInventory' && source.location.characterId === targetCharacterId)
		return EMPTY_PLAN

	if (source?.location.container === 'vault')
		return series(
			ensureCharacterBucketSpace(state, targetCharacterId, source.item.bucketHash, [item]),
			transferFromVaultStep(referenceFromPlannerItem(source.item), targetCharacterId)
		)

	const prepared = prepareMovableCharacterInventorySource(state, item, source)
	if (!prepared.characterId)
		throw new TransferPlannerError('Unable to transfer item: Character required', 'stale-location')

	return series(
		prepared.plan,
		ensureVaultSpace(state),
		transferToVaultStep(referenceFromPlannerItem(prepared.item, prepared.characterId), prepared.characterId),
		ensureCharacterBucketSpace(state, targetCharacterId, prepared.item.bucketHash, [item]),
		transferFromVaultStep(referenceFromPlannerItem(prepared.item), targetCharacterId)
	)
}

function compileEquipRoute (state: PlannerState, item: ItemTransferReference, targetCharacterId: string): PlannerNode {
	const source = locatePlannerItem(state, item)
	if (source?.location.container === 'characterEquipment' && source.location.characterId === targetCharacterId)
		return EMPTY_PLAN

	if (source?.location.container === 'vault')
		return series(
			parallel(
				ensureCharacterBucketSpace(state, targetCharacterId, source.item.bucketHash, [item]),
				ensureExoticConflictCleared(state, targetCharacterId, source.item, [item])
			),
			transferFromVaultStep(referenceFromPlannerItem(source.item), targetCharacterId),
			equipOnCharacterStep(referenceFromPlannerItem(source.item, targetCharacterId), targetCharacterId)
		)

	const prepared = prepareMovableCharacterInventorySource(state, item, source)
	if (!prepared.characterId)
		throw new TransferPlannerError('Unable to transfer item: Character required', 'stale-location')

	const preparedReference = referenceFromPlannerItem(prepared.item, prepared.characterId)
	if (prepared.characterId === targetCharacterId)
		return series(
			prepared.plan,
			ensureExoticConflictCleared(state, targetCharacterId, prepared.item, [item]),
			equipOnCharacterStep(preparedReference, targetCharacterId)
		)

	return series(
		prepared.plan,
		ensureVaultSpace(state),
		transferToVaultStep(preparedReference, prepared.characterId),
		parallel(
			ensureCharacterBucketSpace(state, targetCharacterId, prepared.item.bucketHash, [item]),
			ensureExoticConflictCleared(state, targetCharacterId, prepared.item, [item])
		),
		transferFromVaultStep(referenceFromPlannerItem(prepared.item), targetCharacterId),
		equipOnCharacterStep(referenceFromPlannerItem(prepared.item, targetCharacterId), targetCharacterId)
	)
}

function prepareMovableCharacterInventorySource (state: PlannerState, reference: ItemTransferReference, source: LocatedPlannerItem | undefined) {
	if (reference.isLostItem) {
		if (!reference.characterId)
			throw new TransferPlannerError('Unable to transfer item: Character required', 'stale-location')

		const item = source?.item ?? syntheticPlannerItem(state, reference)
		return {
			item,
			characterId: reference.characterId,
			plan: series(
				ensureCharacterBucketSpace(state, reference.characterId, item.bucketHash, [reference]),
				pullPostmasterStep(reference, reference.characterId, item.bucketHash)
			),
		}
	}

	if (!source)
		throw new TransferPlannerError('Unable to transfer item: Source item not found', 'stale-location')

	if (source.location.container === 'characterInventory')
		return { item: source.item, characterId: source.location.characterId, plan: EMPTY_PLAN }

	if (source.location.container === 'characterEquipment')
		return {
			item: source.item,
			characterId: source.location.characterId,
			plan: releaseEquippedSourceStep(state, source.location.characterId, source.item, [reference]),
		}

	throw new TransferPlannerError('Unable to transfer item: Character required', 'stale-location')
}

function ensureCharacterBucketSpace (state: PlannerState, characterId: string, bucketHash: number, excluded: ItemTransferReference[] = []): PlannerNode {
	if (countCharacterBucketItems(state, characterId, bucketHash) < bucketCapacity(state, bucketHash))
		return EMPTY_PLAN

	const candidate = state.inventory.characters[characterId]?.items
		.find(item => item.bucketHash === bucketHash && !isReservedOrExcluded(state, item, excluded))
	if (!candidate)
		throw new TransferPlannerError('Unable to transfer item: Bucket full', 'bucket-full')

	state.reservedItems.add(itemKey(referenceFromPlannerItem(candidate, characterId)))
	return series(
		ensureVaultSpace(state),
		transferToVaultStep(referenceFromPlannerItem(candidate, characterId), characterId)
	)
}

function ensureVaultSpace (state: PlannerState): PlannerNode {
	if (countVaultItems(state) < bucketCapacity(state, InventoryBucketHashes.General))
		return EMPTY_PLAN

	throw new TransferPlannerError('Unable to transfer item: Vault full', 'bucket-full')
}

function ensureExoticConflictCleared (state: PlannerState, characterId: string, incoming: ItemInstance, excluded: ItemTransferReference[] = []): PlannerNode {
	if (!isExotic(state, incoming))
		return EMPTY_PLAN

	const incomingLabel = uniqueEquipLabel(state, incoming)
	if (!incomingLabel)
		return EMPTY_PLAN

	const conflict = state.inventory.characters[characterId]?.equippedItems
		.find(item => item.bucketHash !== incoming.bucketHash && uniqueEquipLabel(state, item) === incomingLabel)
	if (!conflict)
		return EMPTY_PLAN

	return equipFallbackForBucket(state, characterId, conflict.bucketHash, [...excluded, referenceFromPlannerItem(incoming)])
}

function releaseEquippedSourceStep (state: PlannerState, characterId: string, source: ItemInstance, excluded: ItemTransferReference[] = []): PlannerNode {
	return equipFallbackForBucket(state, characterId, source.bucketHash, [...excluded, referenceFromPlannerItem(source, characterId)])
}

function equipFallbackForBucket (state: PlannerState, characterId: string, bucketHash: number, excluded: ItemTransferReference[]): PlannerNode {
	const candidate = fallbackCandidates(state, characterId, bucketHash, excluded)[0]
	if (!candidate)
		throw new TransferPlannerError('Unable to equip fallback item: No legal fallback', 'equip-restriction')

	state.reservedItems.add(itemKey(referenceFromPlannerItem(candidate.item, 'characterId' in candidate.location ? candidate.location.characterId : undefined)))
	switch (candidate.location.container) {
		case 'characterInventory':
			if (candidate.location.characterId === characterId)
				return equipOnCharacterStep(referenceFromPlannerItem(candidate.item, characterId), characterId)

			return series(
				ensureVaultSpace(state),
				transferToVaultStep(referenceFromPlannerItem(candidate.item, candidate.location.characterId), candidate.location.characterId),
				ensureCharacterBucketSpace(state, characterId, bucketHash, excluded),
				transferFromVaultStep(referenceFromPlannerItem(candidate.item), characterId),
				equipOnCharacterStep(referenceFromPlannerItem(candidate.item, characterId), characterId)
			)

		case 'vault':
			return series(
				ensureCharacterBucketSpace(state, characterId, bucketHash, excluded),
				transferFromVaultStep(referenceFromPlannerItem(candidate.item), characterId),
				equipOnCharacterStep(referenceFromPlannerItem(candidate.item, characterId), characterId)
			)

		case 'characterEquipment':
			return series(
				releaseEquippedSourceStep(state, candidate.location.characterId, candidate.item, excluded),
				ensureVaultSpace(state),
				transferToVaultStep(referenceFromPlannerItem(candidate.item, candidate.location.characterId), candidate.location.characterId),
				ensureCharacterBucketSpace(state, characterId, bucketHash, excluded),
				transferFromVaultStep(referenceFromPlannerItem(candidate.item), characterId),
				equipOnCharacterStep(referenceFromPlannerItem(candidate.item, characterId), characterId)
			)

		default:
			throw new TransferPlannerError('Unable to equip fallback item: Unsupported fallback source', 'equip-restriction')
	}
}

function fallbackCandidates (state: PlannerState, characterId: string, bucketHash: number, excluded: ItemTransferReference[]): LocatedPlannerItem[] {
	const legal = (located: LocatedPlannerItem) => located.item.bucketHash === bucketHash
		&& !!located.item.id
		&& !isReservedOrExcluded(state, located.item, excluded)
		&& isCharacterLegalForItem(state, characterId, located.item)

	const preferLegendary = (a: LocatedPlannerItem, b: LocatedPlannerItem) => Number(isExotic(state, a.item)) - Number(isExotic(state, b.item))
	const character = state.inventory.characters[characterId]
	const sameCharacter = character?.items
		.map(item => ({ item, location: { container: 'characterInventory', characterId } satisfies InventoryPatchLocation }))
		.filter(legal)
		.sort(preferLegendary) ?? []
	const vault = state.inventory.profileItems
		.map(item => ({ item, location: { container: 'vault' } satisfies InventoryPatchLocation }))
		.filter(legal)
		.sort(preferLegendary)
	const otherCharacters = Object.values(state.inventory.characters)
		.filter(character => character.id !== characterId)
	const otherInventory = otherCharacters
		.flatMap(character => character.items.map(item => ({ item, location: { container: 'characterInventory', characterId: character.id } satisfies InventoryPatchLocation })))
		.filter(legal)
		.sort(preferLegendary)
	const otherEquipment = otherCharacters
		.flatMap(character => character.equippedItems.map(item => ({ item, location: { container: 'characterEquipment', characterId: character.id } satisfies InventoryPatchLocation })))
		.filter(legal)
		.sort(preferLegendary)

	return [
		...sameCharacter,
		...vault,
		...otherInventory,
		...otherEquipment,
	]
}

function transferToVaultStep (item: ItemTransferReference, characterId: string): PlannerNode {
	return step({
		label: 'transfer-to-vault',
		async execute (state) {
			const body = transferBody(state.profile, item, characterId, true)
			await transferItem(state.profile, body, state.context)
			const patches = await transferPatchesForBody(body)
			applyPlannerPatches(state, patches)
			return patches
		},
		async revert (state) {
			const body = transferBody(state.profile, item, characterId, false)
			await transferItem(state.profile, body, state.context)
			const patches = await transferPatchesForBody(body)
			applyPlannerPatches(state, patches)
			return patches
		},
	})
}

function transferFromVaultStep (item: ItemTransferReference, characterId: string): PlannerNode {
	return step({
		label: 'transfer-from-vault',
		async execute (state) {
			const body = transferBody(state.profile, item, characterId, false)
			await transferItem(state.profile, body, state.context)
			const patches = await transferPatchesForBody(body)
			applyPlannerPatches(state, patches)
			return patches
		},
		async revert (state) {
			const body = transferBody(state.profile, item, characterId, true)
			await transferItem(state.profile, body, state.context)
			const patches = await transferPatchesForBody(body)
			applyPlannerPatches(state, patches)
			return patches
		},
	})
}

function pullPostmasterStep (item: ItemTransferReference, characterId: string, bucketHash: number): PlannerNode {
	return step({
		label: 'pull-from-postmaster',
		async execute (state) {
			await pullFromPostmaster(state.profile, {
				membershipType: state.profile.type,
				itemId: item.instanceId ?? '0',
				itemReferenceHash: item.itemHash,
				stackSize: item.stackSize ?? 1,
				characterId,
			}, state.context)
			const patches: InventoryPatch[] = [{
				type: 'bucket-correction',
				item: itemReferenceFromItem(item),
				location: { container: 'characterInventory', characterId },
				bucketHash,
			}]
			applyPlannerPatches(state, patches)
			return patches
		},
	})
}

function equipOnCharacterStep (item: ItemTransferReference, characterId: string): PlannerNode {
	return step({
		label: 'equip-item',
		async execute (state) {
			await equipItem(state.profile, characterId, item, state.context)
			const patches: InventoryPatch[] = [{
				type: 'move',
				item: itemReferenceFromItem(item),
				from: { container: 'characterInventory', characterId },
				to: { container: 'characterEquipment', characterId },
			}]
			applyPlannerPatches(state, patches)
			return patches
		},
		async revert (state) {
			const displaced = state.inventory.characters[characterId]?.items
				.find(candidate => candidate.bucketHash === item.bucketHash && !itemMatchesReference(candidate, item))
			if (!displaced?.id)
				throw new TransferPlannerError('Unable to recover equip step: Displaced item unknown', 'stale-location')

			const revertItem = referenceFromPlannerItem(displaced, characterId)
			await equipItem(state.profile, characterId, revertItem, state.context)
			const patches: InventoryPatch[] = [{
				type: 'move',
				item: itemReferenceFromItem(revertItem),
				from: { container: 'characterInventory', characterId },
				to: { container: 'characterEquipment', characterId },
			}]
			applyPlannerPatches(state, patches)
			return patches
		},
	})
}

function transferBody (profile: Profile, item: ItemTransferReference, characterId: string, transferToVault: boolean): DestinyItemTransferRequest {
	return {
		membershipType: profile.type,
		itemId: item.instanceId ?? '0',
		itemReferenceHash: item.itemHash,
		stackSize: item.stackSize ?? 1,
		characterId,
		transferToVault,
	}
}

async function transferPatchesForBody (body: DestinyItemTransferRequest): Promise<InventoryPatch[]> {
	const itemInventoryBucket = await getItemInventoryBucket(body.itemReferenceHash)
	if (itemInventoryBucket?.isAccountScopedTransferBucket)
		return [{
			type: 'bucket-correction',
			item: itemReferenceFromTransferBody(body),
			location: { container: 'vault' },
			fromBucketHash: body.transferToVault ? itemInventoryBucket.bucketHash : InventoryBucketHashes.General,
			bucketHash: body.transferToVault ? InventoryBucketHashes.General : itemInventoryBucket.bucketHash,
		}]

	return movementInventoryPatches({
		item: itemReferenceFromTransferBody(body),
		from: body.transferToVault ? { container: 'characterInventory', characterId: body.characterId } : { container: 'vault' },
		to: body.transferToVault ? { container: 'vault' } : { container: 'characterInventory', characterId: body.characterId },
		destinationBucketHash: body.transferToVault ? undefined : await getItemInventoryBucketHash(body.itemReferenceHash),
	})
}

function applyPlannerPatches (state: PlannerState, patches: InventoryPatch[]) {
	for (const patch of patches) {
		switch (patch.type) {
			case 'move': {
				const source = plannerLocationItems(state, patch.from)
				const destination = plannerLocationItems(state, patch.to)
				const index = source.findIndex(item => itemMatchesReference(item, patch.item))
				if (index === -1)
					continue

				const [item] = source.splice(index, 1)
				const bucketHash = patch.to.container === 'vault'
					? InventoryBucketHashes.General
					: patch.to.container === 'postmaster'
						? state.itemDefs[item.itemHash]?.inventory?.bucketTypeHash ?? item.bucketHash
						: patch.to.container === 'characterEquipment'
							? item.bucketHash
							: patch.item.bucketHash ?? state.itemDefs[item.itemHash]?.inventory?.bucketTypeHash ?? item.bucketHash

				if (patch.to.container === 'characterEquipment') {
					const displacedIndex = destination.findIndex(candidate => candidate.bucketHash === item.bucketHash && !itemMatchesReference(candidate, patch.item))
					if (displacedIndex !== -1) {
						const [displaced] = destination.splice(displacedIndex, 1)
						plannerLocationItems(state, { container: 'characterInventory', characterId: patch.to.characterId }).push(displaced)
					}
				}

				destination.push({ ...item, bucketHash: bucketHash as never })
				break
			}

			case 'bucket-correction': {
				const items = plannerLocationItems(state, patch.location)
				const item = items.find(item => itemMatchesReference(item, patch.item))
				if (item)
					item.bucketHash = patch.bucketHash as never
				else if (patch.location.container === 'characterInventory')
					items.push(syntheticPlannerItem(state, { ...patch.item, characterId: patch.location.characterId, bucketHash: patch.bucketHash }))
				break
			}
		}
	}
}

function locatePlannerItem (state: PlannerState, reference: ItemTransferReference): LocatedPlannerItem | undefined {
	if (reference.isLostItem && reference.characterId) {
		const characterItems = state.inventory.characters[reference.characterId]?.items ?? []
		const item = characterItems.find(item => itemMatchesReference(item, reference))
		return {
			item: item ?? syntheticPlannerItem(state, reference),
			location: { container: 'postmaster', characterId: reference.characterId },
		}
	}

	for (const character of Object.values(state.inventory.characters)) {
		const inventoryItem = character.items.find(item => itemMatchesReference(item, reference))
		if (inventoryItem)
			return { item: inventoryItem, location: { container: 'characterInventory', characterId: character.id } }

		const equippedItem = character.equippedItems.find(item => itemMatchesReference(item, reference))
		if (equippedItem)
			return { item: equippedItem, location: { container: 'characterEquipment', characterId: character.id } }
	}

	const vaultItem = state.inventory.profileItems.find(item => itemMatchesReference(item, reference))
	if (vaultItem)
		return { item: vaultItem, location: { container: 'vault' } }
}

function plannerLocationItems (state: PlannerState, location: InventoryPatchLocation): ItemInstance[] {
	switch (location.container) {
		case 'vault':
			return state.inventory.profileItems
		case 'characterInventory':
		case 'postmaster':
			return state.inventory.characters[location.characterId]?.items ?? []
		case 'characterEquipment':
			return state.inventory.characters[location.characterId]?.equippedItems ?? []
	}
}

function countCharacterBucketItems (state: PlannerState, characterId: string, bucketHash: number) {
	return state.inventory.characters[characterId]?.items.filter(item => item.bucketHash === bucketHash).length ?? Infinity
}

function countVaultItems (state: PlannerState) {
	return state.inventory.profileItems.filter(item => item.bucketHash === InventoryBucketHashes.General).length
}

function bucketCapacity (state: PlannerState, bucketHash: number) {
	return state.bucketDefs[bucketHash]?.itemCount ?? Infinity
}

function syntheticPlannerItem (state: PlannerState, reference: ItemTransferReference | InventoryPatchItemReference): ItemInstance {
	const bucketHash = reference.bucketHash ?? state.itemDefs[reference.itemHash]?.inventory?.bucketTypeHash ?? InventoryBucketHashes.General
	return {
		is: 'item-instance',
		id: reference.instanceId,
		itemHash: reference.itemHash,
		bucketHash: bucketHash as never,
		quantity: reference.stackSize,
		state: 0,
	}
}

function referenceFromPlannerItem (item: ItemInstance, characterId?: string): ItemTransferReference {
	return {
		instanceId: item.id,
		itemHash: item.itemHash,
		characterId,
		stackSize: item.quantity,
		bucketHash: item.bucketHash,
	}
}

function itemMatchesReference (item: ItemInstance, reference: ItemTransferReference | InventoryPatchItemReference): boolean {
	return (!!reference.instanceId && item.id === reference.instanceId)
		|| (!reference.instanceId
			&& item.itemHash === reference.itemHash
			&& (reference.stackSize === undefined || item.quantity === reference.stackSize)
			&& (reference.bucketHash === undefined || item.bucketHash === reference.bucketHash))
}

function itemKey (item: ItemTransferReference | InventoryPatchItemReference) {
	return item.instanceId ?? `${item.itemHash}:${item.stackSize ?? 1}:${item.bucketHash ?? ''}`
}

function isReservedOrExcluded (state: PlannerState, item: ItemInstance, excluded: ItemTransferReference[]) {
	const reference = referenceFromPlannerItem(item)
	return state.reservedItems.has(itemKey(reference)) || excluded.some(excluded => itemMatchesReference(item, excluded))
}

function isCharacterLegalForItem (state: PlannerState, characterId: string, item: ItemInstance) {
	const itemDef = state.itemDefs[item.itemHash]
	const itemClass = itemDef?.classType
	const characterClass = state.inventory.characters[characterId]?.metadata.classType
	return itemClass === undefined || itemClass === 3 || itemClass === characterClass
}

function isExotic (state: PlannerState, item: ItemInstance) {
	return state.itemDefs[item.itemHash]?.inventory?.tierType === TierType.Exotic
}

function uniqueEquipLabel (state: PlannerState, item: ItemInstance) {
	return state.itemDefs[item.itemHash]?.equippingBlock?.uniqueLabel
}

async function executePlannedTransfer (
	origin: string,
	operationId: string,
	options: ItemTransferOptions,
	compile: (state: PlannerState) => PlannerNode,
	actions: ItemTransferAction[]
): Promise<ItemTransferAction[]> {
	const auth = await Auth.getValid()
	const profile = await Profiles.getCurrentProfile(auth)
	if (!profile) {
		Broadcast.warning('user', 'Unable to transfer item: Not authenticated')
		return []
	}

	const state = await createPlannerState(profile, operationId, origin)
	try {
		await executePlan(state, compile(state))
		return actions
	}
	catch (err) {
		const recoveryResult = options.recoveryPolicy === 'best-effort-revert'
			? await recoverExecutedSteps(state)
			: 'not-attempted'
		await broadcastFailure(origin, operationId, plannerStepErrorLabel(err, 'transfer-planner'), err, options, recoveryResult, state.patches)
		if (typeof err === 'object' && err)
			Object.assign(err, { failureBroadcasted: true })
		throw err
	}
}

namespace ItemTransfer {

	export async function vaultItem (origin: string, item: ItemTransferReference, options: ItemTransferOptions = {}): Promise<ItemTransferAction[]> {
		const id = options.operationId ?? operationId()
		await broadcastIntent(origin, {
			operationId: id,
			action: 'vault-item',
			item,
			to: 'vault',
			recoveryPolicy: options.recoveryPolicy,
		})

		return await Broadcast.operation('Vaulting item', [relatedItem(item), ...relatedCharacter(item.characterId)], async () => await runTransferOperation(origin, id, 'vault-item', options, async () =>
			await executePlannedTransfer(origin, id, options, state => compileVaultRoute(state, item), [
				{ item, to: 'vault' },
			])
		))
	}

	export async function moveItemToCharacter (origin: string, characterId: string, item: ItemTransferReference, options: ItemTransferOptions = {}): Promise<ItemTransferAction[]> {
		const id = options.operationId ?? operationId()
		await broadcastIntent(origin, {
			operationId: id,
			action: 'move-item-to-character',
			item,
			to: 'character',
			characterId,
			recoveryPolicy: options.recoveryPolicy,
		})

		return await Broadcast.operation('Moving item to character', [relatedItem(item), ...relatedCharacter(characterId)], async () => await runTransferOperation(origin, id, 'move-item-to-character', options, async () =>
			await executePlannedTransfer(origin, id, options, state => compileCharacterRoute(state, item, characterId), [
				{ item, to: 'character', newCharacterId: characterId },
			])
		))
	}

	export async function equipItemOnCharacter (origin: string, characterId: string, item: ItemTransferReference, options: ItemTransferOptions = {}): Promise<ItemTransferAction[]> {
		const id = options.operationId ?? operationId()
		await broadcastIntent(origin, {
			operationId: id,
			action: 'equip-item-on-character',
			item,
			to: 'equipped',
			characterId,
			recoveryPolicy: options.recoveryPolicy,
		})

		return await runTransferOperation(origin, id, 'equip-item-on-character', options, async () =>
			await executePlannedTransfer(origin, id, options, state => compileEquipRoute(state, item, characterId), [
				{ item, to: 'equipped', newCharacterId: characterId },
			])
		)
	}

}

export default ItemTransfer
