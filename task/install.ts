import ansi from 'ansicolor'
import fs from 'fs'
import { Log, Task } from 'task'

export default Task('install', async task => {
	const packageJsonString = await fs.promises.readFile('./package.json', 'utf8')

	const toUpdate: [name: string, path: string, branch?: string][] = [
		['task', 'chirivulpes/task', 'package'],
		['lint', 'fluff4me/lint'],
	]

	const packageListString = toUpdate.map(([name]) => ansi.lightCyan(name)).join(', ')
	Log.info(`Fetching latest versions of ${packageListString}...`)
	const toInstall: [name: string, path: string, sha: string][] = await Promise.all(toUpdate.map(async ([name, path, branch]) => {
		let response = ''
		const branchArg = branch ? `refs/heads/${branch}` : 'HEAD'
		await task.exec({ stdout: data => response += data.toString() }, 'PATH:git', 'ls-remote', `https://github.com/${path}.git`, branchArg)
		const sha = response.trim().split(/\s+/)[0]
		if (!sha)
			throw new Error(`Failed to get SHA of latest commit of ${name} repository`)

		return [name, path, sha]
	}))

	Log.info(`Uninstalling ${packageListString}...`)
	await task.exec('NPM:PATH:npm', 'uninstall', ...toUpdate.map(([name]) => name), '--save', '--no-audit', '--no-fund')

	Log.info(`Installing ${toInstall.map(([name, , sha]) => ansi.lightCyan(`${name}#${sha.slice(0, 7)}`)).join(', ')}...`)
	await task.exec('NPM:PATH:npm', 'install',
		...toInstall.map(([name, path, sha]) => `github:${path}#${sha}`),
		'--save-dev', '--no-audit', '--no-fund'
	)

	await fs.promises.writeFile('./package.json', packageJsonString, 'utf8')
})
