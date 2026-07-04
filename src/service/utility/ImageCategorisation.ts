import { DefinitionImageFraming, type DefinitionImage, type DefinitionImageLayout } from '@shared/DefinitionComponents'

const BUNGIE_ORIGIN = 'https://www.bungie.net'
const imageHashCache = new Map<string, Promise<string>>()

export interface DeepsightImageAnalysisDefinition {
	analysis: Record<string, boolean | undefined>
	visualHash?: string
}

export interface DeepsightImageCategoryDefinition {
	hash: number
	framing: DefinitionImageFraming | undefined
	paths: DeepsightImageCategoryPathDefinition[]
}

export interface DeepsightImageCategoryPathDefinition {
	component: string
	path: string
}

export interface DiscoveredDefinitionImage {
	readonly rawUrl: string
	readonly canonicalUrl: string
	readonly sourcePath: string
	readonly sourceCategory: number
	readonly framing: DefinitionImageFraming
	readonly categories: readonly number[]
	readonly visualHash?: string
}

export interface ImageDefinitionData {
	readonly categoryDefinitions: Record<string, DeepsightImageCategoryDefinition>
	readonly imageAnalyses: Record<string, DeepsightImageAnalysisDefinition>
}

export async function discoverDefinitionImages (
	component: string,
	definition: unknown,
	data: ImageDefinitionData,
	deepsightImageBaseUrl: string,
): Promise<DiscoveredDefinitionImage[]> {
	const images: DiscoveredDefinitionImage[] = []
	for (const categoryDefinition of Object.values(data.categoryDefinitions)) {
		for (const sourcePath of categoryDefinition.paths) {
			if (sourcePath.component !== component)
				continue

			for (const rawUrl of getPathValues(definition, sourcePath.path)) {
				if (typeof rawUrl !== 'string' || !isSupportedImageValue(rawUrl))
					continue

				const canonicalUrl = canonicaliseImageUrl(rawUrl, deepsightImageBaseUrl)
				if (!canonicalUrl)
					continue

				const imageAnalysis = data.imageAnalyses[await imageHash(canonicalUrl)]
				images.push({
					rawUrl,
					canonicalUrl,
					sourcePath: sourcePath.path,
					sourceCategory: categoryDefinition.hash,
					framing: getCategoryFraming(categoryDefinition),
					categories: getImageCategories(categoryDefinition.hash, imageAnalysis?.analysis),
					visualHash: imageAnalysis?.visualHash,
				})
			}
		}
	}

	return dedupeImages(images)
}

export function imageCategoriesMatch (image: DiscoveredDefinitionImage, categories: readonly number[]) {
	if (!categories.length)
		return true

	return categories.every(category => image.categories.includes(category))
}

export function toDefinitionImage (image: DiscoveredDefinitionImage): DefinitionImage {
	return {
		url: image.canonicalUrl,
		framing: image.framing,
		categories: [...image.categories],
		visualHash: image.visualHash,
	}
}

export function getImageLayout (images: Iterable<DiscoveredDefinitionImage>, filtered: boolean): DefinitionImageLayout {
	if (!filtered)
		return { slots: 8, columns: 4, rows: 2 }

	const slots = Math.max(1, Math.min(8, new Set(Array.from(images, image => `${image.sourceCategory}:${image.sourcePath}`)).size))
	const rows = slots <= 4 ? 1 : 2
	const columns = slots <= 4 ? slots : slots <= 6 ? 3 : 4
	return { slots, columns, rows }
}

