import Arrays from 'utility/Arrays'
import Env from './utility/Env'

declare const require: (path: string) => unknown

declare global {
	const _: undefined
}

export default async function () {
	Arrays.applyPrototypes()

	await Env['init']()

	Object.assign(self, { _: undefined })

	// eslint-disable-next-line @typescript-eslint/no-require-imports
	require('../Conduit')
}
