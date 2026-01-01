import type { ServerResponse } from 'bungie-api-ts/common'
import { PlatformErrorCodes } from 'bungie-api-ts/common'
import Auth from 'model/Auth'
import Log from 'utility/Log'

type Jsonable = string | number | boolean | null | undefined | Jsonable[] | { [key: string | number]: Jsonable }
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

		if (value === undefined)
			return ''

		return encodeURIComponent(String(value))
	}
}

const mergeSearchParams = (...params: (string | Record<string, Jsonable> | URLSearchParams)[]): string => {
	return new URLSearchParams(params
		.filter(param => typeof param !== 'string' || param.includes('?'))
		.map(param => param instanceof URLSearchParams ? param : new URLSearchParams(typeof param !== 'string'
			? Jsonable.searchParamsIfy(param)
			: param.split('?').at(-1)
		))
		.flatMap(param => [...param.entries()])
	).toString()
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
		await promise.catch(() => { })
		queueIds.shift()
		queuePromise = undefined
		return promise
	}

	export async function get<T> (url: string, body?: Record<string, Jsonable>, options?: RequestInit) {
		return await queue(async () => {
			if (!url.startsWith('/')) url = `/${url}`
			if (body) url = `${url}?${mergeSearchParams(url, body)}`
			Log.info('GET', url)
			return self.fetch(`${origin}${url}`, {
				...options,
				headers: { ...await Auth.getHeaders(), ...options?.headers },
			})
				.then(handleBungieResponse) as Promise<T>
		})
	}

	export async function getForUser<T> (url: string, body?: Record<string, Jsonable>) {
		return await queue(async () => {
			if (!url.startsWith('/')) url = `/${url}`
			if (body) url = `${url}?${mergeSearchParams(url, body)}`
			Log.info('GET:AUTHED', url)
			return self.fetch(`${origin}${url}`, {
				headers: { ...await Auth.getAuthedHeaders() },
			})
				.then(handleBungieResponse) as Promise<T>
		})
	}

	export async function post<T> (url: string, body: Record<string, Jsonable>) {
		return await queue(async () => {
			if (!url.startsWith('/')) url = `/${url}`
			Log.info('POST', url)
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
			Log.info('POST:AUTHED', url)
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
					Log.info(response.ErrorStatus, response.Message)
					throw error
				}

				return response.Response
			})
	}
}

export default Bungie
