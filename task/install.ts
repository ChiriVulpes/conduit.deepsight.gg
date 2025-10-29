import fs from 'fs/promises'
import { Task } from 'task'

export default Task('install', async task => {
	await task.install(
		{
			path: '.',
			dependencies: {
				task: { repo: 'chirivulpes/task', branch: 'package' },
				lint: { repo: 'fluff4me/lint' },
				chiri: { repo: 'fluff4me/chiri', branch: 'package' },
				weaving: { repo: 'chirivulpes/weaving', branch: 'package' },
			},
		},
		{
			path: 'src/platform',
			dependencies: {
				kitsui: { repo: 'fluff4me/kitsui', branch: 'package' },
			},
		},
		{
			path: 'src/client',
			dependencies: {
				'deepsight.gg': { name: 'deepsight.gg' },
				'bungie-api-ts': { name: 'bungie-api-ts' },
			},
		},
		{
			path: 'src/service',
			dependencies: {
				'deepsight.gg': { name: 'deepsight.gg' },
				'bungie-api-ts': { name: 'bungie-api-ts' },
			},
		},
		{
			path: 'src/shared',
			dependencies: {
				'deepsight.gg': { name: 'deepsight.gg' },
				'bungie-api-ts': { name: 'bungie-api-ts' },
			},
		},
	)

	await fs.rename('src/service/node_modules/jsonpath-plus/dist/index-browser-umd.min.cjs', 'src/service/node_modules/jsonpath-plus/dist/index-browser-umd.min.js').catch(() => { })
})
