import { Task } from 'task'
import chiri, { chiriwatch } from './chiri'
import clean from './clean'
import _package from './package'
import serve from './serve'
import _static from './static'
import ts, { tsWatch } from './ts'
import vendor from './vendor'
import weaving, { weavewatch } from './weaving'

export default Task('watch', async task => {
	await task.run(clean)
	await task.run(task.parallel(
		vendor,
		_static,
		chiri,
		weaving,
		task.series(
			ts,
			_package,
		),
	))

	task.watch([
		'src/platform/*.html',
		'.env',
		'src/platform/node_modules/**/*.js',
		'src/platform/static/**/*',
	], _static)

	task.watch([
		'out/shared/**/*.d.ts',
		'out/client/index.d.ts',
		'out/client/index.js',
		'src/client/package.json',
	], _package)

	await Promise.all([
		task.run(tsWatch),
		task.run(serve),
		task.run(chiriwatch),
		task.run(weavewatch),
	])
})
