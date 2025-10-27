import type Conduit from 'conduit.deepsight.gg/Conduit'
import type { AllComponentNames, DefinitionLinks, DefinitionsForComponentName } from 'conduit.deepsight.gg/DefinitionComponents'

interface DefinitionsProvider<DEFINITION> {
	all (): Promise<DEFINITION>
	get (hash?: number | string): Promise<DEFINITION[keyof DEFINITION] | undefined>
	links (hash?: number | string): Promise<DefinitionLinks | undefined>
	getWithLinks (hash?: number | string): Promise<{ definition: DEFINITION[keyof DEFINITION], links?: DefinitionLinks } | undefined>
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
						async all () {
							return await conduit._getDefinitionsComponent<NAME>(languageName, componentName)
						},
						async get (hash?: number | string) {
							return !hash ? undefined : await conduit._getDefinition<NAME>(languageName, componentName, hash)
						},
						async links (hash) {
							return !hash ? undefined : await conduit._getDefinitionLinks(languageName, componentName, hash)
						},
						async getWithLinks (hash) {
							if (!hash)
								return undefined

							const [definition, links] = await Promise.all([
								target[componentName].get(hash),
								target[componentName].links(hash),
							])
							if (!definition)
								return undefined

							return { definition, links }
						},
						async filter (predicate) {
							return await conduit._getFilteredDefinitionsComponent(languageName, componentName, predicate.toString()) as never
						},
					} satisfies InternalDefinitionsProvider<DefinitionsForComponentName<NAME>>) as never
				},
			})
		},
	})
}

export default Definitions
