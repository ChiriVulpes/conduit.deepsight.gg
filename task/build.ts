import fs from 'fs/promises'
import { Task } from 'task'
import chiri from './chiri'
import clean from './clean'
import _package from './package'
import _static from './static'
import ts from './ts'
import vendor from './vendor'
import weaving from './weaving'

export default Task('build', task => task.series(
	clean,
	task.parallel(
		_static,
		task.series(
			task.parallel(
				chiri,
				weaving,
				vendor,
			),
			ts,
			_package,
			async function cleanupPlatform () {
				await fs.unlink('out/service/FrameFunctions.js')
				for await (const file of fs.glob('out/service/*.tsbuildinfo')) {
					await fs.unlink(file)
				}
			},
		)
	)
)) 
