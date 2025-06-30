import { Task } from 'task'

const params = ['index.quilt', '--out', '../../../../out/service/lang', '--outTypes', '..', '--outWhitespace']
export default Task('weave', async task => {
	await task.exec(
		{
			cwd: 'src/platform/lang/en-nz',
		},
		'NPM:weaving', ...params)
})

export const weavewatch = Task('weavewatch', task =>
	task.exec(
		{
			env: {
			},
			cwd: 'src/platform/lang/en-nz',
		},
		'NPM:weaving', ...params, '--watch')
)
