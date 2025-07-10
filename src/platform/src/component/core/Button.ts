import { Component } from 'kitsui'

export default Component('button', component => {
	const button = component.style('button')
	const buttonText = Component().style('button-text').appendTo(button)
	button.extendJIT('text', button => buttonText.text.rehost(button))
	return button
})
