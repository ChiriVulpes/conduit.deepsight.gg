import fs from 'fs/promises'
import path from 'path'
import { Task } from 'task'
import { glob } from 'tinyglobby'

function getModuleName (file: string): string {
	return 'conduit.deepsight.gg/'
		+ path.relative('out/shared', file)
			.replace(/\.d\.ts$/, '')
			.replace(/\\/g, '/')
}

export default Task('package', async () => {
	const sourceFiles = await glob('out/shared/**/*.d.ts')
		.then(files => Promise.all(files.map(async file => [getModuleName(file), await fs.readFile(file, 'utf8')] as const)))

	let injectFile = await fs.readFile('out/client/index.d.ts', 'utf8').catch(() => '')
	injectFile = injectFile
		.replace('declare module "Conduit"', 'declare module "conduit.deepsight.gg"')
		.replace(/(?<=declare module ")(?!conduit|bungie-api-ts)/g, 'conduit.deepsight.gg/')
		.replace(/(?<= from ['"])(?!conduit|bungie-api-ts)/g, 'conduit.deepsight.gg/')

	for (const [module, file] of sourceFiles)
		injectFile = `declare module "${module}" {\n${(file
			.replace(/^|(?<=\n)/g, '    ')
			.replace(/(?<= from ['"])(?!conduit|bungie-api-ts)/g, 'conduit.deepsight.gg/')
			.trimEnd()
		)}\n}\n${injectFile}`

	await fs.mkdir('out/package', { recursive: true })
	await fs.writeFile('out/package/index.d.ts', injectFile, 'utf8')

	const packageJsonString = await fs.readFile('src/client/package.json', 'utf8')
	// eslint-disable-next-line @typescript-eslint/consistent-type-imports
	const packageJson = JSON.parse(packageJsonString) as Partial<typeof import('../src/client/package.json')>
	// delete packageJson.devDependencies
	delete packageJson.private
	await fs.writeFile('out/package/package.json', JSON.stringify(packageJson, null, '\t'), 'utf8')

	let indexJs = await fs.readFile('out/client/index.js', 'utf8').catch(() => '')
	indexJs = indexJs
		.replace(/(?<=define\(")Conduit(?=")/g, 'conduit.deepsight.gg')
		.replace(/(?<=define\(")([^"]+", \["require", "exports")([^\]]*)/g, function (match, moduleNameAndRequireExports: string, imports: string) {
			const prefix = moduleNameAndRequireExports.startsWith('conduit') ? '' : 'conduit.deepsight.gg/'
			return `${prefix}${moduleNameAndRequireExports}${(imports
				.replace(/(?<=, ")/g, 'conduit.deepsight.gg/')
			)}`
		})
	await fs.writeFile('out/package/index.js', indexJs, 'utf8')
})
