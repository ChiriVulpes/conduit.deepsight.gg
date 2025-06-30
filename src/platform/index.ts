import Conduit from 'Conduit'

export default async function () {
	const conduit = await Conduit({
		service: location.origin,
	})

	console.log(conduit)
}
