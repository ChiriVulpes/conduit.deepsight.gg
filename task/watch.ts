import { Task } from 'task'
import serve from './serve'
import { tsWatch } from './ts'
import vendor from './vendor'

export default Task('watch', async task => {
	await task.run(vendor)
	await Promise.all([
		task.run(tsWatch),
		// task.watch('out/index.js', bundle),
		task.run(serve),
	])
})
