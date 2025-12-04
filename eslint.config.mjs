import lint from 'lint'
/** @import {TSESLint} from "@typescript-eslint/utils" */

export { lint }

/** @type {(root: string) => TSESLint.Linter.ConfigType[]} */
export default [
	...lint(import.meta.dirname),
	{
		ignores: ['out/**'],
	},
]
