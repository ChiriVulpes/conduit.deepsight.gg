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
import type { DestinyItemTransferRequest, DestinyPostmasterTransferRequest } from 'bungie-api-ts/destiny2'
import Auth from 'model/Auth'
import Definitions from 'model/Definitions'
import InventoryModel from 'model/Inventory'
import {
	ProfilePatch,
	type ProfilePatchApplyContext,
} from 'model/ProfilePatch'
import type {
	ProfileOverride,
	ProfileOverrideMoveWhere,
	ProfileOverrideSetWhere,
	ProfileOverrideWhere,
} from 'model/DestinyProfiles'
import Profiles from 'model/Profiles'
import Broadcast from 'utility/Broadcast'
import Bungie from 'utility/Bungie'
import { SKIP_CLIENT } from 'utility/Service'

interface ItemMovementProfilePatchParams {
	item: InventoryPatchItemReference
	from: InventoryPatchLocation
	to: InventoryPatchLocation
}

interface PostmasterBucketCorrectionProfilePatchParams {
	item: InventoryPatchItemReference
	characterId: string
	bucketHash: number
}

const CharacterInventoryToVaultPatch = new ProfilePatch<ItemMovementProfilePatchParams>({
	id: 'character-inventory-to-vault',
	fromParams: moveWhereOverride,
	toParams: override => movementFromOverride(
		override,
		{ container: 'characterInventory', characterId: override.type === 'move-where' ? override.fromArrayPath[2] : '' },
		{ container: 'vault' }
	),
	onApply: (profile, params, override, context) => broadcastInventoryPatch(profile, { type: 'move', ...params }, context),
})

const VaultToCharacterInventoryPatch = new ProfilePatch<ItemMovementProfilePatchParams>({
	id: 'vault-to-character-inventory',
	fromParams: moveWhereOverride,
	toParams: override => movementFromOverride(
		override,
		{ container: 'vault' },
		{ container: 'characterInventory', characterId: override.type === 'move-where' ? override.toArrayPath[2] : '' }
	),
	onApply: (profile, params, override, context) => broadcastInventoryPatch(profile, { type: 'move', ...params }, context),
})

const PostmasterBucketCorrectionPatch = new ProfilePatch<PostmasterBucketCorrectionProfilePatchParams>({
	id: 'postmaster-bucket-correction',
	fromParams: bucketCorrectionOverride,
	toParams: bucketCorrectionFromOverride,
	onApply: (profile, params, override, context) => broadcastInventoryPatch(profile, {
		type: 'bucket-correction',
		item: params.item,
		location: { container: 'characterInventory', characterId: params.characterId },
		bucketHash: params.bucketHash,
	}, context),
})

const CharacterInventoryToEquipmentPatch = new ProfilePatch<ItemMovementProfilePatchParams>({
	id: 'character-inventory-to-equipment',
	fromParams: moveWhereOverride,
	toParams: override => movementFromOverride(
		override,
		{ container: 'characterInventory', characterId: override.type === 'move-where' ? override.fromArrayPath[2] : '' },
		{ container: 'characterEquipment', characterId: override.type === 'move-where' ? override.toArrayPath[2] : '' }
	),
	onApply: (profile, params, override, context) => broadcastInventoryPatch(profile, { type: 'move', ...params }, context),
})

const EquipmentToCharacterInventoryPatch = new ProfilePatch<ItemMovementProfilePatchParams>({
	id: 'equipment-to-character-inventory',
	fromParams: moveWhereOverride,
	toParams: override => movementFromOverride(
		override,
		{ container: 'characterEquipment', characterId: override.type === 'move-where' ? override.fromArrayPath[2] : '' },
		{ container: 'characterInventory', characterId: override.type === 'move-where' ? override.toArrayPath[2] : '' }
	),
	onApply: (profile, params, override, context) => broadcastInventoryPatch(profile, { type: 'move', ...params }, context),
})

