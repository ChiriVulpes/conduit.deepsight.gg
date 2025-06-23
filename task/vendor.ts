import fs from 'fs/promises'
import { Dependencies, Task } from 'task'

export default Task('vendor', async () => {
	const amdHeader = await Dependencies.get('amd')
	await fs.writeFile('src/utility/amd.js', amdHeader)
})
