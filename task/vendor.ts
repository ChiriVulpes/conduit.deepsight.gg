import fs from 'fs/promises'
import { Dependencies, Task } from 'task'

export default Task('vendor', async () => {
	const amdHeader = await Dependencies.get('amd')
	await fs.writeFile('src/service/bundle/amd.js', amdHeader)
	await fs.writeFile('src/platform/src/bundle/amd.js', amdHeader)
})
