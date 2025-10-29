import type { DefinitionsFilter } from '@shared/DefinitionComponents'
import jsonpath from 'jsonpath-plus'

namespace FilterHelper {
	export function* filter (defs: Record<string, unknown>, search: DefinitionsFilter): Iterable<[string, object]> {
		if (!search.nameContainsOrHashIs && !search.deepContains && !search.jsonPathExpression && !search.evalExpression)
			throw new Error('At least one filter criterion must be specified')

		const nameRegex = !search.nameContainsOrHashIs ? undefined
			: new RegExp(`\\b${search.nameContainsOrHashIs.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')

		interface TypicalDef {
			hash?: number | string
			displayProperties?: {
				name?: string
			}
		}

		const predicate = search.evalExpression && eval(search.evalExpression) as ((def: any) => boolean) | undefined
		if (predicate && typeof predicate !== 'function')
			throw new Error('evalExpression did not evaluate to a predicate function')

		for (const key in defs) {
			const def = defs[key] as TypicalDef
			if (typeof def !== 'object' || def === null)
				continue

			let hashMatch = false
			if (search.nameContainsOrHashIs) {
				let nameMatch = false

				const name = def.displayProperties?.name
				if (`${def.hash}` === search.nameContainsOrHashIs)
					hashMatch = true

				else if (name && nameRegex?.test(name))
					nameMatch = true

				if (!nameMatch && !hashMatch)
					continue
			}

			if (search.deepContains)
				if (!deepContains(def, search.deepContains))
					continue

			if (search.jsonPathExpression && !jsonpath.JSONPath<any[]>({ path: search.jsonPathExpression, json: def, resultType: 'value', wrap: true }).length)
				continue

			if (predicate && !predicate(def))
				continue

			yield [key, def]
			if (hashMatch)
				// there's only ever one def with a given hash
				return
		}
	}

	function deepContains (value: unknown, search: string): boolean {
		if (typeof value === 'string')
			return value.includes(search)

		if (typeof value === 'number')
			return `${value}` === search

		if (typeof value !== 'object' || value === null)
			return false

		if (Array.isArray(value))
			return value.some(item => deepContains(item, search))

		const obj = value as Record<string, unknown>
		for (const key in obj)
			if (deepContains(obj[key], search))
				return true

		return false
	}
}

export default FilterHelper
