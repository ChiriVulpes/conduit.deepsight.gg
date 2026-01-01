import type { ItemTransferAction, ItemTransferReference } from '@shared/ConduitMessageRegistry'
import type { Profile } from '@shared/Profile'
import type { DestinyItemTransferRequest, DestinyPostmasterTransferRequest } from 'bungie-api-ts/destiny2'
import Auth from 'model/Auth'
import Definitions from 'model/Definitions'
import type { ProfileOverrideWhere } from 'model/DestinyProfiles'
import Profiles from 'model/Profiles'
import Broadcast from 'utility/Broadcast'
import Bungie from 'utility/Bungie'
import Store from 'utility/Store'

function or (...conditions: ProfileOverrideWhere[]) {
	return { or: conditions }
}

function and (...conditions: ProfileOverrideWhere[]) {
	return { and: conditions }
}

export async function transferItem (profile: Profile, body: DestinyItemTransferRequest) {
	await Bungie.postForUser('/Destiny2/Actions/Items/TransferItem/', body as never)
	const profileOverrides = await Store.destinyProfileOverrides.get() ?? {}
	const overrides = profileOverrides[profile.id] ??= []
	const itemMatcher = or(
		{ path: ['itemInstanceId'], value: body.itemId },
		and(
			{ path: ['itemInstanceId'], value: undefined },
			{ path: ['itemHash'], value: body.itemReferenceHash },
			{ path: ['quantity'], value: body.stackSize },
		)
	)
	if (body.transferToVault) {
		overrides.push({
			type: 'move-where',
			fromArrayPath: ['characterInventories', 'data', body.characterId, 'items'],
			toArrayPath: ['profileInventory', 'data', 'items'],
			where: [itemMatcher],
			time: Date.now(),
		})
	}
	else {
		overrides.push({
			type: 'move-where',
			fromArrayPath: ['profileInventory', 'data', 'items'],
			toArrayPath: ['characterInventories', 'data', body.characterId, 'items'],
			where: [itemMatcher],
			time: Date.now(),
		})
	}
	await Store.destinyProfileOverrides.set(profileOverrides)
}

export async function pullFromPostmaster (profile: Profile, body: DestinyPostmasterTransferRequest) {
	const itemDef = await Definitions.en.DestinyInventoryItemDefinition.get().then(DestinyInventoryItemDefinition => DestinyInventoryItemDefinition[body.itemReferenceHash])
	if (!itemDef.inventory?.bucketTypeHash) {
		Broadcast.warning('user', 'Unable to pull item from postmaster: Unknown item')
		return
	}

	await Bungie.postForUser('/Destiny2/Actions/Items/PullFromPostmaster/', body as never)
	const profileOverrides = await Store.destinyProfileOverrides.get() ?? {}
	const overrides = profileOverrides[profile.id] ??= []
	const itemMatcher = or(
		{ path: ['itemInstanceId'], value: body.itemId },
		and(
			{ path: ['itemInstanceId'], value: undefined },
			{ path: ['itemHash'], value: body.itemReferenceHash },
			{ path: ['quantity'], value: body.stackSize },
		)
	)
	overrides.push({
		type: 'set-where',
		arrayPath: ['characterInventories', 'data', body.characterId, 'items'],
		where: [itemMatcher],
		modifyPath: ['bucketHash'],
		value: itemDef.inventory.bucketTypeHash,
		time: Date.now(),
	})
	await Store.destinyProfileOverrides.set(profileOverrides)
}

namespace ItemTransfer {

	export async function vaultItem (item: ItemTransferReference): Promise<ItemTransferAction[]> {
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

		if (item.isLostItem)
			await pullFromPostmaster(profile, {
				membershipType: profile.type,
				itemId: instanceId,
				itemReferenceHash: item.itemHash,
				stackSize: item.stackSize ?? 1,
				characterId: item.characterId,
			})

		await transferItem(profile, {
			membershipType: profile.type,
			itemId: instanceId,
			itemReferenceHash: item.itemHash,
			stackSize: item.stackSize ?? 1,
			characterId: item.characterId,
			transferToVault: true,
		})

		return [
			{ item, to: 'vault' },
		]
	}

	export async function moveItemToCharacter (characterId: string, item: ItemTransferReference): Promise<ItemTransferAction[]> {
		const auth = await Auth.getValid()
		const profile = await Profiles.getCurrentProfile(auth)
		if (!profile) {
			Broadcast.warning('user', 'Unable to transfer item: Not authenticated')
			return []
		}

		const instanceId = item.instanceId ?? '0'

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
			})
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
			})
		}

		if (needsVaultTransfer)
			await transferItem(profile, {
				membershipType: profile.type,
				itemId: instanceId,
				itemReferenceHash: item.itemHash,
				stackSize: item.stackSize ?? 1,
				characterId: characterId,
				transferToVault: false,
			})

		return [
			{ item, to: 'character', newCharacterId: characterId },
		]
	}

}

export default ItemTransfer