export function canonicaliseImageUrl (raw: string, deepsightImageBaseUrl: string): string | undefined {
	raw = raw.trim()
	if (!raw)
		return undefined

	try {
		if (/^https?:\/\//i.test(raw))
			return normaliseUrl(new URL(raw))

		if (raw.startsWith('./'))
			return normaliseUrl(new URL(raw.slice(2), `${trimTrailingSlash(deepsightImageBaseUrl)}/`))

		if (raw.startsWith('/image/') || raw.startsWith('/static/'))
			return normaliseUrl(new URL(raw, `${trimTrailingSlash(deepsightImageBaseUrl)}/`))

		if (raw.startsWith('/'))
			return normaliseUrl(new URL(raw, BUNGIE_ORIGIN))
	}
	catch {
		return undefined
	}

	return undefined
}

export async function imageHash (canonicalUrl: string) {
	let hash = imageHashCache.get(canonicalUrl)
	if (hash)
		return await hash

	hash = crypto
		.subtle
		.digest('SHA-1', new TextEncoder().encode(canonicalUrl))
		.then(digest => Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''))
	imageHashCache.set(canonicalUrl, hash)
	return await hash
}

function getImageCategories (sourceCategory: number, analysis: Record<string, boolean | undefined> | undefined) {
	const categories = new Set<number>()
	if (analysis?.[sourceCategory])
		categories.add(sourceCategory)

	if (analysis) for (const [category, matched] of Object.entries(analysis))
		if (matched)
			categories.add(Number(category))

	return Array.from(categories).sort((a, b) => a - b)
}

function getPathValues (value: unknown, sourcePath: string): unknown[] {
	let values = [value]
	for (const segment of sourcePath.split('.')) {
		values = values.flatMap(value => {
			if (segment === '[]')
				return Array.isArray(value) ? value : []

			if (segment === '{}')
				return value && typeof value === 'object' ? Object.values(value) : []

			return value && typeof value === 'object' && segment in value
				? [(value as Record<string, unknown>)[segment]]
				: []
		})
	}

	return values
}

function dedupeImages (images: DiscoveredDefinitionImage[]) {
	const canonicalDeduped = new Map<string, DiscoveredDefinitionImage>()
	for (const image of images) {
		const existing = canonicalDeduped.get(image.canonicalUrl)
		if (!existing) {
			canonicalDeduped.set(image.canonicalUrl, image)
			continue
		}

		canonicalDeduped.set(image.canonicalUrl, mergeImages(existing, image))
	}

	const visualDeduped = new Map<string, DiscoveredDefinitionImage>()
	const result: DiscoveredDefinitionImage[] = []
	for (const image of canonicalDeduped.values()) {
		if (!image.visualHash) {
			result.push(image)
			continue
		}

		const existing = visualDeduped.get(image.visualHash)
		if (!existing) {
			visualDeduped.set(image.visualHash, image)
			result.push(image)
			continue
		}

		const merged = mergeImages(existing, image)
		visualDeduped.set(image.visualHash, merged)
		result[result.indexOf(existing)] = merged
	}

	return result
}

function mergeImages (existing: DiscoveredDefinitionImage, image: DiscoveredDefinitionImage): DiscoveredDefinitionImage {
	return {
		...existing,
		framing: mergeImageFraming(existing.framing, image.framing),
		categories: [...new Set([...existing.categories, ...image.categories])].sort((a, b) => a - b),
		visualHash: existing.visualHash ?? image.visualHash,
	}
}

function getCategoryFraming (categoryDefinition: DeepsightImageCategoryDefinition) {
	return categoryDefinition.framing ?? DefinitionImageFraming.Complete
}

function mergeImageFraming (a: DefinitionImageFraming, b: DefinitionImageFraming) {
	return a === DefinitionImageFraming.Complete || b === DefinitionImageFraming.Complete
		? DefinitionImageFraming.Complete
		: DefinitionImageFraming.CropSafe
}

function trimTrailingSlash (value: string) {
	return value.replace(/\/+$/, '')
}

function normaliseUrl (url: URL) {
	url.protocol = url.protocol.toLowerCase()
	url.hostname = url.hostname.toLowerCase()
	url.hash = ''
	return url.href
}

function isSupportedImageValue (value: string) {
	if (!value.startsWith('http://') && !value.startsWith('https://') && !value.startsWith('/') && !value.startsWith('./'))
		return false

	return /\.(?:png|jpe?g|jfif|webp)(?:[?#].*)?$/i.test(value)
}
