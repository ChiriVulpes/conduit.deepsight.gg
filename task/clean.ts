import fs from 'fs/promises'
import { Task } from 'task'

export default Task('clean', async task => {
	await fs.rm('out', { recursive: true, force: true })
})
