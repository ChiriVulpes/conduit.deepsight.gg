import { Task } from 'task'

export default Task('install', async task => task.install(
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
	{ path: 'src/client' },
	{ path: 'src/service' },
	{ path: 'src/shared' },
))
