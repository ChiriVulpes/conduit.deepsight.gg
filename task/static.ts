import fs from 'fs/promises'
import { Task } from 'task'

export default Task('static', async task => {
	await fs.mkdir('out/service', { recursive: true })
	await fs.copyFile('src/service/index.html', 'out/service/index.html')
	await fs.mkdir('out/service/auth', { recursive: true })
	await fs.copyFile('src/service/auth.html', 'out/service/auth/index.html')
	await fs.mkdir('out/service/service', { recursive: true })
	await fs.copyFile('src/service/service.html', 'out/service/service/index.html')
	await fs.copyFile('.env', 'out/service/.env')
})
