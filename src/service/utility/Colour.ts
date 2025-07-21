import type { DestinyColor } from 'bungie-api-ts/destiny2'

namespace Colour {
	export function fromDestiny (destiny: DestinyColor): number {
		const { red, green, blue } = destiny
		return (red << 16) | (green << 8) | blue
	}
}

export default Colour
