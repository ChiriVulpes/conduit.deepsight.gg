var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
define("conduit.deepsight.gg/Inventory", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Inventory;
    (function (Inventory) {
        function test() {
        }
        Inventory.test = test;
    })(Inventory || (Inventory = {}));
    exports.default = Inventory;
});
define("conduit.deepsight.gg", ["require", "exports", "conduit.deepsight.gg/Inventory"], function (require, exports, Inventory_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Inventory = void 0;
    Object.defineProperty(exports, "Inventory", { enumerable: true, get: function () { return __importDefault(Inventory_1).default; } });
    if (!('serviceWorker' in navigator))
        throw new Error('Service Worker is not supported in this browser');
    const loaded = new Promise(resolve => window.addEventListener('DOMContentLoaded', resolve, { once: true }));
    async function Conduit(options) {
        await loaded;
        const iframe = document.createElement('iframe');
        const serviceRoot = new URL(options.service ?? 'https://conduit.deepsight.gg');
        const serviceOrigin = serviceRoot.origin;
        iframe.src = `${serviceRoot}service`;
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        await new Promise(resolve => iframe.addEventListener('load', resolve, { once: true }));
        const messageListeners = [];
        function addListener(type, callback, once = false) {
            const expiry = !once ? undefined : Date.now() + 1000 * 60 * 2; // 2 minute expiry for once listeners
            const listener = {
                id: Math.random().toString(36).slice(2),
                type,
                callback,
                once: once ? true : undefined,
                expiry,
            };
            messageListeners.push(listener);
            return listener;
        }
        function removeListener(id) {
            const index = messageListeners.findIndex(listener => listener.id === id);
            if (index !== -1)
                messageListeners.splice(index, 1);
        }
        function addPromiseListener(type) {
            return new Promise((resolve, reject) => {
                const resolveListener = addListener(`resolve:${type}`, data => {
                    resolve(data);
                    removeListener(rejectListener.id);
                }, true);
                const rejectListener = addListener(`reject:${type}`, data => {
                    reject(data instanceof Error ? data : new Error('Promise message rejected', { cause: data }));
                    removeListener(resolveListener.id);
                }, true);
            });
        }
        function callPromiseFunction(type, ...params) {
            iframe.contentWindow?.postMessage({ type, data: params }, serviceOrigin);
            return addPromiseListener(type);
        }
        let setActive;
        const activePromise = new Promise(resolve => setActive = resolve);
        window.addEventListener('message', event => {
            if (event.source !== iframe.contentWindow)
                return;
            const data = event.data;
            if (typeof data !== 'object' || typeof data.type !== 'string') {
                console.warn('Incomprehensible message from Conduit iframe:', data);
                return;
            }
            if (data.type === '_active') {
                setActive?.();
                return;
            }
            let used = false;
            for (let i = 0; i < messageListeners.length; i++) {
                const listener = messageListeners[i];
                if (listener.type === data.type) {
                    listener.callback(data.data);
                    used = true;
                    if (listener.once) {
                        messageListeners.splice(i, 1);
                        i--;
                        continue;
                    }
                }
                if (listener.expiry && listener.expiry < Date.now()) {
                    messageListeners.splice(i, 1);
                    i--;
                }
            }
            if (used)
                return;
            console.log('Unhandled message:', data);
        });
        await activePromise;
        const implementation = {
            async update() {
                return callPromiseFunction('_update');
            },
            async ensureAuthenticated(appName) {
                let authState = await this._getAuthState();
                if (authState.authenticated && authState.accessGrants.some(grant => grant.origin === window.origin))
                    return true;
                let proxy = null;
                const authURL = `${serviceRoot}?auth=${encodeURIComponent(window.origin)}${appName ? `&app=${encodeURIComponent(appName)}` : ''}`;
                switch (options.authOptions) {
                    case 'blank':
                        proxy = window.open(authURL, '_blank');
                        break;
                    case 'navigate':
                        window.location.href = `${authURL}&redirect=${encodeURIComponent(window.location.href)}`;
                        break;
                    default: {
                        const width = options.authOptions?.width ?? 600;
                        const height = options.authOptions?.height ?? 800;
                        const screenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
                        const screenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;
                        const screenWidth = window.innerWidth ? window.innerWidth : document.documentElement.clientWidth ? document.documentElement.clientWidth : screen.width;
                        const screenHeight = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight ? document.documentElement.clientHeight : screen.height;
                        const left = ((screenWidth - width) / 2) + screenLeft;
                        const top = ((screenHeight - height) / 2) + screenTop;
                        proxy = window.open(authURL, '_blank', `width=${width},height=${height},left=${left},top=${top}`);
                        break;
                    }
                }
                if (proxy)
                    await new Promise(resolve => {
                        const interval = setInterval(() => {
                            if (proxy?.closed) {
                                clearInterval(interval);
                                resolve();
                            }
                        }, 10);
                    });
                authState = await this._getAuthState();
                return authState.authenticated && authState.accessGrants.some(grant => grant.origin === window.origin);
            },
        };
        return new Proxy(implementation, {
            get(target, fname) {
                if (fname === 'then')
                    return undefined;
                if (fname in target)
                    return target[fname];
                return (...params) => callPromiseFunction(fname, ...params);
            },
        });
    }
    exports.default = Conduit;
});
