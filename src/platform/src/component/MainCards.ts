import ActionRow from 'component/core/ActionRow'
import Button from 'component/core/Button'
import Card from 'component/core/Card'
import Checkbox from 'component/core/Checkbox'
import Details from 'component/core/Details'
import FormRow from 'component/core/FormRow'
import Loading from 'component/core/Loading'
import Lore from 'component/core/Lore'
import Paragraph from 'component/core/Paragraph'
import TextInput from 'component/core/TextInput'
import { Component, State } from 'kitsui'
import Relic from 'Relic'
import Time from 'utility/Time'

export default Component(component => {
	component.style('main-cards')

	Card()
		.headerText.set(quilt => quilt['main/about-card/title']())
		.append(Lore().text.set(quilt => quilt['main/about-card/description']()))
		.appendTo(component)

	////////////////////////////////////
	//#region Grants
	Card().appendTo(component).tweak(card => {
		card.headerText.set(quilt => quilt['main/grants-card/title']())

		Loading().appendTo(card).set(
			async (signal, setProgress) => {
				setProgress(null, quilt => quilt['main/grants-card/loading']())
				const conduit = await Relic.connected
				// await sleep(100000)

				const bungieCode = localStorage.getItem('bungieCode')
				if (bungieCode) {
					localStorage.removeItem('bungieCode')
					await conduit._authenticate(bungieCode)
				}

				const authState = await conduit._getAuthState()

				return {
					conduit,
					grants: authState.accessGrants,
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
	//#endregion
	////////////////////////////////////

	////////////////////////////////////
	//#region Advanced
	Card().appendTo(component).tweak(card => {
		card.header.text.set(quilt => quilt['main/advanced-card/title']())

		Lore()
			.text.set(quilt => quilt['main/advanced-card/description']())
			.appendTo(card)

		Details()
			.summaryText.set(quilt => quilt['main/advanced-card/custom-app/title']())
			.append(Loading().appendTo(card).set(
				async (signal, setProgress) => {
					setProgress(null, quilt => quilt['main/advanced-card/custom-app/loading']())
					const conduit = await Relic.connected

					const authState = await conduit._getAuthState()

					return {
						conduit,
						customApp: authState.customApp,
					}
				},
				(slot, { conduit, customApp }) => {
					Paragraph()
						.text.set(quilt => quilt['main/advanced-card/custom-app/description']())
						.appendTo(slot)

					const apiKeyInput = TextInput().setValue(customApp?.apiKey)
					FormRow()
						.labelText.set(quilt => quilt['main/advanced-card/custom-app/api-key/label']())
						.append(apiKeyInput)
						.appendTo(slot)

					const clientIdInput = TextInput().setValue(customApp?.clientId)
					FormRow()
						.labelText.set(quilt => quilt['main/advanced-card/custom-app/client-id/label']())
						.append(clientIdInput)
						.appendTo(slot)

					const clientSecretInput = TextInput().setValue(customApp?.clientSecret)
					FormRow()
						.labelText.set(quilt => quilt['main/advanced-card/custom-app/client-secret/label']())
						.append(clientSecretInput)
						.appendTo(slot)

					const actions = ActionRow().appendTo(slot)

					Button()
						.setDisabled(!customApp, 'no custom app set')
						.text.set(quilt => quilt['main/advanced-card/shared-form/action/clear']())
						.event.subscribe('click', async () => {
							await conduit._setCustomApp()
							location.reload()
						})
						.appendTo(actions)

					Button()
						.tweak(button => button.bindDisabled(
							State.Every(button, apiKeyInput.state, clientIdInput.state, clientSecretInput.state).falsy,
							'missing input',
						))
						.text.set(quilt => quilt['main/advanced-card/shared-form/action/save']())
						.event.subscribe('click', async () => {
							await conduit._setCustomApp({
								apiKey: apiKeyInput.state.value,
								clientId: clientIdInput.state.value,
								clientSecret: clientSecretInput.state.value,
							})
							location.reload()
						})
						.appendTo(actions)
				},
			))
			.appendTo(card)

		Details()
			.summaryText.set(quilt => quilt['main/advanced-card/settings/title']())
			.append(Loading().appendTo(card).set(
				async (signal, setProgress) => {
					setProgress(null, quilt => quilt['main/advanced-card/settings/loading']())
					const conduit = await Relic.connected

					const verboseLogging = await conduit._getSetting('verboseLogging')

					return {
						conduit,
						verboseLogging,
					}
				},
				(slot, { conduit, verboseLogging }) => {
					const verboseLoggingCheckbox = Checkbox()
						.tweak(checkbox => checkbox.label.text.set(quilt => quilt['main/advanced-card/settings/verbose-logging/label']()))
						.setChecked(!!verboseLogging)
						.appendTo(slot)

					const actions = ActionRow().appendTo(slot)

					Button()
						.text.set(quilt => quilt['main/advanced-card/shared-form/action/save']())
						.event.subscribe('click', async () => {
							await Promise.all([
								conduit._setSetting('verboseLogging', verboseLoggingCheckbox.checked.value ? true : undefined),
							])
						})
						.appendTo(actions)
				},
			))
			.appendTo(card)
	})
	//#endregion
	////////////////////////////////////

	return component
})
