import fs from 'fs/promises'
import { Task } from 'task'

export default Task('static', async task => {
	await fs.mkdir('out/service', { recursive: true })
	await fs.copyFile('src/platform/index.html', 'out/service/index.html')
	await fs.mkdir('out/service/service', { recursive: true })
	await fs.copyFile('src/platform/service.html', 'out/service/service/index.html')
	await fs.copyFile('.env', 'out/service/.env')
	await fs.copyFile('src/platform/node_modules/kitsui/index.js', 'out/service/kitsui.js')
	await fs.rm('out/service/static', { recursive: true, force: true })
	await fs.cp('src/platform/static', 'out/service/static', { recursive: true, force: true })
})
