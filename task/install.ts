import ansi from 'ansicolor'
import fs from 'fs'
import { Log, Task } from 'task'

interface Package {
	path: string
	dependencies: Record<string, PackageDependency>
}

interface PackageDependency {
	path: string
	branch?: string
}

const packages: Package[] = [
	{
		path: '.',
		dependencies: {
			task: { path: 'chirivulpes/task', branch: 'package' },
			lint: { path: 'fluff4me/lint' },
			chiri: { path: 'fluff4me/chiri', branch: 'package' },
			weaving: { path: 'chirivulpes/weaving', branch: 'package' },
		},
	},
	{
		path: 'src/platform',
		dependencies: {
			kitsui: { path: 'fluff4me/kitsui', branch: 'package' },
		},
	},
]

export default Task('install', async task => {
	const root = process.cwd()

	for (const pakige of packages) {
		process.chdir(root)
		process.chdir(pakige.path)

		const packageJsonString = await fs.promises.readFile('./package.json', 'utf8')

		const toUpdate = Object.entries(pakige.dependencies)

		const packageListString = toUpdate.map(([name]) => ansi.lightCyan(name)).join(', ')
		Log.info(`Fetching latest versions of ${packageListString}...`)
		const toInstall: [name: string, path: string, sha: string][] = await Promise.all(toUpdate.map(async ([name, { path, branch }]) => {
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
	}

	process.chdir(root)
	process.chdir('src/service')
	await task.exec('NPM:PATH:npm', 'install', '--no-audit', '--no-fund')
	process.chdir('../client')
	await task.exec('NPM:PATH:npm', 'install', '--no-audit', '--no-fund')
	process.chdir('../platform')
	await task.exec('NPM:PATH:npm', 'install', '--no-audit', '--no-fund')
})
