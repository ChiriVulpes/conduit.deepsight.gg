import { Task } from 'task'

const projects = [
	'src/shared/tsconfig.json',
	'src/frame/tsconfig.json',
	'src/client/tsconfig.json',
	'src/service/tsconfig.json',
	'src/platform/src/tsconfig.json',
]

export default Task('typecheck', async task => {
	for (const project of projects)
		await task.exec('NPM:tsc', '-p', project, '--noEmit', '--tsBuildInfoFile', '\\\\.\\NUL')
})
