import fs from 'fs/promises'
import { Task } from 'task'

export default Task('install', async task => {
	await task.install(
		{
			path: '.',
			dependencies: {
				'task': { repo: 'chirivulpes/task', branch: 'package' },
				'lint': { repo: 'fluff4me/lint' },
				'chiri': { repo: 'fluff4me/chiri', branch: 'package' },
				'weaving': { repo: 'chirivulpes/weaving', branch: 'package' },
				'kitsui': { repo: 'fluff4me/kitsui', branch: 'package' },
				'deepsight.gg': { name: 'deepsight.gg' },
				'bungie-api-ts': { name: 'bungie-api-ts' },
			},
		},
	)

	await fs.rename('node_modules/jsonpath-plus/dist/index-browser-umd.min.cjs', 'node_modules/jsonpath-plus/dist/index-browser-umd.min.js').catch(() => { })
})
