interface DiffWrite {
	type: 'write'
	path: string[]
	value: unknown
}

interface DiffDelete {
	type: 'delete'
	path: string[]
}

interface DiffInsert {
	type: 'insert'
	path: string[]
	position: number
	values: unknown[]
}

interface DiffSplice {
	type: 'splice'
	path: string[]
	position: number
	count: number
}

type Diff = DiffWrite | DiffDelete | DiffInsert | DiffSplice

type Literal = string | number | boolean | bigint | null | undefined

type Diffable = Literal | Literal[] | DiffableArray<Diffable> | { [key: string]: Diffable }

export type ValidateDiffable<T> =
	T extends Literal ? T
	: T extends Literal[] ? T
	: T extends Array<infer I> ? DiffableArray<ValidateDiffable<I>>
	: T extends object ? { [K in keyof T]: ValidateDiffable<T[K]> }
	: never

const SYMBOL_DIFFABLE_INSTANCE_EQUALS = Symbol('DIFFABLE_INSTANCE_EQUALS')
export interface DiffableArray<T> extends Array<T> {
	/** 
	 * Check if two values within the array are the same "instance"
	 * The data within an instance may be different, but the instance itself is the same
	 */
	[SYMBOL_DIFFABLE_INSTANCE_EQUALS] (a: T, b: T): boolean
}

export namespace DiffableArray {

	export type ApplyRecursively<T> =
		T extends Literal ? T
		: T extends Literal[] ? T
		: T extends Array<infer I> ? DiffableArray<ApplyRecursively<I>>
		: T extends object ? { [K in keyof T]: ApplyRecursively<T[K]> }
		: never

	export function is (value: unknown): value is DiffableArray<unknown> {
		return Array.isArray(value) && SYMBOL_DIFFABLE_INSTANCE_EQUALS in value && typeof value[SYMBOL_DIFFABLE_INSTANCE_EQUALS] === 'function'
	}

	export function make<T> (array: T[], instanceEquals: (a: T, b: T) => boolean): DiffableArray<ValidateDiffable<T>>
	export function make<T> (array: T[] | undefined, instanceEquals: (a: T, b: T) => boolean): DiffableArray<ValidateDiffable<T>> | undefined
	export function make<T> (array: T[] | undefined, instanceEquals: (a: T, b: T) => boolean): DiffableArray<ValidateDiffable<T>> | undefined {
		const result = array as DiffableArray<T> | undefined
		if (result)
			result[SYMBOL_DIFFABLE_INSTANCE_EQUALS] = instanceEquals
		return result as DiffableArray<ValidateDiffable<T>> | undefined
	}

	export function makeDeep<T> (
		array: T[],
		instanceEquals: (a: T, b: T) => boolean,
		itemApplicator: (value: T) => unknown,
	): DiffableArray<ApplyRecursively<T>> {
		const result = array as DiffableArray<T>
		result[SYMBOL_DIFFABLE_INSTANCE_EQUALS] = instanceEquals
		for (const item of result)
			itemApplicator(item)
		return result as DiffableArray<ApplyRecursively<T>>
	}
}

