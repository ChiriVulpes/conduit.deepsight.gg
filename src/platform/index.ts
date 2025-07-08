import Conduit from 'Conduit'
import { Component, Kit } from 'kitsui'
import quilt from 'lang'
import DevServer from 'utility/DevServer'
import Env from 'utility/Env'

export default async function () {
	await Env["init"]()

	const conduit = await Conduit({
		service: location.origin,
	})

	DevServer.listen()

	console.log(conduit)

	console.log(quilt)

	Component.allowBuilding()

	Component.getBody().style('body')

	Kit.Label().appendTo(document.body).text.set('hi there')
}
