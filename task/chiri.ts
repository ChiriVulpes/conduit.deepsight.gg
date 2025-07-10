import { Task } from 'task'
import Env from './utility/Env'

const params = ['index.chiri', '--out', '../../../out/service/style', '--out-dts', '../src/style']
export default Task('chiri', task =>
	task.exec({
		...Env.ENVIRONMENT === 'dev' ? { env: {} } : {},
		cwd: 'src/platform/style',
	}, 'NPM:chiri', ...params)
)

export const chiriwatch = Task('chiriwatch', task =>
	task.exec(
		{
			env: {
				// CHIRI_ENV: Env.CHIRI_ENV,
				// CHIRI_STACK_LENGTH: Env.CHIRI_STACK_LENGTH,
				// CHIRI_AST: Env.CHIRI_AST,
				// CHIRI_INSPECT: Env.CHIRI_INSPECT,
				// CHIRI_INSPECT_PORT: Env.CHIRI_INSPECT_PORT,
			},
			cwd: 'src/platform/style',
		},
		'NPM:chiri', ...params, '-w')
)
