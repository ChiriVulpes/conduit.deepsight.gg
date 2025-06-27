import fs from 'fs/promises'
import { Task } from 'task'

export default Task('static', async task => {
	await fs.copyFile('src/service/service.html', 'out/service/index.html')
})
