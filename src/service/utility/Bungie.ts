import type { ServerResponse } from 'bungie-api-ts/common'
import { PlatformErrorCodes } from 'bungie-api-ts/common'
import Auth from 'model/Auth'

type Jsonable = string | number | boolean | null | Jsonable[] | { [key: string | number]: Jsonable }
namespace Jsonable {
	export function searchParamsIfy (value: Jsonable): string {
		if (Array.isArray(value))
			return value
				.map(item => searchParamsIfy(item))
				.join(',')

		if (typeof value === 'object' && value !== null)
			return Object.entries(value)
				.map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(searchParamsIfy(val))}`)
				.join('&')

		return encodeURIComponent(String(value))
	}
}

namespace Bungie {

	const origin = 'https://www.bungie.net/Platform'

	let queueId = 0
	const queueIds: number[] = []
	let queuePromise: Promise<unknown> | undefined
	async function queue<T> (fn: () => Promise<T>): Promise<T> {
		const id = ++queueId
		queueIds.push(id)

		while (queuePromise && queueIds[0] !== id)
			await Promise.resolve(queuePromise).catch(() => { })

		const promise = queuePromise = Promise.resolve(fn())
		const result = await promise
		queueIds.shift()
		queuePromise = undefined
		return result
	}

	export async function get<T> (url: string, body?: Record<string, Jsonable>) {
		return await queue(async () => {
			if (!url.startsWith('/')) url = `/${url}`
			if (body) url = `${url}?${Jsonable.searchParamsIfy(body ?? {})}`
			return self.fetch(`${origin}${url}`, {
				headers: { ...await Auth.getHeaders() },
			})
				.then(handleBungieResponse) as Promise<T>
		})
	}

	export async function getForUser<T> (url: string, body?: Record<string, Jsonable>) {
		return await queue(async () => {
			if (!url.startsWith('/')) url = `/${url}`
			if (body) url = `${url}?${Jsonable.searchParamsIfy(body ?? {})}`
			return self.fetch(`${origin}${url}`, {
				headers: { ...await Auth.getAuthedHeaders() },
			})
				.then(handleBungieResponse) as Promise<T>
		})
	}

	export async function post<T> (url: string, body: Record<string, Jsonable>) {
		return await queue(async () => {
			if (!url.startsWith('/')) url = `/${url}`
			return self.fetch(`${origin}${url}`, {
				method: 'POST',
				headers: { ...await Auth.getHeaders() },
				body: JSON.stringify(body),
			})
				.then(handleBungieResponse) as Promise<T>
		})
	}

	export async function postForUser<T> (url: string, body: Record<string, Jsonable>) {
		return await queue(async () => {
			if (!url.startsWith('/')) url = `/${url}`
			return self.fetch(`${origin}${url}`, {
				method: 'POST',
				headers: { ...await Auth.getAuthedHeaders() },
				body: JSON.stringify(body),
			})
				.then(handleBungieResponse) as Promise<T>
		})
	}

	async function handleBungieResponse<T> (response: Response) {
		return await (response.text())
			.then(text => {
				return JSON.parse(text) as ServerResponse<T>
			})
			.catch(err => ({
				Response: undefined!,
				ErrorCode: -1 as PlatformErrorCodes,
				ErrorStatus: 'FetchError',
				Message: err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error',
				MessageData: {},
				ThrottleSeconds: 0,
			} satisfies ServerResponse<T>))
			.then(response => {
				if (response.ErrorCode && response.ErrorCode !== PlatformErrorCodes.Success) {
					const error = Object.assign(new Error(`${response.Message}`), response.MessageData)
					error.name = response.ErrorStatus
					Object.assign(error, { code: response.ErrorCode })
					throw error
				}

				return response.Response
			})
	}
}

export default Bungie
