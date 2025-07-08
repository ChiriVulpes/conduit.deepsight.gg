import { Middleware, Server, Task } from 'task'
import Env from './utility/Env'

declare module 'task/server/Server' {
	interface MessageTypeRegistry {
		'notify:ts': null
		'notify:css': null
	}
}

const _ = undefined
export default Task('serve', async task => {
	if (!Env.PORT || !Env.TEST_PORT)
		throw new Error('Must set PORT and TEST_PORT environment variables')

	const spaIndexRewrite = `(${[
		'not ends_with(http.request.uri.path, ".html")',
		'not ends_with(http.request.uri.path, ".js")',
		'not ends_with(http.request.uri.path, ".css")',
		'not ends_with(http.request.uri.path, ".woff")',
		'not ends_with(http.request.uri.path, ".woff2")',
		'not ends_with(http.request.uri.path, ".ttf")',
		'not ends_with(http.request.uri.path, ".webp")',
		'not ends_with(http.request.uri.path, ".png")',
		'http.request.uri.path ne "/.env"',
		'http.request.uri.path ne "/service"',
		'http.request.uri.path ne "/auth"',
	].join(' and ')})`
	const router = Middleware((definition, req, res) => _
		?? Middleware.Static(definition, req, res)
		?? Middleware.E404(definition, req, res)
	)
	const conduitServer = await Server({
		port: +Env.PORT,
		root: 'out/service',
		serverIndex: '/index.html',
		spaIndexRewrite,
		router,
	})

	await conduitServer.listen()
	conduitServer.socket()
	conduitServer.announce()

	task.watch('out/service/index.js', Task(null, () => {
		conduitServer.sendMessage('notify:ts', null)
	}))

	task.watch('out/service/style/index.css', Task(null, () => {
		conduitServer.sendMessage('notify:css', null)
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
