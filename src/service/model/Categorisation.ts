import type { ItemPlug, ItemSocketDefinition } from '@shared/item/Item'
import type { DeepsightPlugCategorisation, DeepsightPlugCategory, DeepsightPlugCategoryName, DeepsightPlugFullName } from 'deepsight.gg/DeepsightPlugCategorisation'

type PlugCategorisationExpression =
	| DeepsightPlugFullName
	| `${DeepsightPlugCategoryName}/*`
	| '*Enhanced'
	| `${DeepsightPlugCategoryName}/*Enhanced`
	| '*Empty'
	| `${DeepsightPlugCategoryName}/*Empty`
	| '*Default'
	| `${DeepsightPlugCategoryName}/*Default`

namespace Categorisation {

	export const IsMasterwork = matcher('Masterwork/*')
	export const IsIntrinsic = matcher('Intrinsic/*')
	export const IsEnhanced = matcher('*Enhanced')
	export const IsEmpty = matcher('*Empty')
	export const IsDefault = matcher('*Default')
	export const IsShaderOrnament = matcher('Cosmetic/Shader', 'Cosmetic/Ornament')

	export function matcher (...expressions: (PlugCategorisationExpression | `!${PlugCategorisationExpression}`)[]) {
		const positiveExpressions = expressions.filter(expr => expr[0] !== '!') as PlugCategorisationExpression[]
		const negativeExpressions = expressions.filter(expr => expr[0] === '!').map(expr => expr.slice(1) as PlugCategorisationExpression)

		return matcher

		function matcher (categorised?: ItemPlug | ItemSocketDefinition | DeepsightPlugCategorisation | DeepsightPlugFullName): boolean
		function matcher<CATEGORY extends DeepsightPlugCategoryName> (categorised?: DeepsightPlugCategorisation): categorised is DeepsightPlugCategorisation & DeepsightPlugCategorisation<typeof DeepsightPlugCategory[CATEGORY]>
		function matcher (categorised?: ItemPlug | ItemSocketDefinition | DeepsightPlugCategorisation | DeepsightPlugFullName): boolean {
			const categorisation = typeof categorised === 'string' ? categorised
				: !categorised ? undefined
					: 'fullName' in categorised ? categorised.fullName
						: categorised?.type
			if (!categorisation)
				return false

			if (positiveExpressions.length && !matchesExpressions(categorisation, positiveExpressions))
				return false

			if (negativeExpressions.length && matchesExpressions(categorisation, negativeExpressions))
				return false

			return true
		}

		function matchesExpressions (categorisation: DeepsightPlugFullName, expressions: PlugCategorisationExpression[]): boolean {
			for (const expression of expressions) {
				if (expression === categorisation)
					return true

				if (expression.startsWith('*'))
					if (categorisation.endsWith(expression.slice(1)))
						return true
					else
						continue

				if (expression.endsWith('*'))
					if (categorisation.startsWith(expression.slice(0, -1)))
						return true
					else
						continue

				if (expression.includes('*')) {
					const [start, end] = expression.split('*')
					if (categorisation.startsWith(start) && categorisation.endsWith(end))
						return true
					else
						continue
				}
			}

			return false
		}
	}
}

export default Categorisation