namespace Diff {
	export function get<T> (from: T, to: T & ValidateDiffable<T>): Diff[] {
		const diffs: Diff[] = []
		const path: string[] = []
		let pathSlice: string[] | undefined
		calcDiffs(from as Diffable, to)
		return diffs

		function calcDiffs (from: Diffable, to: Diffable) {
			if (from === to)
				return

			if (typeof2(from) !== typeof2(to)) {
				diffs.push({
					type: 'write',
					path: pathSlice ??= path.slice(),
					value: to,
				})
				return
			}

			switch (typeof2(from)) {
				case 'array:diffable': {
					const fromDiffable = from as DiffableArray<Diffable>
					const toDiffable = to as DiffableArray<Diffable>
					calcArrayDiffs(fromDiffable, toDiffable, (a, b, oldIndex) => {
						const same = fromDiffable[SYMBOL_DIFFABLE_INSTANCE_EQUALS](a, b)
						if (same) {
							path.push(`${oldIndex}`)
							pathSlice = undefined
							calcDiffs(a, b)
							path.pop()
							pathSlice = undefined
						}
						return same
					})
					return
				}

				case 'array':
					calcArrayDiffs(from as Literal[], to as Literal[])
					return

				case 'object':
					calcObjectDiffs(from as { [key: string]: Diffable }, to as { [key: string]: Diffable })
					return
			}

			diffs.push({
				type: 'write',
				path: pathSlice ??= path.slice(),
				value: to,
			})
		}

		function calcArrayDiffs<T> (from: T[], to: T[], equals?: (a: T, b: T, oldIndex: number, newIndex: number) => boolean) {
			const operations = myersDiff(from, to, equals) as (DiffInsert | DiffSplice)[]
			const arrayPath = pathSlice ??= path.slice()
			for (const operation of operations)
				operation.path = arrayPath
			diffs.push(...operations)
		}

		function calcObjectDiffs (from: { [key: string]: Diffable }, to: { [key: string]: Diffable }) {
			for (const key in from) {
				if (!(key in to)) {
					diffs.push({
						type: 'delete',
						path: [...path, key],
					})
				}
				else {
					path.push(key)
					pathSlice = undefined
					calcDiffs(from[key], to[key])
					path.pop()
					pathSlice = undefined
				}
			}

			for (const key in to) {
				if (!(key in from)) {
					diffs.push({
						type: 'write',
						path: [...path, key],
						value: to[key],
					})
				}
			}
		}
	}

	function typeof2 (value: Diffable) {
		if (value === null) return 'null'
		if (DiffableArray.is(value)) return 'array:diffable'
		if (Array.isArray(value)) return 'array'
		const result = typeof value
		return result as Exclude<typeof result, 'function' | 'symbol'>
	}

	function myersDiff<T> (oldArray: T[], newArray: T[], isEqual?: (a: T, b: T, oldIndex: number, newIndex: number) => boolean): (Omit<DiffInsert, 'path'> | Omit<DiffSplice, 'path'>)[] {
		const oldLength = oldArray.length
		const newLength = newArray.length
		const maxLength = oldLength + newLength
		const v = new Array<number>(2 * maxLength + 1)
		const trace: number[][] = []

		v.fill(0)

		for (let d = 0; d <= maxLength; d++) {
			const vCopy = [...v]
			trace.push(vCopy)

			for (let k = -d; k <= d; k += 2) {
				let x
				if (k === -d || (k !== d && v[maxLength + k - 1] < v[maxLength + k + 1]))
					x = v[maxLength + k + 1]
				else
					x = v[maxLength + k - 1] + 1

				let y = x - k

				while (x < oldLength && y < newLength && (!isEqual ? oldArray[x] === newArray[y] : isEqual(oldArray[x], newArray[y], x, y))) {
					x++
					y++
				}

				v[maxLength + k] = x

				if (x >= oldLength && y >= newLength) {
					const script: (Omit<DiffInsert, 'path'> | Omit<DiffSplice, 'path'>)[] = []
					let currentX = oldLength
					let currentY = newLength

					for (let traceD = d; traceD > 0; traceD--) {
						const prevV = trace[traceD]
						const currentK = currentX - currentY

						const forward = false
							|| currentK === -traceD
							|| (currentK !== traceD && prevV[maxLength + currentK - 1] < prevV[maxLength + currentK + 1])

						const prevK = forward ? currentK + 1 : currentK - 1

						const prevX = prevV[maxLength + prevK]
						const prevY = prevX - prevK

						while (currentX > prevX && currentY > prevY) {
							currentX--
							currentY--
						}

						if (traceD > 0) {
							const lastOperation = script.at(-1)
							if (prevX === currentX) {
								const insertIndex = prevX
								if (lastOperation?.type === 'insert' && lastOperation.position === insertIndex)
									lastOperation.values.unshift(newArray[currentY - 1])

								else
									script.push({
										type: 'insert',
										position: insertIndex,
										values: [newArray[currentY - 1]],
									})
							}
							else {
								const deleteIndex = currentX - 1
								if (lastOperation?.type === 'splice' && lastOperation.position === deleteIndex + 1)
									lastOperation.count++, lastOperation.position = deleteIndex

								else
									script.push({
										type: 'splice',
										position: deleteIndex,
										count: 1,
									})
							}
						}
						currentX = prevX
						currentY = prevY
					}

					return script
				}
			}
		}

		return []
	}
}

export default Diff
