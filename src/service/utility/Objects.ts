export function mutable<T> (obj: T): { -readonly [P in keyof T]: T[P] } {
	return obj
}
