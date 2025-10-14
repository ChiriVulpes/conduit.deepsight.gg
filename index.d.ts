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
    import type { DeepsightManifestComponentsMap } from 'deepsight.gg/Interfaces';
    export type DeepsightManifestComponentName = keyof DeepsightManifestComponentsMap;
    export interface AllClarityManifestComponents {
        ClarityDescriptions: Record<number, ClarityDescription>;
    }
    export type ClarityManifestComponentName = keyof AllClarityManifestComponents;
    export type AllComponentNames = DestinyManifestComponentName | DeepsightManifestComponentName | ClarityManifestComponentName;
    export type DefinitionsForComponentName<NAME extends AllComponentNames> = (NAME extends DestinyManifestComponentName ? AllDestinyManifestComponents[NAME] : NAME extends DeepsightManifestComponentName ? DeepsightManifestComponentsMap[NAME] : NAME extends ClarityManifestComponentName ? AllClarityManifestComponents[NAME] : never);
}
declare module "conduit.deepsight.gg/ConduitMessageRegistry" {
    import type { AuthState, CustomBungieApp } from 'conduit.deepsight.gg/Auth';
    import type Collections from 'conduit.deepsight.gg/Collections';
    import type { AllComponentNames, DefinitionsForComponentName } from 'conduit.deepsight.gg/DefinitionComponents';
    import type { Profile } from 'conduit.deepsight.gg/Profile';
    export interface ConduitFunctionRegistry {
        getProfiles(): Promise<Profile[]>;
        updateProfiles(): Promise<void>;
        getProfile(displayName: string, displayNameCode: number): Promise<Profile | undefined>;
        bumpProfile(displayName: string, displayNameCode: number): Promise<void>;
        getCollections(): Promise<Collections>;
        getComponentNames(): Promise<AllComponentNames[]>;
    }
    export interface ConduitBroadcastRegistry {
        ready: void;
        profilesUpdated: Profile[];
    }
}
declare module "conduit.deepsight.gg/Collections" {
    import type { DestinyAmmunitionType, DestinyClass, DestinyDamageTypeDefinition, DestinyDisplayPropertiesDefinition, DestinyEquipableItemSetDefinition, DestinySandboxPerkDefinition, DestinyStatDefinition, DestinyStatGroupDefinition } from 'bungie-api-ts/destiny2';
    import type { DeepsightPlugFullName } from 'deepsight.gg/DeepsightPlugCategorisation';
    import type { ActivityHashes, DamageTypeHashes, EquipableItemSetHashes, InventoryBucketHashes, ItemCategoryHashes, ItemTierTypeHashes, SandboxPerkHashes, StatHashes } from 'deepsight.gg/Enums';
    import type { ClarityDescription, DeepsightDropTableDefinition, DeepsightItemSourceDefinition, DeepsightItemSourceType, DeepsightMomentDefinition, DeepsightTierTypeDefinition } from 'deepsight.gg/Interfaces';
    interface Collections {
        moments: CollectionsMoment[];
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
        dropTables: Record<string, DeepsightDropTableDefinition>;
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
    export interface Item {
        is: 'item';
        hash: number;
        displayProperties: DestinyDisplayPropertiesDefinition;
        watermark: string;
        featuredWatermark?: string;
        sockets: ItemSocket[];
        type: string;
        rarity: ItemTierTypeHashes;
        class?: DestinyClass;
        damageTypes?: DamageTypeHashes[];
        ammo?: DestinyAmmunitionType.Primary | DestinyAmmunitionType.Special | DestinyAmmunitionType.Heavy;
        statGroupHash?: number;
        stats?: Partial<Record<StatHashes, ItemStat>>;
        itemSetHash?: EquipableItemSetHashes;
        flavorText?: string;
        sources?: ItemSource[];
        previewImage?: string;
        foundryImage?: string;
        categories?: ItemCategoryHashes[];
        instanceId?: string;
        tier?: number;
    }
    export interface ItemAmmo {
        hash: DestinyAmmunitionType;
        displayProperties: DestinyDisplayPropertiesDefinition;
    }
    export interface ItemArchetype {
        hash: number;
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
    }
    export interface ItemSourceDropTable {
        type: 'table';
        id: ActivityHashes;
    }
    export type ItemSource = ItemSourceDefined | ItemSourceDropTable;
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
    import type { AllComponentNames, DefinitionsForComponentName } from 'conduit.deepsight.gg/DefinitionComponents';
    interface DefinitionsProvider<DEFINITION> {
        all(): Promise<DEFINITION>;
        get(hash?: number | string): Promise<DEFINITION[keyof DEFINITION] | undefined>;
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
