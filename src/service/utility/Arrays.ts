import Define from 'utility/Define'

declare global {
	interface Array<T> {
		collect<ARGS extends any[], R> (collector: (array: this, ...args: ARGS) => R, ...args: ARGS): R
	}
}

namespace Arrays {

	export function applyPrototypes () {
		Define.set(Array.prototype, 'collect', function (this: any[], collector, ...args) {
			return collector(this, ...args)
		})
	}

}

export default Arrays
