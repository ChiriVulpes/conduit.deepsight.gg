import Paragraph from 'component/core/Paragraph'
import { Component, State } from 'kitsui'
import type { StringApplicatorSource } from 'kitsui/utility/StringApplicator'

interface LoadingExtensions {
	set<T> (state: State.Async<T, StringApplicatorSource>, initialiser: (slot: Component, value: T) => unknown): this
}

interface Loading extends Component, LoadingExtensions { }

const Loading = Component((component): Loading => {
	const storage = Component().setOwner(component)

	const spinner = Component().style('loading-spinner')
		.append(...([1, 2, 3, 4] as const).map(i => Component().style('loading-spinner-dot', `loading-spinner-dot-${i}`)))
	// eslint-disable-next-line @typescript-eslint/no-misused-promises
	const interval = setInterval(async () => {
		for (const dot of spinner.getChildren())
			dot.style('loading-spinner-dot--no-animate')
		await new Promise(resolve => setTimeout(resolve, 10))
		for (const dot of spinner.getChildren())
			dot.style.remove('loading-spinner-dot--no-animate')
	}, 2000)

	const progress = Component().style('loading-progress')
	const message = Paragraph().style('loading-message')
	const errorIcon = Component().style('loading-error-icon')
	const error = Paragraph().style('loading-error')

	let owner: State.Owner.Removable | undefined
	return component.style('loading')
		.extend<LoadingExtensions>(loading => ({
			set (state, initialiser) {
				owner?.remove(); owner = State.Owner.create()
				loading.style.bind(state.settled, 'loading--loaded')
				progress
					.style.bind(state.progress.map(owner, progress => progress?.progress === null), 'loading-progress--unknown')
					.style.bindVariable('progress', state.progress.map(owner, progress => progress?.progress ?? 1))
				message.text.bind(state.progress.map(owner, progress => progress?.details))
				error.text.bind(state.error.map(owner, error => error?.message ?? (quilt => quilt['shared/errored']())))
				state.state.use(owner, state => {
					storage.append(spinner, progress, message, errorIcon, error)
					loading.removeContents()

					if (!state.settled) {
						loading.append(spinner, progress, message)
						return
					}

					if (state.error) {
						loading.append(errorIcon, error)
						return
					}

					initialiser(loading, state.value)
				})
				return loading
			},
		}))
		.onRemoveManual(() => {
			clearInterval(interval)
			owner?.remove()
		})
})

export default Loading
