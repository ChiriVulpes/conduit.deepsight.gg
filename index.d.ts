declare module "conduit.deepsight.gg/item/Item" {
    import type { DestinyAmmunitionType, DestinyClass, DestinyDamageTypeDefinition, DestinyDisplayPropertiesDefinition, DestinyEquipableItemSetDefinition, DestinySandboxPerkDefinition, DestinySocketCategoryDefinition, DestinyStatDefinition, DestinyStatGroupDefinition } from 'bungie-api-ts/destiny2';
    import type { DeepsightPlugFullName } from 'deepsight.gg/DeepsightPlugCategorisation';
    import type { ActivityHashes, DamageTypeHashes, EquipableItemSetHashes, FoundryHashes, ItemCategoryHashes, ItemTierTypeHashes, MomentHashes, SandboxPerkHashes, SocketCategoryHashes, StatHashes } from 'deepsight.gg/Enums';
    import type { ClarityDescription, DeepsightDropTableDefinition, DeepsightItemSourceDefinition, DeepsightItemSourceType, DeepsightTierTypeDefinition, DeepsightWeaponFoundryDefinition } from 'deepsight.gg/Interfaces';
    export interface ItemProvider {
        items: Record<number, Item>;
        plugs: Record<number, ItemPlug>;
        rarities: Record<ItemTierTypeHashes, DeepsightTierTypeDefinition>;
        damageTypes: Record<DamageTypeHashes, DestinyDamageTypeDefinition>;
        stats: Record<StatHashes, DestinyStatDefinition>;
        statGroups: Record<number, DestinyStatGroupDefinition>;
        ammoTypes: Record<DestinyAmmunitionType.Primary | DestinyAmmunitionType.Special | DestinyAmmunitionType.Heavy, ItemAmmo>;
        itemSets: Record<EquipableItemSetHashes, DestinyEquipableItemSetDefinition>;
        perks: Partial<Record<SandboxPerkHashes, DestinySandboxPerkDefinition>>;
        sources: Record<DeepsightItemSourceType, DeepsightItemSourceDefinition>;
        dropTables: Record<ActivityHashes, DeepsightDropTableDefinition>;
        socketCategories: Record<SocketCategoryHashes, DestinySocketCategoryDefinition>;
        foundries: Record<FoundryHashes, DeepsightWeaponFoundryDefinition>;
    }
    export interface Item {
        is: 'item';
        hash: number;
        displayProperties: DestinyDisplayPropertiesDefinition;
        momentHash?: MomentHashes;
        featured: boolean;
        sockets: ItemSocket[];
        type: string;
        rarity: ItemTierTypeHashes;
        classType?: DestinyClass;
        damageTypeHashes?: DamageTypeHashes[];
        ammoType?: DestinyAmmunitionType.Primary | DestinyAmmunitionType.Special | DestinyAmmunitionType.Heavy;
        statGroupHash?: number;
        stats?: Partial<Record<StatHashes, ItemStat>>;
        itemSetHash?: EquipableItemSetHashes;
        flavorText?: string;
        sources?: ItemSource[];
        previewImage?: string;
        foundryHash?: FoundryHashes;
        categoryHashes?: ItemCategoryHashes[];
        instanceId?: string;
        tier?: number;
    }
    export interface ItemAmmo {
        hash: DestinyAmmunitionType;
        displayProperties: DestinyDisplayPropertiesDefinition;
    }
    export interface ItemSocket {
        type: DeepsightPlugFullName;
        plugs: number[];
        defaultPlugHash?: number;
    }
    export interface ItemPlug {
        is: 'plug';
        hash: number;
        displayProperties: DestinyDisplayPropertiesDefinition;
        type: DeepsightPlugFullName;
        enhanced: boolean;
        clarity?: ClarityDescription;
        perks?: SandboxPerkHashes[];
        stats?: Partial<Record<StatHashes, ItemStat>>;
    }
    export interface ItemStat {
        hash: StatHashes;
        value: number;
        max?: number;
        displayAsNumeric?: true;
        intrinsic: number;
        roll: number;
        masterwork: number;
        mod: number;
        subclass: number;
        charge: number | number[];
    }
    export interface ItemSourceDefined {
        type: 'defined';
        id: DeepsightItemSourceType;
        eventState?: 'active' | 'upcoming' | 'unknown';
    }
    export interface ItemSourceDropTable {
        type: 'table';
        id: ActivityHashes;
    }
    export type ItemSource = ItemSourceDefined | ItemSourceDropTable;
}
declare module "conduit.deepsight.gg/item/Collections" {
    import type { InventoryBucketHashes } from 'deepsight.gg/Enums';
    import type { DeepsightMomentDefinition } from 'deepsight.gg/Interfaces';
    import type { ItemProvider } from 'conduit.deepsight.gg/item/Item';
    interface Collections extends ItemProvider {
        moments: CollectionsMoment[];
    }
    export default Collections;
    export interface CollectionsMoment {
        moment: DeepsightMomentDefinition;
        buckets: {
            [InventoryBucketHashes.KineticWeapons]: CollectionsBucket;
            [InventoryBucketHashes.EnergyWeapons]: CollectionsBucket;
            [InventoryBucketHashes.PowerWeapons]: CollectionsBucket;
            [InventoryBucketHashes.Helmet]: CollectionsBucket;
            [InventoryBucketHashes.Gauntlets]: CollectionsBucket;
            [InventoryBucketHashes.ChestArmor]: CollectionsBucket;
            [InventoryBucketHashes.LegArmor]: CollectionsBucket;
            [InventoryBucketHashes.ClassArmor]: CollectionsBucket;
        };
    }
    export interface CollectionsBucket {
        items: number[];
    }
}
declare module "conduit.deepsight.gg/Settings" {
    export interface ConduitSettings {
        verboseLogging: true | undefined;
    }
}
declare module "conduit.deepsight.gg/Profile" {
    import type { BungieMembershipType, DestinyClass, DestinyDisplayPropertiesDefinition } from 'bungie-api-ts/destiny2';
    export interface Profile {
        id: string;
        type: BungieMembershipType;
        name: string;
        code?: number;
        authed?: true;
        guardianRank?: ProfileGuardianRank;
        power: number;
        characters: ProfileCharacter[];
        emblem?: ProfileEmblem;
        classType?: DestinyClass;
        clan?: ProfileClan;
        lastUpdate: string;
        lastAccess: string;
        version: string;
    }
    export interface ProfileCharacter {
        id: string;
        classType: DestinyClass;
        emblem?: ProfileEmblem;
        power: number;
        lastPlayed: string;
    }
    export interface ProfileEmblem {
        hash: number;
        displayProperties: DestinyDisplayPropertiesDefinition;
        background: number;
        secondaryIcon: string;
        secondaryOverlay: string;
        secondarySpecial: string;
    }
    export interface ProfileClan {
        name: string;
        callsign: string;
    }
    export interface ProfileGuardianRank {
        rank: number;
        name: string;
    }
}
declare module "conduit.deepsight.gg/DefinitionComponents" {
    import type { AllDestinyManifestComponents, DestinyManifestComponentName } from 'bungie-api-ts/destiny2';
    import type { ClarityDescription } from 'conduit.deepsight.gg/Clarity';
    import type { DeepsightDefinitionLinkDefinition, DeepsightEnumDefinition, DeepsightEnumLinkDefinition, DeepsightManifestComponentsMap, DeepsightVariantDefinitionEntry } from 'deepsight.gg/Interfaces';
    export type DeepsightManifestComponentName = keyof DeepsightManifestComponentsMap;
    export interface AllClarityManifestComponents {
        ClarityDescriptions: Record<number, ClarityDescription>;
    }
    export type ClarityManifestComponentName = keyof AllClarityManifestComponents;
    export type AllComponentNames = DestinyManifestComponentName | DeepsightManifestComponentName | ClarityManifestComponentName;
    export type DefinitionsForComponentName<NAME extends AllComponentNames> = (NAME extends DestinyManifestComponentName ? AllDestinyManifestComponents[NAME] : NAME extends DeepsightManifestComponentName ? DeepsightManifestComponentsMap[NAME] : NAME extends ClarityManifestComponentName ? AllClarityManifestComponents[NAME] : never);
    export type AllDefinitions = {
        [NAME in AllComponentNames]: DefinitionsForComponentName<NAME>;
    };
    export interface DefinitionsFilter {
        nameContainsOrHashIs?: string | string[];
        deepContains?: string | string[];
        jsonPathExpression?: string | string[];
        /** @deprecated This is only available when the client page has been granted permission by the user. When no permission is granted, it does nothing. */
        evalExpression?: string;
    }
    export interface DefinitionsPage<DEFINITION> {
        definitions: Record<string | number, DEFINITION>;
        page: number;
        pageSize: number;
        totalPages: number;
        totalDefinitions: number;
    }
    export interface DefinitionReferencesPage {
        references: AllDefinitions;
        page: number;
        pageSize: number;
        totalPages: number;
        totalReferences: number;
    }
    export interface DefinitionLinks {
        augmentations?: Partial<{
            [NAME in AllComponentNames]: DefinitionsForComponentName<NAME> extends infer D ? D[keyof D] : never;
        }>;
        variants?: DeepsightVariantDefinitionEntry[];
        links?: (DeepsightDefinitionLinkDefinition | DeepsightEnumLinkDefinition)[];
        definitions?: Partial<{
            [NAME in AllComponentNames]: DefinitionsForComponentName<NAME>;
        }>;
        enums?: Partial<Record<string, DeepsightEnumDefinition>>;
    }
    export interface DefinitionWithLinks<DEFINITION> {
        definition: DEFINITION;
        links?: DefinitionLinks;
    }
}
declare module "conduit.deepsight.gg/ConduitState" {
    interface ConduitState {
        version: {
            combined: string;
            destiny: string;
            deepsight: string;
            clarity: string;
            updated: boolean;
        };
        authed: boolean;
        profiles: number;
    }
    export default ConduitState;
}
declare module "conduit.deepsight.gg/ConduitMessageRegistry" {
    import type { AuthState, CustomBungieApp } from 'conduit.deepsight.gg/Auth';
    import type ConduitState from 'conduit.deepsight.gg/ConduitState';
    import type { AllComponentNames, DefinitionLinks, DefinitionReferencesPage, DefinitionsFilter, DefinitionsForComponentName, DefinitionsPage, DefinitionWithLinks } from 'conduit.deepsight.gg/DefinitionComponents';
    import type Collections from 'conduit.deepsight.gg/item/Collections';
    import type { Profile } from 'conduit.deepsight.gg/Profile';
    import type { ConduitSettings } from 'conduit.deepsight.gg/Settings';
    export interface ConduitFunctionRegistry {
        getProfiles(): Promise<Profile[]>;
        updateProfiles(): Promise<void>;
        getProfile(displayName: string, displayNameCode: number): Promise<Profile | undefined>;
        bumpProfile(displayName: string, displayNameCode: number): Promise<void>;
        getCollections(): Promise<Collections>;
        getComponentNames(): Promise<AllComponentNames[]>;
        /**
         * Get the current state of conduit — defs versions, profiles, etc.
         *
         * Only checks if defs versions have updated if the cache is old enough.
         * Returns `version.updated: true` if there's been a defs update.
         */
        getState(): Promise<ConduitState>;
        /** Perform a hard defs update check, ignoring how recently they were cached */
        checkUpdate(): Promise<ConduitState>;
    }
    export interface ConduitBroadcastRegistry {
        ready: void;
        profilesUpdated: Profile[];
        _updateSettings: void;
    }
}
declare module "conduit.deepsight.gg/Clarity" {
    export interface ClarityDescriptionTextComponent {
        text: string;
        title?: string | ClarityDescriptionComponent[];
        linesContent?: undefined;
        table?: undefined;
        classNames?: string[];
        formula?: string;
    }
    export interface ClarityDescriptionLineComponent {
        text?: undefined;
        title?: string | ClarityDescriptionComponent[];
        linesContent: ClarityDescriptionComponent[];
        table?: undefined;
        classNames?: string[];
        formula?: undefined;
    }
    export interface ClarityDescriptionTableCell {
        cellContent: string | ClarityDescriptionComponent[];
        classNames?: string[];
        title?: string | ClarityDescriptionComponent[];
    }
    export interface ClarityDescriptionTableRow {
        rowContent: ClarityDescriptionTableCell[];
        classNames?: string[];
        title?: string | ClarityDescriptionComponent[];
    }
    export interface ClarityDescriptionTableComponent {
        text?: undefined;
        linesContent?: undefined;
        table: ClarityDescriptionTableRow[];
        classNames?: string[];
        isFormula: boolean;
        formula?: undefined;
        title?: undefined;
    }
    export interface ClarityDescriptionStatValues {
        stat?: number[];
        multiplier?: number[];
    }
    export interface ClarityDescriptionStat {
        active?: ClarityDescriptionStatValues;
        passive?: ClarityDescriptionStatValues;
        weaponTypes?: string[];
    }
    export type ClarityDescriptionComponent = ClarityDescriptionTextComponent | ClarityDescriptionLineComponent | ClarityDescriptionTableComponent;
    export interface ClarityDescription {
        hash: number;
        name: string;
        itemHash?: number;
        itemName?: string;
        lastUpload: number;
        stats?: Record<string, ClarityDescriptionStat[]>;
        type: string;
        uploadedBy: string;
        descriptions: Record<string, string | ClarityDescriptionComponent[]>;
    }
}
declare module "conduit.deepsight.gg/Auth" {
    export interface AccessGrant {
        appName?: string;
        origin: string;
        authTimestamp: number;
        fullTrust?: true;
    }
    export interface CustomBungieApp {
        apiKey: string;
        clientId: string;
        clientSecret: string;
    }
    export interface AuthState {
        authenticated: boolean;
        accessGrants: AccessGrant[];
        bungieAuthURL: string;
        customApp?: CustomBungieApp;
    }
}
declare module "conduit.deepsight.gg/Definitions" {
    import type Conduit from "conduit.deepsight.gg/Conduit";
    import type { AllComponentNames, DefinitionLinks, DefinitionReferencesPage, DefinitionsFilter as DefinitionsFilterSerialised, DefinitionsForComponentName, DefinitionsPage, DefinitionWithLinks } from 'conduit.deepsight.gg/DefinitionComponents';
    export interface DefinitionsFilter<DEFINITION> extends Omit<DefinitionsFilterSerialised, 'evalExpression'> {
        /** @deprecated This is only available when the client page has been granted permission by the user. When no permission is granted, it does nothing. */
        evalExpression?(def: DEFINITION): unknown;
    }
    interface DefinitionsProvider<DEFINITION> {
        all(filter?: DefinitionsFilter<DEFINITION[keyof DEFINITION]>): Promise<DEFINITION>;
        page(pageSize: number, page: number, filter?: DefinitionsFilter<DEFINITION[keyof DEFINITION]>): Promise<DefinitionsPage<DEFINITION>>;
        get(hash?: number | string): Promise<DEFINITION[keyof DEFINITION] | undefined>;
        links(hash?: number | string): Promise<DefinitionLinks | undefined>;
        getWithLinks(hash?: number | string): Promise<DefinitionWithLinks<Exclude<DEFINITION[keyof DEFINITION], undefined>> | undefined>;
        getReferencing(hash: number | string | undefined, pageSize: number, page: number): Promise<DefinitionReferencesPage | undefined>;
    }
    type DefinitionsForLanguage = {
        [NAME in AllComponentNames]: DefinitionsProvider<DefinitionsForComponentName<NAME>>;
    };
    type Definitions = Record<string, DefinitionsForLanguage>;
    function Definitions(conduit: Conduit): Definitions;
    export default Definitions;
}
declare module "conduit.deepsight.gg/Inventory" {
    namespace Inventory {
        function test(): void;
    }
    export default Inventory;
}
declare module "conduit.deepsight.gg" {
    import type { ConduitBroadcastRegistry, ConduitFunctionRegistry } from 'conduit.deepsight.gg/ConduitMessageRegistry';
    import Definitions from "conduit.deepsight.gg/Definitions";
    export { default as Inventory } from "conduit.deepsight.gg/Inventory";
    interface ConduitOptions {
        service?: string;
        authOptions?: 'blank' | 'navigate' | {
            type: 'popup';
            width?: number;
            height?: number;
        };
    }
    export type Unsubscribe = () => void;
    interface ConduitImplementation {
        on: {
            [TYPE in keyof ConduitBroadcastRegistry]: (handler: (data: ConduitBroadcastRegistry[TYPE]) => unknown) => Unsubscribe;
        };
        readonly definitions: Definitions;
        update(): Promise<void>;
        ensureAuthenticated(appName?: string): Promise<boolean>;
    }
    interface Conduit extends ConduitFunctionRegistry, ConduitImplementation {
    }
    function Conduit(options: ConduitOptions): Promise<Conduit>;
    export default Conduit;
}
