import Define from 'utility/Define'

export function NonNullish<T> (value: T | null | undefined): value is T {
	return value !== null && value !== undefined
}

export function Truthy<T> (value: T | null | undefined | false | 0 | ''): value is T {
	return !!value
}

declare global {
	interface Array<T> {
		collect<ARGS extends any[], R> (collector: (array: this, ...args: ARGS) => R, ...args: ARGS): R

		groupBy<K> (keyGetter: (item: T, index: number, array: this) => K): Map<K, T[]>
		groupBy<K, R> (keyGetter: (item: T, index: number, array: this) => K, resultMapper: (array: this) => R): Map<K, R>

		toObject<K extends PropertyKey, V> (this: [K, V][]): Record<K, V>
		toObject<K extends PropertyKey, V> (mapper: (item: T, index: number, array: this) => [K, V]): Record<K, V>

		distinct (): this
		distinct (mapper: (value: T) => any): this
	}
}

namespace Arrays {

	export function applyPrototypes () {
		Define.set(Array.prototype, 'collect', function (this: any[], collector, ...args) {
			return collector(this, ...args)
		})

		Define.set(Array.prototype, 'groupBy', function <T, K, R = T[]> (this: T[], keyGetter: (item: T, index: number, array: T[]) => K, resultMapper?: (array: T[]) => R): Map<K, R> {
			const map = new Map<K, T[] | R>()
			for (let i = 0; i < this.length; i++) {
				const item = this[i]
				const key = keyGetter(item, i, this)
				let group = map.get(key) as T[] | undefined
				if (!group) {
					group = []
					map.set(key, group)
				}
				group.push(item)
			}

			if (resultMapper)
				for (const [key, group] of map)
					map.set(key, resultMapper(group as T[]))

			return map as Map<K, R>
		})

		Define.set(Array.prototype, 'toObject', function <K extends PropertyKey, V> (this: [K, V][], mapper?: (item: [K, V], index: number, array: [K, V][]) => [K, V]): Record<K, V> {
			const obj = {} as Record<K, V>

			if (mapper)
				for (let i = 0; i < this.length; i++) {
					const item = this[i]
					const [key, value] = mapper(item, i, this)
					obj[key] = value
				}
			else
				for (const [key, value] of this)
					obj[key] = value

			return obj
		})

		Define(Array.prototype, 'distinct', function <T> (this: T[], mapper?: (value: T) => any) {
			const result: T[] = []
			const encountered = mapper ? [] : result

			for (const value of this) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				const encounterValue = mapper ? mapper(value) : value
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				if (encountered.includes(encounterValue))
					continue

				if (mapper)
					// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
					encountered.push(encounterValue)

				result.push(value)
			}

			return result
		})
	}

}

export default Arrays