function itemMatcher (item: InventoryPatchItemReference): ProfileOverrideWhere {
	const conditions: ProfileOverrideWhere[] = []
	if (item.instanceId)
		conditions.push({ path: ['itemInstanceId'], value: item.instanceId })

	conditions.push({
		and: [
			{ path: ['itemInstanceId'], value: undefined },
			{ path: ['itemHash'], value: item.itemHash },
			{ path: ['quantity'], value: item.stackSize },
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
	if (typeof itemHash !== 'number')
		return undefined

	return {
		instanceId: typeof byInstance?.value === 'string' ? byInstance.value : undefined,
		itemHash,
		stackSize: typeof stackSize === 'number' ? stackSize : undefined,
	}
}

function valueForWherePath (conditions: ProfileOverrideWhere[], path: string[]) {
	return conditions.find(condition => isWherePath(condition, path))?.value
}

function isWherePath (condition: ProfileOverrideWhere, path: string[]): condition is Extract<ProfileOverrideWhere, { path: string[], value: unknown }> {
	return 'path' in condition && arrayEquals(condition.path, path)
}

function moveWhereOverride (params: ItemMovementProfilePatchParams): ProfileOverrideMoveWhere {
	return {
		type: 'move-where',
		fromArrayPath: locationItemsPath(params.from),
		toArrayPath: locationItemsPath(params.to),
		where: [itemMatcher(params.item)],
		time: Date.now(),
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

function bucketCorrectionOverride (params: PostmasterBucketCorrectionProfilePatchParams): ProfileOverrideSetWhere {
	return {
		type: 'set-where',
		arrayPath: locationItemsPath({ container: 'characterInventory', characterId: params.characterId }),
		where: [itemMatcher(params.item)],
		modifyPath: ['bucketHash'],
		value: params.bucketHash,
		time: Date.now(),
	}
}

function bucketCorrectionFromOverride (override: ProfileOverride): PostmasterBucketCorrectionProfilePatchParams | undefined {
	if (override.type !== 'set-where' || !arrayEquals(override.modifyPath, ['bucketHash']) || typeof override.value !== 'number')
		return undefined

	const location = locationFromItemsPath(override.arrayPath)
	if (location?.container !== 'characterInventory')
		return undefined

	const item = itemFromMatcher(override.where)
	if (!item)
		return undefined

	return {
		item,
		characterId: location.characterId,
		bucketHash: override.value,
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

function locationItemsPath (location: InventoryPatchLocation): string[] {
	switch (location.container) {
		case 'vault': return ['profileInventory', 'data', 'items']
		case 'characterInventory': return ['characterInventories', 'data', location.characterId, 'items']
		case 'characterEquipment': return ['characterEquipment', 'data', location.characterId, 'items']
		case 'postmaster': return ['characterInventories', 'data', location.characterId, 'items']
	}
}

function locationFromItemsPath (path: string[]): InventoryPatchLocation | undefined {
	if (arrayEquals(path, ['profileInventory', 'data', 'items']))
		return { container: 'vault' }

	if (path.length !== 5 || (path[0] !== 'characterInventories' && path[0] !== 'characterEquipment') || path[1] !== 'data' || path[4] !== 'items')
		return undefined

	return {
		container: path[0] === 'characterInventories' ? 'characterInventory' : 'characterEquipment',
		characterId: path[2],
	}
}

function arrayEquals (a: readonly unknown[], b: readonly unknown[]) {
	return a.length === b.length && a.every((value, i) => value === b[i])
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
		if (body.transferToVault)
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
			}, context)
	})
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

	const inventory = await InventoryModel.for(profile).use(true).then(result => result.value)
	const character = inventory?.characters[characterId]
	const sourceItem = character?.items.find(candidate => candidate.id === item.instanceId)
	const itemBucketHash = sourceItem?.bucketHash
		?? await Definitions.en.DestinyInventoryItemDefinition.get()
			.then(DestinyInventoryItemDefinition => DestinyInventoryItemDefinition[item.itemHash]?.inventory?.bucketTypeHash)
	const displacedItem = itemBucketHash && character?.equippedItems.find(candidate => candidate.bucketHash === itemBucketHash && candidate.id !== item.instanceId)

	await Broadcast.operation('Equipping item', [relatedItem(item), ...relatedCharacter(characterId)], async () => {
		await Bungie.postForUser('/Destiny2/Actions/Items/EquipItem/', {
			membershipType: profile.type,
			itemId: item.instanceId,
			characterId,
		} as never)

		const patches: InventoryPatch[] = []
		const equippedPatch: InventoryPatch = {
			type: 'move',
			item: itemReferenceFromItem(item),
			from: { container: 'characterInventory', characterId },
			to: { container: 'characterEquipment', characterId },
		}
		await CharacterInventoryToEquipmentPatch.apply(profile, {
			item: equippedPatch.item,
			from: equippedPatch.from,
			to: equippedPatch.to,
		})
		patches.push(equippedPatch)

		if (displacedItem) {
			const displacedPatch: InventoryPatch = {
				type: 'move',
				item: {
					instanceId: displacedItem.id,
					itemHash: displacedItem.itemHash,
					stackSize: displacedItem.quantity,
				},
				from: { container: 'characterEquipment', characterId },
				to: { container: 'characterInventory', characterId },
			}
			await EquipmentToCharacterInventoryPatch.apply(profile, {
				item: displacedPatch.item,
				from: displacedPatch.from,
				to: displacedPatch.to,
			})
			patches.push(displacedPatch)
		}

		await broadcastInventoryPatches(profile, patches, context)
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
