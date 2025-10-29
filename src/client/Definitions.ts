import type Conduit from 'conduit.deepsight.gg/Conduit'
import type { AllComponentNames, DefinitionLinks, DefinitionsFilter as DefinitionsFilterSerialised, DefinitionsForComponentName, DefinitionsPage, DefinitionWithLinks } from 'conduit.deepsight.gg/DefinitionComponents'

export interface DefinitionsFilter<DEFINITION> extends Omit<DefinitionsFilterSerialised, 'evalExpression'> {
	/** @deprecated This is only available when the client page has been granted permission by the user. When no permission is granted, it does nothing. */
	evalExpression?(def: DEFINITION): unknown
}

interface DefinitionsProvider<DEFINITION> {
	all (filter?: DefinitionsFilter<DEFINITION[keyof DEFINITION]>): Promise<DEFINITION>
	page (pageSize: number, page: number, filter?: DefinitionsFilter<DEFINITION[keyof DEFINITION]>): Promise<DefinitionsPage<DEFINITION>>
	get (hash?: number | string): Promise<DEFINITION[keyof DEFINITION] | undefined>
	links (hash?: number | string): Promise<DefinitionLinks | undefined>
	getWithLinks (hash?: number | string): Promise<DefinitionWithLinks<Exclude<DEFINITION[keyof DEFINITION], undefined>> | undefined>
}

interface InternalDefinitionsProvider<DEFINITION> extends DefinitionsProvider<DEFINITION> {
	filter (predicate: (definition: DEFINITION[keyof DEFINITION]) => boolean): Promise<DEFINITION[keyof DEFINITION][]>
}

type DefinitionsForLanguage = { [NAME in AllComponentNames]: DefinitionsProvider<DefinitionsForComponentName<NAME>> }
type Definitions = Record<string, DefinitionsForLanguage>

function Definitions (conduit: Conduit) {
	return new Proxy({} as Definitions, {
		get (target, languageName: string) {
			return target[languageName] ??= new Proxy({} as DefinitionsForLanguage, {
				get<NAME extends AllComponentNames> (target: DefinitionsForLanguage, componentName: NAME): DefinitionsProvider<DefinitionsForComponentName<NAME>> {
					return target[componentName] ??= ({
						async all (filter?: DefinitionsFilter<unknown>) {
							return await conduit._getDefinitionsComponent<NAME>(languageName, componentName, !filter ? undefined : { ...filter, evalExpression: filter?.evalExpression?.toString() })
						},
						async page (pageSize: number, page: number, filter?: DefinitionsFilter<unknown>) {
							return await conduit._getDefinitionsComponentPage<NAME>(languageName, componentName, pageSize, page, !filter ? undefined : { ...filter, evalExpression: filter?.evalExpression?.toString() })
						},
						async get (hash?: number | string) {
							return !hash ? undefined : await conduit._getDefinition<NAME>(languageName, componentName, hash)
						},
						async links (hash) {
							return !hash ? undefined : await conduit._getDefinitionLinks(languageName, componentName, hash)
						},
						async getWithLinks (hash) {
							return !hash ? undefined : await conduit._getDefinitionWithLinks<NAME>(languageName, componentName, hash)
						},
						async filter (predicate) {
							return await conduit._getDefinitionsComponent(languageName, componentName, { evalExpression: predicate.toString() }) as never
						},
					} satisfies InternalDefinitionsProvider<DefinitionsForComponentName<NAME>>) as never
				},
			})
		},
	})
}

export default Definitions
