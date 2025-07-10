import { Component } from 'kitsui'

interface CardExtensions {
	readonly header: Component
}

interface Card extends Component, CardExtensions { }

const Card = Component((component): Card => {
	return component.style('card')
		.extend<CardExtensions>(card => ({
			header: undefined!,
		}))
		.extendJIT('header', card => Component()
			.style('card-header')
			.tweak(header => {
				const text = Component().style('card-header-text').appendTo(header)
				header.extendJIT('text', header => text.text.rehost(header))
			})
			.prependTo(card)
		)
})

export default Card
