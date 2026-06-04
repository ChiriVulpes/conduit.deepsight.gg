import fs from 'fs/promises'
import { Dependencies, Task } from 'task'

export default Task('vendor', async () => {
	const amdHeader = await Dependencies.get('amd')
	await fs.mkdir('src/service/bundle', { recursive: true })
	await fs.mkdir('src/platform/src/bundle', { recursive: true })
	await fs.writeFile('src/service/bundle/amd.js', amdHeader)
	await fs.writeFile('src/platform/src/bundle/amd.js', amdHeader)
	await fs.copyFile('node_modules/dexie/dist/dexie.min.js', 'src/service/bundle/dexie.min.js')
	await fs.copyFile('node_modules/jsonpath-plus/dist/index-browser-umd.min.js', 'src/service/bundle/jsonpath-plus.min.js')
})
