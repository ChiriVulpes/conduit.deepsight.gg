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
		return await queue(() => request<T>('GET', url, body, async () => await Auth.getHeaders(), options))
	}

	export async function getForUser<T> (url: string, body?: Record<string, Jsonable>) {
		return await queue(() => request<T>('GET:AUTHED', url, body, async () => await Auth.getAuthedHeaders()))
	}

	export async function post<T> (url: string, body: Record<string, Jsonable>) {
		return await queue(() => request<T>('POST', url, undefined, async () => await Auth.getHeaders(), {
			method: 'POST',
			body: JSON.stringify(body),
		}))
	}

	export async function postForUser<T> (url: string, body: Record<string, Jsonable>) {
		return await queue(() => request<T>('POST:AUTHED', url, undefined, async () => await Auth.getAuthedHeaders(), {
			method: 'POST',
			body: JSON.stringify(body),
		}))
	}

	export namespace action {

		export async function postForUser<T> (url: string, body: Record<string, Jsonable>) {
			return await request<T>('POST:AUTHED:ACTION', url, undefined, async () => await Auth.getAuthedHeaders(), {
				method: 'POST',
				body: JSON.stringify(body),
			})
		}

	}

	async function request<T> (
		label: string,
		url: string,
		body: Record<string, Jsonable> | undefined,
		headers: () => Promise<object | undefined>,
		options?: RequestInit
	) {
		if (!url.startsWith('/')) url = `/${url}`
		if (body) url = `${url}?${mergeSearchParams(url, body)}`
		Log.info(label, url)
		const resolvedHeaders = await headers()
		return self.fetch(`${origin}${url}`, {
			...options,
			headers: { ...resolvedHeaders, ...options?.headers as Record<string, string> } as HeadersInit,
		})
			.then(handleBungieResponse) as Promise<T>
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
