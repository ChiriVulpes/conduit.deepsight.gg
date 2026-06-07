import type { InventoryPatch, InventoryPatchItemReference, InventoryPatchLocation, ItemTransferFailure, ItemTransferIntent, ItemTransferReference } from 'conduit.deepsight.gg/ConduitMessageRegistry'
import type InventoryModel from 'conduit.deepsight.gg/item/Inventory'
import type { ItemInstance } from 'conduit.deepsight.gg/item/Item'
import { InventoryBucketHashes } from 'deepsight.gg/Enums'

export interface InventoryTransferEventSource {
	on: {
		itemTransferIntent (handler: (data: ItemTransferIntent) => unknown): () => void
		inventoryPatch (handler: (data: { operationId: string, profile: { id: string }, patches: InventoryPatch[] }) => unknown): () => void
		itemTransferFailure (handler: (data: ItemTransferFailure) => unknown): () => void
		itemTransferComplete (handler: (data: { operationId: string }) => unknown): () => void
	}
}

export interface InventoryTransferCommandSource extends InventoryTransferEventSource {
	vaultItem (item: ItemTransferReference): Promise<unknown>
	moveItemToCharacter (characterId: string, item: ItemTransferReference): Promise<unknown>
	equipItemOnCharacter (characterId: string, item: ItemTransferReference): Promise<unknown>
}

export interface InventoryTransferOperationState extends ItemTransferIntent {
	affectedItems: readonly ItemTransferReference[]
}

export interface InventoryTransferFailureState extends InventoryTransferOperationState {
	failure: ItemTransferFailure
}

export interface InventoryTransferPatchMiss {
	operation?: InventoryTransferOperationState
	patch: InventoryPatch
}

export interface InventoryTransferDisplayState {
	pending: readonly InventoryTransferOperationState[]
	failures: readonly InventoryTransferFailureState[]
	patchMisses?: readonly InventoryTransferPatchMiss[]
}

export interface InventoryTransferObserverOptions {
	getInventory (): InventoryModel | undefined
	setInventory (inventory: InventoryModel): void
	refreshInventory? (): void
	getCurrentProfileId (): string | undefined
	onTransferStateChange? (state: InventoryTransferDisplayState): void
}

export type InventoryTransferPredictedOperation = Omit<InventoryTransferOperationState, 'operationId'> & {
	operationId?: string
}

export interface InventoryTransferObserver {
	addPredictedOperation (operation: InventoryTransferPredictedOperation): () => void
	setBaseInventory (inventory: InventoryModel | undefined): void
	unsubscribe (): void
}

export interface InventoryTransferControllerOptions extends InventoryTransferObserverOptions {
	getDefaultCharacterId? (): string | undefined
}

export interface InventoryTransferController {
	equipItem (item: InventoryTransferItemLike): Promise<void>
	vaultItem (item: InventoryTransferItemLike): Promise<void>
	moveItemToCharacter (item: InventoryTransferItemLike, characterId?: string): Promise<void>
	setBaseInventory (inventory: InventoryModel | undefined): void
	unsubscribe (): void
}

export type InventoryTransferItemLike =
	| ItemInstance
	| { instance?: ItemInstance }
	| undefined

export interface InventoryPatchApplyResult {
	inventory: InventoryModel
	applied: boolean
}

namespace Inventory {

	export function applyPatch (inventory: InventoryModel, patch: InventoryPatch): InventoryModel {
		return applyPatchResult(inventory, patch).inventory
	}

