import { Task } from 'task'

export default Task('lint', async task => {
	await task.exec('NPM:lint')
})
