import type { ConduitOperation, ConduitOperationType, ConduitWarningMessage, ConduitWarningMessageType, RelatedItem } from '@shared/ConduitMessageRegistry'

interface ConduitOperationInstance extends ConduitOperation {
	broadcastComplete: Promise<void>
}

namespace Broadcast {
	export function startOperation (type: ConduitOperationType, related?: RelatedItem[]): ConduitOperationInstance {
		const operation: ConduitOperation & Partial<ConduitOperationInstance> = {
			id: crypto.randomUUID(),
			type,
			related,
		}
		const broadcastComplete = service.broadcast.startOperation(operation)
		return { ...operation, broadcastComplete }
	}

	export function endOperation (operation: ConduitOperation | string): void {
		void service.broadcast.endOperation(typeof operation === 'string' ? operation : operation.id)
	}

	export async function operation<T> (type: ConduitOperationType, block: () => Promise<T>): Promise<T>
	export async function operation<T> (type: ConduitOperationType, related: RelatedItem[], block: () => Promise<T>): Promise<T>
	export async function operation<T> (type: ConduitOperationType, related?: RelatedItem[] | (() => Promise<T>), block?: () => Promise<T>): Promise<T> {
		if (typeof related === 'function')
			block = related, related = undefined

		const operation = startOperation(type, related)
		const [, result] = await Promise.all([
			operation.broadcastComplete,
			block!(),
		])
		void service.broadcast.endOperation(operation.id)
		return result
	}

	export function warning (category: ConduitWarningMessage['category'], type: ConduitWarningMessageType, related?: RelatedItem[]): void {
		void service.broadcast.warning({ type, category, related })
	}
}

export default Broadcast
