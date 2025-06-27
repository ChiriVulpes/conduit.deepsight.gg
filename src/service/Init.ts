import Env from './utility/Env'

export default async function () {
	await Env['init']()

	// eslint-disable-next-line @typescript-eslint/no-require-imports
	require('../Conduit')
}