	export function applyPatchResult (inventory: InventoryModel, patch: InventoryPatch): InventoryPatchApplyResult {
		const next = cloneInventory(inventory)
		switch (patch.type) {
			case 'move': {
				const source = getLocationItems(next, patch.from)
				const destination = getLocationItems(next, patch.to)
				const index = findItemIndex(source, patch.item)
				if (index === -1) {
					if (findItemIndex(destination, patch.item) !== -1)
						return { inventory, applied: true }

					const alternateSource = findMoveSource(next, patch.item, destination)
					if (!alternateSource)
						return { inventory, applied: false }

					const alternateIndex = findItemIndex(alternateSource, patch.item)
					if (alternateIndex === -1)
						return { inventory, applied: false }

					const [item] = alternateSource.splice(alternateIndex, 1)
					const movedItem = itemForMoveDestination(next, patch, item)
					applyEquipmentDisplacement(next, patch, movedItem)
					destination.push(movedItem)
					return { inventory: next, applied: true }
				}

				const [item] = source.splice(index, 1)
				const movedItem = itemForMoveDestination(next, patch, item)
				applyEquipmentDisplacement(next, patch, movedItem)
				destination.push(movedItem)
				return { inventory: next, applied: true }
			}

			case 'bucket-correction': {
				const items = getLocationItems(next, patch.location)
				const item = items[findItemIndex(items, patch.item)]
				if (!item)
					return { inventory, applied: false }

				item.bucketHash = patch.bucketHash as never
				return { inventory: next, applied: true }
			}
		}

		return { inventory, applied: false }
	}

	export function applyPatches (inventory: InventoryModel, patches: readonly InventoryPatch[]): InventoryModel {
		return patches.reduce(applyPatch, inventory)
	}

	function applyPatchBatchResult (inventory: InventoryModel, patches: readonly InventoryPatch[]) {
		let current = inventory
		const missed: InventoryPatch[] = []
		let applied = false
		for (const patch of patches) {
			const result = applyPatchResult(current, patch)
			current = result.inventory
			if (result.applied)
				applied = true
			else
				missed.push(patch)
		}

		return {
			inventory: current,
			applied,
			missed,
		}
	}

