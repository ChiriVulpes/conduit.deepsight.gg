import Conduit from 'Conduit'
import quilt from 'lang'
import style from 'style'

export default async function () {
	const conduit = await Conduit({
		service: location.origin,
	})

	console.log(conduit)

	console.log(quilt)
	console.log(style)
}
