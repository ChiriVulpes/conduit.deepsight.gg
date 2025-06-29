import { Task } from 'task'
import serve from './serve'
import _static from './static'
import { tsWatch } from './ts'
import vendor from './vendor'

export default Task('watch', async task => {
	await task.run(vendor)

	await task.run(_static)
	task.watch(['src/service/*.html', '.env'], _static)

	await Promise.all([
		task.run(tsWatch),
		task.run(serve),
	])
})
