import Card from 'component/core/Card'
import Loading from 'component/core/Loading'
import Lore from 'component/core/Lore'
import { Component } from 'kitsui'
import Relic from 'Relic'
import Time from 'utility/Time'

export default Component(component => {
	component.style('main-cards')

	Card()
		.tweak(card => card.header.text.set(quilt => quilt['main/about-card/title']()))
		.tweak(card => card.append(Lore().text.set(quilt => quilt['main/about-card/description']())))
		.appendTo(component)

	Card()
		.tweak(card => {
			card.header.text.set(quilt => quilt['main/grants-card/title']())

			Loading().appendTo(card).set(
				async (signal, setProgress) => {
					setProgress(null, quilt => quilt['auth-card/loading']())
					const conduit = await Relic.connected
					// await sleep(100000)

					const bungieCode = localStorage.getItem('bungieCode')
					if (bungieCode) {
						localStorage.removeItem('bungieCode')
						await conduit._authenticate(bungieCode)
					}

					return {
						conduit,
						grants: await conduit.getOriginGrants(),
					}
				},
				(slot, { conduit, grants }) => {
					if (!grants.length) {
						Lore()
							.text.set(quilt => quilt['main/grants-card/description/none']())
							.appendTo(card)
						return
					}

					Lore()
						.text.set(quilt => quilt['main/grants-card/description/grants']())
						.appendTo(card)

					for (const grant of grants)
						Component('a')
							.attributes.set('href', `${location.origin}${location.pathname}?auth=${encodeURIComponent(grant.origin)}`)
							.style('grant')
							.append(Component().style('grant-name').text.set(quilt => quilt['main/grants-card/grant-name'](grant.origin, grant.appName)))
							.append(Lore().style('grant-time').text.set(quilt => quilt['shared/granted-since'](Time.relative(grant.authTimestamp))))
							.appendTo(card)
				},
			)
		})
		.appendTo(component)

	return component
})
