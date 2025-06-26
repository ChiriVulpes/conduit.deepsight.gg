import { Middleware, Server, Task } from 'task'
import Env from './utility/Env'

declare module 'task/server/Server' {
	interface MessageTypeRegistry {
		'notify:ts': null
	}
}

const _ = undefined
export default Task('serve', async task => {
	if (!Env.PORT || !Env.TEST_PORT)
		throw new Error('Must set PORT and TEST_PORT environment variables')

	const spaIndexRewrite = '(http.request.uri.path ne "/out/index.js" and http.request.uri.path ne "/.env")'
	const router = Middleware((definition, req, res) => _
		?? Middleware.Static(definition, req, res)
		?? Middleware.E404(definition, req, res)
	)
	const conduitServer = await Server({
		port: +Env.PORT,
		root: '.',
		serverIndex: '/task/server/conduit.html',
		spaIndexRewrite,
		router,
	})

	await conduitServer.listen()
	conduitServer.socket()
	conduitServer.announce()

	task.watch('out/index.js', Task(null, () => {
		conduitServer.sendMessage('notify:ts', null)
	}))

	const testServer = await Server({
		port: +Env.TEST_PORT,
		root: '.',
		serverIndex: '/task/server/test.html',
		spaIndexRewrite,
		router,
	})

	await testServer.listen()
	testServer.announce()
})
