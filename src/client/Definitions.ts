import type Conduit from 'conduit.deepsight.gg/Conduit'
import type { AllComponentNames, DefinitionsForComponentName } from 'conduit.deepsight.gg/DefinitionComponents'

interface DefinitionsProvider<DEFINITION> {
	all (): Promise<DEFINITION>
	get (hash?: number | string): Promise<DEFINITION[keyof DEFINITION] | undefined>
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
					} satisfies DefinitionsProvider<DefinitionsForComponentName<NAME>>) as never
				},
			})
		},
	})
}

export default Definitions
