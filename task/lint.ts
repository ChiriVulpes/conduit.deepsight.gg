import { Task } from 'task'

const globs = ['*.ts', '*.tsx', '*.js', '*.mjs', '*.cjs', '*.mts', '*.cts']

export default Task('lint', async task => {
	const files = (await task.readExec('PATH:git', 'ls-files', ...globs))
		.split(/\r?\n/)
		.map(file => file.trim())
		.filter(Boolean)

	if (!files.length)
		return

	await task.exec('NPM:eslint', '--', ...files)
})
