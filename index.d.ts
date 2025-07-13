declare module "conduit.deepsight.gg/Profile" {
    export interface Profile {
        id: string;
        name: string;
        code: `${bigint}`;
    }
}
declare module "conduit.deepsight.gg/ConduitMessageRegistry" {
    import type { AuthState, CustomBungieApp } from 'conduit.deepsight.gg/Auth';
    import type { Profile } from 'conduit.deepsight.gg/Profile';
    export interface ConduitFunctionRegistry {
        getProfiles(): Profile[];
        /** @deprecated This function is for internal use and won't work otherwise */
        _getAuthState(): AuthState;
        /** @deprecated This function is for internal use and won't work otherwise */
        _setCustomApp(app?: CustomBungieApp): void;
        /** @deprecated This function is for internal use and won't work otherwise */
        _authenticate(code: string): boolean;
        /** @deprecated This function is for internal use and won't work otherwise */
        _grantAccess(origin: string, appName?: string): void;
        /** @deprecated This function is for internal use and won't work otherwise */
        _denyAccess(origin: string): void;
    }
    export interface ConduitBroadcastRegistry {
        testBroadcast: string;
    }
}
declare module "conduit.deepsight.gg/Auth" {
    export interface AccessGrant {
        appName?: string;
        origin: string;
        authTimestamp: number;
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
declare module "conduit.deepsight.gg/Inventory" {
    namespace Inventory {
        function test(): void;
    }
    export default Inventory;
}
declare module "conduit.deepsight.gg" {
    import type { ConduitFunctionRegistry } from 'conduit.deepsight.gg/ConduitMessageRegistry';
    export { default as Inventory } from "conduit.deepsight.gg/Inventory";
    interface ConduitOptions {
        service?: string;
        authOptions?: 'blank' | 'navigate' | {
            type: 'popup';
            width?: number;
            height?: number;
        };
    }
    type ConduitFunctions = {
        [KEY in keyof ConduitFunctionRegistry]: (...params: Parameters<ConduitFunctionRegistry[KEY]>) => Promise<ReturnType<ConduitFunctionRegistry[KEY]>>;
    };
    interface ConduitImplementation {
        update(): Promise<void>;
        ensureAuthenticated(appName?: string): Promise<boolean>;
    }
    interface Conduit extends Omit<ConduitFunctions, keyof ConduitImplementation>, ConduitImplementation {
    }
    function Conduit(options: ConduitOptions): Promise<Conduit>;
    export default Conduit;
}
