import fs from 'fs/promises'
import { Task, TypeScript } from 'task'
import Env from './utility/Env'

const options = Env.ENVIRONMENT === 'dev'
	? ['--inlineSourceMap', '--inlineSources', '--incremental']
	: ['--pretty']

const ts = Task('ts', task => task.series(
	Task('ts:shared', () => TypeScript.compile(task, 'src/shared', '--pretty', ...options)),
	Task('ts:service', () => TypeScript.compile(task, 'src/service', '--pretty', ...options)),
	Task('ts:client', () => TypeScript.compile(task, 'src/client', '--pretty', ...options)),
	Task('ts:platform', () => TypeScript.compile(task, 'src/platform/src', '--pretty', ...options)),
	copyClientToPlatform,
))

export default ts

export const tsWatch = Task('ts (watch)', task => task.series(
	ts,
	task.parallel(
		() => TypeScript.compile(task, 'src/shared', '--watch', '--preserveWatchOutput', '--pretty', ...options),
		() => TypeScript.compile(task, 'src/service', '--watch', '--preserveWatchOutput', '--pretty', ...options),
		() => TypeScript.compile(task, 'src/client', '--watch', '--preserveWatchOutput', '--pretty', ...options),
		() => TypeScript.compile(task, 'src/platform/src', '--watch', '--preserveWatchOutput', '--pretty', ...options),
		() => task.watch('out/client/index.js', copyClientToPlatform),
	),
))

function copyClientToPlatform () {
	return fs.copyFile('out/client/index.js', 'out/service/client.js').catch(() => { })
}
