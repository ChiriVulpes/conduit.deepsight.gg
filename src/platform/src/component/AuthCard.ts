import ActionRow from 'component/core/ActionRow'
import Button from 'component/core/Button'
import Card from 'component/core/Card'
import Footer from 'component/core/Footer'
import Loading from 'component/core/Loading'
import Lore from 'component/core/Lore'
import Paragraph from 'component/core/Paragraph'
import { Component } from 'kitsui'
import Relic from 'Relic'
import Time from 'utility/Time'

interface ConduitTarget {
	origin: string
	appName?: string
}

export default Component((component, target: ConduitTarget) => {
	const card = component.and(Card)
	card.header.text.set(quilt => quilt['auth-card/title']())

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

			const [authed, targetGrantedAccess, bungieAuthURL] = await Promise.all([
				conduit.isAuthenticated(),
				conduit.getOriginAccess(target.origin),
				conduit._getBungieAuthURL(),
			])

			target.appName = targetGrantedAccess?.appName ?? target.appName

			return {
				conduit,
				authed,
				target,
				targetGrantedAccess,
				bungieAuthURL,
			}
		},
		(slot, state) => {
			const { conduit, bungieAuthURL } = state
			const appName = state.target.appName ?? state.target.origin
			if (state.targetGrantedAccess) {
				Lore()
					.text.set(quilt => quilt['auth-card/description/granted'](appName))
					.appendTo(slot)

				Paragraph()
					.text.set(quilt => quilt['shared/granted-since'](Time.relative(state.targetGrantedAccess!.authTimestamp)))
					.appendTo(slot)

				const actions = ActionRow().appendTo(slot)

				Button()
					.text.set(quilt => quilt['auth-card/action/revoke-access']())
					.event.subscribe('click', async () => {
						await conduit._denyAccess(state.target.origin)
						location.href = location.origin
					})
					.appendTo(actions)

				return
			}

			Lore()
				.text.set(quilt => quilt['auth-card/description/request'](appName))
				.appendTo(slot)

			if (!state.authed) {
				localStorage.setItem('bungieAuthState', location.href)
				Footer()
					.append(Component('a')
						.and(Button)
						.attributes.set('href', `${bungieAuthURL}&state=${encodeURIComponent(location.href)}`)
						.attributes.set('target', window.opener ? '_self' : '_blank')
						.text.set(quilt => quilt['auth-card/action/auth-bungie']())
						.event.subscribe('click', event => {
							if (window.opener)
								return

							const width = 600
							const height = 800
							const left = (window.innerWidth - width) / 2 + window.screenLeft
							const top = (window.innerHeight - height) / 2 + window.screenTop
							const popup = window.open(`${bungieAuthURL}&state=popup`, '_blank', `width=${width},height=${height},left=${left},top=${top}`)
							if (!popup)
								throw new Error('Failed to open auth popup')

							event.preventDefault()

							const interval = setInterval(() => {
								if (popup?.closed) {
									slot.refresh()
									clearInterval(interval)
								}
							}, 100)
						})
					)
					.appendTo(slot)

				return
			}

			const grantActions = ActionRow().appendTo(slot)

			Button()
				.text.set(quilt => quilt['auth-card/action/cancel']())
				.event.subscribe('click', async () => {
					await conduit._denyAccess(target.origin)
					if (window.opener)
						window.close()
					else
						location.href = location.origin
				})
				.appendTo(grantActions)

			Button()
				.text.set(quilt => quilt['auth-card/action/grant']())
				.event.subscribe('click', async () => {
					await conduit._grantAccess(target.origin, target.appName)
					if (window.opener)
						window.close()
					else
						slot.refresh()
				})
				.appendTo(grantActions)
		},
	)

	return card
})
