import type { AuthedOrigin } from 'Auth'
import ActionRow from 'component/core/ActionRow'
import Button from 'component/core/Button'
import Card from 'component/core/Card'
import Footer from 'component/core/Footer'
import Loading from 'component/core/Loading'
import Lore from 'component/core/Lore'
import Paragraph from 'component/core/Paragraph'
import type Conduit from 'Conduit'
import { Component, State } from 'kitsui'
import type { Quilt } from 'lang'
import Relic from 'Relic'
import Env from 'utility/Env'
import Time from 'utility/Time'

interface ConduitTarget {
	origin: string
	appName?: string
}

interface AuthState {
	conduit: Conduit
	authed: boolean
	target: ConduitTarget
	targetGrantedAccess?: AuthedOrigin
}

export default Component((component, target: ConduitTarget) => {
	const card = component.and(Card)
	card.header.text.set(quilt => quilt['auth-card/header']())

	const authState = State.Async<AuthState, Quilt.Handler>(card, async (signal, setProgress) => {
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
			authed: await conduit.isAuthenticated(),
			target,
			targetGrantedAccess: await conduit.getOriginAccess(target.origin),
		}
	})

	Loading()
		.set(authState, (slot, state) => {
			const { conduit } = state
			const appName = state.target.appName ?? state.target.origin
			if (state.targetGrantedAccess) {
				Lore()
					.text.set(quilt => quilt['auth-card/description/granted'](appName))
					.appendTo(slot)

				Paragraph()
					.text.set(quilt => quilt['auth-card/granted-since'](Time.relative(state.targetGrantedAccess!.authTimestamp)))
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
				const bungieAuthURL = `https://www.bungie.net/en/OAuth/Authorize?client_id=${Env.BUNGIE_AUTH_CLIENT_ID}&response_type=code`
				localStorage.setItem('bungieAuthState', location.href)
				Footer()
					.append(Component('a')
						.and(Button)
						.attributes.set('href', `${bungieAuthURL}&state=${encodeURIComponent(location.href)}`)
						.attributes.set('target', window.opener ? '_self' : '_blank')
						.text.set(quilt => quilt['auth-card/action/auth-bungie']())
						.event.subscribe('click', async event => {
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
							await new Promise<void>(resolve => {
								const interval = setInterval(() => {
									if (popup?.closed) {
										resolve()
										clearInterval(interval)
									}
								}, 100)
							})

							authState.refresh()
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
					authState.refresh()
				})
				.appendTo(grantActions)

			Button()
				.text.set(quilt => quilt['auth-card/action/grant']())
				.event.subscribe('click', async () => {
					await conduit._grantAccess(target.origin)
					authState.refresh()
				})
				.appendTo(grantActions)
		})
		.appendTo(card)

	return card
})
