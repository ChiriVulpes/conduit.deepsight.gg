import fs from 'fs/promises'
import { Task, TypeScript } from 'task'
import Env from './utility/Env'

const options = Env.ENVIRONMENT === 'dev'
	? ['--inlineSourceMap', '--inlineSources', '--incremental']
	: ['--pretty']

export default Task('ts', task => task.parallel(
	task.series(
		() => TypeScript.compile(task, 'src/service', '--pretty', ...options),
		() => fs.unlink('docs/service/index.tsbuildinfo'),
	),
	task.series(
		() => TypeScript.compile(task, 'src/client', '--pretty', ...options),
		() => fs.unlink('docs/client/index.tsbuildinfo'),
	),
))

export const tsWatch = Task('ts (watch)', task => task.parallel(
	() => TypeScript.compile(task, 'src/service', '--watch', '--preserveWatchOutput', '--pretty', ...options),
	() => TypeScript.compile(task, 'src/client', '--watch', '--preserveWatchOutput', '--pretty', ...options),
))