	export function observeTransfers (source: InventoryTransferEventSource, options: InventoryTransferObserverOptions): InventoryTransferObserver {
		const pending = new Map<string, InventoryTransferOperationState>()
		const operations = new Map<string, InventoryTransferOperationState>()
		const predictedOperationKeys = new Map<string, string>()
		const failures = new Map<string, InventoryTransferFailureState>()
		const patchMisses = new Map<string, InventoryTransferPatchMiss>()
		const patchEvents: { operationId: string, patches: InventoryPatch[] }[] = []
		const failureTimeouts = new Map<string, number>()
		let baseInventory = options.getInventory()
		const emitState = () => options.onTransferStateChange?.({
			pending: [...pending.values()],
			failures: [...failures.values()],
			patchMisses: [...patchMisses.values()],
		})
		const setBaseInventory = (inventory: InventoryModel | undefined) => {
			baseInventory = inventory
			patchEvents.splice(0, Infinity)
			if (inventory)
				options.setInventory(inventory)
		}
		const clearPatchMisses = (operationId: string) => {
			for (const key of patchMisses.keys())
				if (key === operationId || key.startsWith(`${operationId}:`))
					patchMisses.delete(key)
		}
		const clearFailure = (operationId: string) => {
			const timeout = failureTimeouts.get(operationId)
			if (timeout !== undefined)
				clearTimeout(timeout)

			failures.delete(operationId)
			failureTimeouts.delete(operationId)
		}

		const unsubscribers = [
			source.on.itemTransferIntent(intent => {
				const operationKey = operationDedupeKey(intent)
				const predictedOperationId = predictedOperationKeys.get(operationKey)
				if (predictedOperationId) {
					const predictedOperation = operations.get(predictedOperationId)
					pending.delete(predictedOperationId)
					operations.delete(predictedOperationId)
					predictedOperationKeys.delete(operationKey)
					if (predictedOperation)
						pending.set(intent.operationId, { ...intent, affectedItems: predictedOperation.affectedItems })
					else
						pending.set(intent.operationId, enrichOperation(intent, options.getInventory()))

					operations.set(intent.operationId, pending.get(intent.operationId)!)
					emitState()
					return
				}

				const operation = enrichOperation(intent, options.getInventory())
				pending.set(intent.operationId, operation)
				operations.set(intent.operationId, operation)
				clearPatchMisses(intent.operationId)
				clearFailure(intent.operationId)
				emitState()
			}),
			source.on.inventoryPatch(event => {
				if (event.profile.id !== options.getCurrentProfileId())
					return

				baseInventory ??= options.getInventory()
				patchEvents.push({
					operationId: event.operationId,
					patches: event.patches,
				})
				if (!baseInventory)
					return

				const result = applyPatchBatchResult(baseInventory, patchEvents.flatMap(event => event.patches))
				if (result.applied)
					clearPatchMisses(event.operationId)

				if (result.missed.length)
					for (const patch of result.missed)
						patchMisses.set(`${event.operationId}:${patchMisses.size}`, {
							operation: operations.get(event.operationId),
							patch,
						})

				options.setInventory(result.inventory)
				clearFailure(event.operationId)
				emitState()
			}),
			source.on.itemTransferFailure(failure => {
				pending.delete(failure.operationId)
				const operation = operations.get(failure.operationId)
				if (operation) {
					clearFailure(failure.operationId)
					failures.set(failure.operationId, { ...operation, failure })
					const timeout = setTimeout(() => {
						failures.delete(failure.operationId)
						failureTimeouts.delete(failure.operationId)
						emitState()
					}, 5000)
					failureTimeouts.set(failure.operationId, timeout)
				}
				emitState()
			}),
			source.on.itemTransferComplete(complete => {
				pending.delete(complete.operationId)
				operations.delete(complete.operationId)
				clearFailure(complete.operationId)
				emitState()
			}),
		]

		emitState()
		return {
			addPredictedOperation (operation) {
				const predictedOperation: InventoryTransferOperationState = {
					...operation,
					operationId: operation.operationId ?? `predicted:${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
				}
				const key = operationDedupeKey(predictedOperation)
				const existingOperationId = predictedOperationKeys.get(key)
				if (existingOperationId) {
					pending.delete(existingOperationId)
					operations.delete(existingOperationId)
				}

				pending.set(predictedOperation.operationId, predictedOperation)
				operations.set(predictedOperation.operationId, predictedOperation)
				predictedOperationKeys.set(key, predictedOperation.operationId)
				emitState()
				return () => {
					if (!pending.has(predictedOperation.operationId))
						return

					pending.delete(predictedOperation.operationId)
					operations.delete(predictedOperation.operationId)
					if (predictedOperationKeys.get(key) === predictedOperation.operationId)
						predictedOperationKeys.delete(key)
					emitState()
				}
			},
			setBaseInventory,
			unsubscribe () {
				unsubscribers.forEach(unsubscribe => unsubscribe())
				for (const timeout of failureTimeouts.values())
					clearTimeout(timeout)
			},
		}
	}

	export function transfers (source: InventoryTransferCommandSource, options: InventoryTransferControllerOptions): InventoryTransferController {
		const observer = observeTransfers(source, {
			...options,
			onTransferStateChange: state => {
				options.onTransferStateChange?.(state)
			},
		})

		const runPredicted = async (operation: InventoryTransferPredictedOperation, run: () => Promise<unknown>) => {
			const clear = observer.addPredictedOperation(operation)
			try {
				await run()
			}
			finally {
				clear()
			}
		}

		const moveItemToCharacter = async (itemLike: InventoryTransferItemLike, characterId = options.getDefaultCharacterId?.()) => {
			const item = itemInstanceFromLike(itemLike)
			if (!item || !characterId)
				return

			const location = findCurrentItemLocation(options.getInventory(), item)
			if (location?.location !== 'vault')
				return

			const reference = itemReferenceFromInstance(location.item)
			await runPredicted({
				action: 'move-item-to-character',
				item: reference,
				affectedItems: affectedItemsForAction('move-item-to-character', location.item, options.getInventory()),
				to: 'character',
				characterId,
			}, async () => await source.moveItemToCharacter(characterId, reference))
		}

		const equipItem = async (itemLike: InventoryTransferItemLike) => {
			const item = itemInstanceFromLike(itemLike)
			if (!item)
				return

			const location = findCurrentItemLocation(options.getInventory(), item)
			if (location?.location === 'vault') {
				await moveItemToCharacter(location.item, options.getDefaultCharacterId?.())
				return
			}

			if (location?.location !== 'character-inventory' || location.item.bucketHash === InventoryBucketHashes.LostItems)
				return

			const reference = itemReferenceFromInstance(location.item, location.characterId)
			await runPredicted({
				action: 'equip-item-on-character',
				item: reference,
				affectedItems: affectedItemsForAction('equip-item-on-character', location.item, options.getInventory(), location.characterId),
				to: 'equipped',
				characterId: location.characterId,
			}, async () => await source.equipItemOnCharacter(location.characterId, reference))
		}

		const vaultItem = async (itemLike: InventoryTransferItemLike) => {
			const item = itemInstanceFromLike(itemLike)
			if (!item)
				return

			const location = findCurrentItemLocation(options.getInventory(), item)
			if (location?.location !== 'character-inventory' || location.item.bucketHash === InventoryBucketHashes.LostItems)
				return

			const reference = itemReferenceFromInstance(location.item, location.characterId)
			await runPredicted({
				action: 'vault-item',
				item: reference,
				affectedItems: affectedItemsForAction('vault-item', location.item, options.getInventory(), location.characterId),
				to: 'vault',
			}, async () => await source.vaultItem(reference))
		}

		return {
			equipItem,
			vaultItem,
			moveItemToCharacter,
			setBaseInventory: observer.setBaseInventory,
			unsubscribe () {
				observer.unsubscribe()
			},
		}
	}

	function enrichOperation (intent: ItemTransferIntent, inventory: InventoryModel | undefined): InventoryTransferOperationState {
		const affectedItems: ItemTransferReference[] = [intent.item]
		if (intent.action === 'equip-item-on-character' && intent.characterId && inventory) {
			const character = inventory.characters[intent.characterId]
			const sourceItem = character?.items.find(item => itemMatchesReference(item, intent.item))
			if (sourceItem)
				affectedItems.push(...affectedItemsForAction(intent.action, sourceItem, inventory, intent.characterId).slice(1))
		}

		return { ...intent, affectedItems }
	}

	function affectedItemsForAction (action: ItemTransferIntent['action'], item: ItemInstance, inventory: InventoryModel | undefined, characterId?: string): ItemTransferReference[] {
		const affectedItems = [itemReferenceFromInstance(item, characterId)]
		if (action === 'equip-item-on-character' && characterId) {
			const equippedItems = inventory?.characters[characterId]?.equippedItems ?? []
			affectedItems.push(...equippedItems
				.filter(candidate => candidate.bucketHash === item.bucketHash && !itemInstanceMatches(candidate, item))
				.map(item => itemReferenceFromInstance(item, characterId))
			)
		}

		return affectedItems
	}

	function itemInstanceFromLike (itemLike: InventoryTransferItemLike): ItemInstance | undefined {
		if (!itemLike)
			return undefined

		return hasInstanceProperty(itemLike) ? itemLike.instance : itemLike
	}

	function hasInstanceProperty (itemLike: NonNullable<InventoryTransferItemLike>): itemLike is { instance?: ItemInstance } {
		return 'instance' in itemLike
	}

	function findCurrentItemLocation (inventory: InventoryModel | undefined, item: ItemInstance) {
		if (!inventory)
			return undefined

		for (const character of Object.values(inventory.characters)) {
			const inventoryItem = character.items.find(candidate => itemInstanceMatches(candidate, item))
			if (inventoryItem)
				return { item: inventoryItem, characterId: character.id, location: 'character-inventory' as const }

			const equippedItem = character.equippedItems.find(candidate => itemInstanceMatches(candidate, item))
			if (equippedItem)
				return { item: equippedItem, characterId: character.id, location: 'character-equipment' as const }
		}

		const profileItem = inventory.profileItems.find(candidate => itemInstanceMatches(candidate, item))
		if (profileItem)
			return { item: profileItem, location: profileItem.bucketHash === InventoryBucketHashes.General ? 'vault' as const : 'profile' as const }

		return undefined
	}

	function operationDedupeKey (operation: Pick<InventoryTransferOperationState, 'action' | 'characterId' | 'item' | 'to'>) {
		return [
			operation.action,
			operation.characterId ?? '',
			operation.to ?? '',
			operation.item.instanceId ?? '',
			operation.item.itemHash,
			operation.item.characterId ?? '',
			operation.item.stackSize ?? '',
			operation.item.bucketHash ?? '',
		].join(':')
	}

	function itemReferenceFromInstance (item: ItemInstance, characterId?: string): ItemTransferReference {
		return {
			instanceId: item.id,
			itemHash: item.itemHash,
			characterId,
			stackSize: item.quantity,
			bucketHash: item.bucketHash,
		}
	}

	function cloneInventory (inventory: InventoryModel): InventoryModel {
		return {
			...inventory,
			characters: Object.fromEntries(Object.entries(inventory.characters).map(([id, character]) => [id, {
				...character,
				items: [...character.items],
				equippedItems: [...character.equippedItems],
			}])),
			profileItems: [...inventory.profileItems],
		}
	}

	function getLocationItems (inventory: InventoryModel, location: InventoryPatchLocation): ItemInstance[] {
		switch (location.container) {
			case 'vault':
				return inventory.profileItems
			case 'characterInventory':
			case 'postmaster':
				return inventory.characters[location.characterId]?.items ?? []
			case 'characterEquipment':
				return inventory.characters[location.characterId]?.equippedItems ?? []
		}
	}

	function findMoveSource (inventory: InventoryModel, reference: InventoryPatchItemReference, destination: readonly ItemInstance[]): ItemInstance[] | undefined {
		for (const character of Object.values(inventory.characters)) {
			for (const items of [character.items, character.equippedItems])
				if (items !== destination && findItemIndex(items, reference) !== -1)
					return items
		}

		return inventory.profileItems !== destination && findItemIndex(inventory.profileItems, reference) !== -1
			? inventory.profileItems
			: undefined
	}

	function itemForMoveDestination (inventory: InventoryModel, patch: Extract<InventoryPatch, { type: 'move' }>, item: ItemInstance): ItemInstance {
		const bucketHash = bucketHashForMoveDestination(inventory, patch, item)
		return bucketHash === item.bucketHash ? item : { ...item, bucketHash }
	}

	function bucketHashForMoveDestination (inventory: InventoryModel, patch: Extract<InventoryPatch, { type: 'move' }>, item: ItemInstance): InventoryBucketHashes {
		switch (patch.to.container) {
			case 'vault':
				return InventoryBucketHashes.General
			case 'characterInventory':
			case 'characterEquipment':
			case 'postmaster':
				return inventory.items[item.itemHash]?.bucketHash ?? item.bucketHash
		}
	}

	function applyEquipmentDisplacement (inventory: InventoryModel, patch: Extract<InventoryPatch, { type: 'move' }>, item: ItemInstance) {
		if (patch.from.container !== 'characterInventory' || patch.to.container !== 'characterEquipment' || patch.from.characterId !== patch.to.characterId)
			return

		const character = inventory.characters[patch.to.characterId]
		if (!character)
			return

		for (let i = character.equippedItems.length - 1; i >= 0; i--) {
			const equippedItem = character.equippedItems[i]
			if (equippedItem.bucketHash !== item.bucketHash || itemInstanceMatches(equippedItem, item))
				continue

			character.equippedItems.splice(i, 1)
			if (!character.items.some(candidate => itemInstanceMatches(candidate, equippedItem)))
				character.items.push(equippedItem)
		}
	}

	function findItemIndex (items: readonly ItemInstance[], reference: InventoryPatchItemReference) {
		const index = items.findIndex(item => itemMatchesReference(item, reference))
		if (index !== -1)
			return index

		return -1
	}

	function itemMatchesReference (item: ItemInstance, reference: InventoryPatchItemReference) {
		if (reference.instanceId)
			return item.id === reference.instanceId

		return item.id === undefined
			&& item.itemHash === reference.itemHash
			&& item.quantity === reference.stackSize
	}

	function itemInstanceMatches (candidate: ItemInstance, item: ItemInstance) {
		return item.id
			? candidate.id === item.id
			: candidate.id === undefined && candidate.itemHash === item.itemHash && candidate.quantity === item.quantity
	}

}

export default Inventory
