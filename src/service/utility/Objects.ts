export function mutable<T> (obj: T): { -readonly [P in keyof T]: T[P] } {
	return obj
}

namespace Objects {
	export function type<T> () {
		return {
			stripUndefined<O extends T> (obj: O): (
				(
					{ [P in keyof O as Exclude<O[P], undefined> extends never ? never : P]: O[P] }
				) extends infer O ? (
					T extends O ? O : {
						error: 'Stripping undefineds does not produce T'
						T: T
						checkProperties: Exclude<keyof O, keyof T>
					}
				) : never
			) {
				for (const key in obj) {
					if (obj[key] === undefined) {
						delete obj[key]
					}
				}
				return obj as never
			},
		}
	}
}

export default Objects
