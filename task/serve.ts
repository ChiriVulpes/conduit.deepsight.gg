import { Middleware, Server, Task } from 'task'
import Env from './utility/Env'

declare module 'task/server/Server' {
	interface MessageTypeRegistry {
		'notify:ts': null
	}
}

const _ = undefined
export default Task('serve', async task => {
	if (!Env.PORT)
		throw new Error('Must set PORT environment variable')

	const server = await Server({
		port: +Env.PORT,
		root: '.',
		spaIndexRewrite: '(http.request.uri.path ne "/out/index.js" and http.request.uri.path ne "/.env")',
		serverIndex: '/task/server/index.html',
		router: Middleware((definition, req, res) => _
			?? Middleware.Static(definition, req, res)
			?? Middleware.E404(definition, req, res)
		),
	})

	await server.listen()
	server.socket()
	server.announce()

	task.watch('out/index.js', Task(null, () => {
		server.sendMessage('notify:ts', null)
	}))
})
