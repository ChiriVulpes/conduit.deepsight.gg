"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
(() => {
    const baseURL = self.document?.currentScript?.dataset.baseUrl;
    /**
     * @enum {number}
     */
    const ModuleState = {
        Unprocessed: 0,
        Waiting: 1,
        Processed: 2,
        Error: 3,
    };
    /**
     * @typedef {(module: string) => any} ModuleGetter
     */
    /**
     * @typedef {(modules: string[], resolve: (module: any) => void, reject: (err?: any) => any) => void} ModuleGetterAsync
     */
    /**
     * @typedef {(getModule: ModuleGetter | ModuleGetterAsync, module: Module, ...args: any[]) => any} ModuleInitializer
     */
    /**
     * @typedef {Object} Module
     * @property {true} __esModule - Indicates that this module is an ES module.
     * @property {string} _name - The name of the module.
     * @property {ModuleState} _state - The current state of the module.
     * @property {string[]} _requirements - An array of module names that this module depends on.
     * @property {ModuleInitializer} _initializer - The function that initializes the module.
     * @property {Error} [_error] - An error that occurred during module initialization, if any.
     * @property {boolean} _init - Whether the module should be initialized immediately.
     * @property {true} [_allowRedefine] - Whether the module can be redefined.
     * @property {(module: Module) => void} _replace - A function to replace the module
     * @property {(nameOrNames: string | string[], resolve?: (module: any) => void, reject?: (err?: any) => void) => void | Module} [require] - A function to require other modules.
     * @property {any} [default] - The default export of the module.
     */
    /**
     * @type {Map<string, Module>}
     */
    const moduleMap = new Map();
    /**
     * @type {Set<string>}
     */
    const requirements = new Set();
    /** @type {string | undefined} */
    let nextName;
    /**
     * @param {string | string[]} name
     * @param {string[] | ModuleInitializer} reqs
     * @param {ModuleInitializer?} fn
     */
    function define(name, reqs, fn) {
        if (typeof name === 'function' && !nextName)
            throw new Error('Cannot define module without a name');
        if (typeof name === 'function')
            fn = name, name = /** @type {string} */ (nextName), nextName = undefined;
        if (Array.isArray(name)) {
            fn = /** @type {ModuleInitializer} */ (reqs);
            reqs = name;
            if (nextName) {
                name = nextName;
                nextName = undefined;
            }
            else {
                const src = self.document?.currentScript?.getAttribute('src') || self.document?.currentScript?.getAttribute('data-src');
                if (!src)
                    throw new Error('Cannot define module without a name');
                name = src.startsWith('./') ? src.slice(2)
                    : src.startsWith('/') ? src.slice(1)
                        : src.startsWith(`${location.origin}/`) ? src.slice(location.origin.length + 1)
                            : src;
                const qIndex = name.indexOf('?');
                name = qIndex === -1 ? name : name.slice(0, qIndex);
                name = baseURL && name.startsWith(baseURL) ? name.slice(baseURL.length) : name;
                name = name.endsWith('.js') ? name.slice(0, -3) : name;
                name = name.endsWith('/index') ? name.slice(0, -6) : name;
            }
        }
        reqs ??= [];
        const existingDefinition = moduleMap.get(name);
        if (existingDefinition && !existingDefinition._allowRedefine)
            throw new Error(`Module "${name}" cannot be redefined`);
        if (typeof reqs === 'function') {
            if (fn)
                throw new Error('Unsupport define call');
            fn = reqs;
            reqs = [];
        }
        if (reqs.length < 2 || reqs[0] !== 'require' || reqs[1] !== 'exports') {
            if (reqs.length === 1 && reqs[0] === 'exports') {
                reqs = ['require', 'exports'];
                const oldfn = fn;
                fn = (req, exp) => oldfn(exp);
            }
        }
        const _requirements = reqs.slice(2).map(req => findModuleName(name, req));
        const initialiser = /** @type {ModuleInitializer} */ (fn);
        /**
         * @type {Module}
         */
        const module = {
            __esModule: true,
            _name: name,
            _state: ModuleState.Unprocessed,
            _requirements,
            _initializer: initialiser,
            _init: self.document?.currentScript?.dataset.init === name,
            _replace(newModule) {
                if (typeof newModule !== 'object' && typeof newModule !== 'function')
                    throw new Error('Cannot assign module.exports to a non-object');
                newModule._name = name;
                newModule._state = ModuleState.Unprocessed;
                newModule._requirements = _requirements;
                newModule._initializer = initialiser;
                newModule._replace = module._replace;
                moduleMap.set(name, newModule);
            },
        };
        moduleMap.set(name, module);
        for (const req of module._requirements)
            requirements.add(req);
        const preload = name.endsWith('$preload');
        if (preload) {
            if (module._requirements.length)
                throw new Error(`Module "${name}" cannot import other modules`);
            initializeModule(module);
        }
        if (initialProcessCompleted)
            processModules();
    }
    define.amd = true;
    define.nameNext = function (name) {
        nextName = name;
    };
    /**
     * @param {string} name
     */
    function allowRedefine(name) {
        const module = moduleMap.get(name);
        if (!module)
            return;
        module._allowRedefine = true;
    }
    /**
     * @param {string} name
     * @param {string[]} [requiredBy]
     */
    function getModule(name, requiredBy) {
        requiredBy ??= [];
        let module = moduleMap.get(name);
        if (!module) {
            if (name.endsWith('.js'))
                name = name.slice(0, -3);
            if (name.startsWith('.')) {
                let from = requiredBy[requiredBy.length - 1];
                if (!from.includes('/'))
                    from += '/';
                name = findModuleName(from, name);
            }
            module = moduleMap.get(name);
            if (!module)
                throw new Error(`Module "${name}" has not been declared and cannot be required`);
        }
        if (module._state === ModuleState.Unprocessed)
            module = processModule(name, module, requiredBy);
        return module;
    }
    /**
     * @param {string} name
     */
    function initializeModuleByName(name) {
        const module = getModule(name);
        if (!module)
            throw new Error(`Module "${name}" has not been declared and cannot be initialized`);
        initializeModule(module);
    }
    /**
     * @param {Module} module
     * @param {string[]} [requiredBy]
     * @param {...any} args
     */
    function initializeModule(module, requiredBy, ...args) {
        if (module._state)
            throw new Error(`Module "${module._name}" has already been processed`);
        requiredBy ??= [];
        try {
            requiredBy = [...requiredBy, module._name];
            /**
             * @param {string | string[]} nameOrNames
             * @param {(module: any) => void} [resolve]
             * @param {(err?: any) => void} [reject]
             */
            function require(nameOrNames, resolve, reject) {
                if (Array.isArray(nameOrNames)) {
                    const results = nameOrNames.map(name => getModule(name, requiredBy));
                    return resolve?.(results.length === 1 ? results[0] : results);
                }
                return getModule(nameOrNames, requiredBy);
            }
            module.require = require;
            const oldModuleName = extensibleSelf.__moduleName;
            extensibleSelf.__moduleName = module._name;
            const result = module._initializer(require, module, ...args);
            if (extensibleSelf.__moduleName === module._name)
                extensibleSelf.__moduleName = oldModuleName;
            if (module.default === undefined) {
                module.default = result ?? module;
                module.__esModule = true;
            }
            const mapCopy = moduleMap.get(module._name);
            if (!mapCopy)
                throw new Error(`Module "${module._name}" has not been defined or has been removed during initialization`);
            module = mapCopy;
            module._state = ModuleState.Processed;
            injectModule(module);
        }
        catch (err) {
            module._state = ModuleState.Error;
            module._error = err;
            err.message = `[Module initialization ${module._name}] ${err.message}`;
            console.error(err);
        }
    }
    const isInjectableModuleDefaultNameRegex = /^[A-Z_$][a-zA-Z_$0-9]+$/;
    function injectModule(module) {
        const name = module._name;
        const inject = module.default ?? module;
        const moduleDefaultName = basename(name);
        if (isInjectableModuleDefaultNameRegex.test(moduleDefaultName) && !(moduleDefaultName in self))
            Object.assign(self, { [moduleDefaultName]: inject });
        for (const key of Object.keys(module)) {
            if (key !== 'default' && !key.startsWith('_') && isInjectableModuleDefaultNameRegex.test(key) && !(key in self)) {
                Object.assign(self, { [key]: module[key] });
            }
        }
    }
    ////////////////////////////////////
    // Add the above functions to "self"
    //
    /**
     * @typedef {Object} SelfExtensions
     * @property {typeof define} define
     * @property {typeof getModule} getModule
     * @property {typeof initializeModuleByName} initializeModule
     * @property {(name: string) => boolean} hasModule
     * @property {typeof allowRedefine} allowRedefine
     * @property {string | undefined} __moduleName
     */
    const extensibleSelf = /** @type {Window & typeof globalThis & SelfExtensions} */ (self);
    extensibleSelf.define = define;
    extensibleSelf.getModule = getModule;
    extensibleSelf.initializeModule = initializeModuleByName;
    extensibleSelf.allowRedefine = allowRedefine;
    extensibleSelf.hasModule = name => moduleMap.has(name);
    ////////////////////////////////////
    // Actually process the modules
    //
    self.document?.addEventListener('DOMContentLoaded', processModules);
    let initialProcessCompleted = false;
    async function processModules() {
        const scriptsStillToImport = Array.from(self.document?.querySelectorAll('template[data-script]') ?? [])
            .map(definition => {
            const script = /** @type {HTMLTemplateElement} */ (definition).dataset.script;
            definition.remove();
            return script;
        });
        await Promise.all(Array.from(new Set(scriptsStillToImport))
            .filter(v => v !== undefined)
            .map(tryImportAdditionalModule));
        while (requirements.size) {
            const remainingRequirements = Array.from(requirements);
            await Promise.all(remainingRequirements.map(tryImportAdditionalModule));
            for (const req of remainingRequirements)
                requirements.delete(req);
        }
        for (const [name, module] of moduleMap.entries())
            if (module._init)
                processModule(name, module);
        initialProcessCompleted = true;
    }
    /**
     * @param {string} req
     */
    async function tryImportAdditionalModule(req) {
        if (moduleMap.has(req))
            return;
        await importAdditionalModule(req);
        if (!moduleMap.has(req))
            throw new Error(`The required module '${req}' could not be asynchronously loaded.`);
    }
    /**
     * @param {string} req
     */
    async function importAdditionalModule(req) {
        if (self.document) {
            const script = document.createElement('script');
            document.head.appendChild(script);
            /** @type {Promise<void>} */
            const promise = new Promise(resolve => script.addEventListener('load', () => resolve()));
            script.src = `/script/${req}.js`;
            return promise;
        }
        else {
            self.importScripts(`/script/${req}.js`);
        }
    }
    /**
     * @param {string} name
     * @param {Module | undefined} module
     * @param {string[]} requiredBy
     */
    function processModule(name, module = moduleMap.get(name), requiredBy = []) {
        if (!module)
            throw new Error(`No "${name}" module defined`);
        if (module._state === ModuleState.Waiting)
            throw new Error(`Circular dependency! Dependency chain: ${[...requiredBy, name].map(m => `"${m}"`).join(' > ')}`);
        if (!module._state) {
            module._state = ModuleState.Waiting;
            const args = module._requirements
                .map(req => processModule(req, undefined, [...requiredBy, name]));
            module._state = ModuleState.Unprocessed;
            initializeModule(module, requiredBy, ...args);
        }
        return moduleMap.get(name);
    }
    ////////////////////////////////////
    // Utils
    //
    /**
     * @param {string} name
     * @param {string} requirement
     */
    function findModuleName(name, requirement) {
        let root = dirname(name);
        if (requirement.startsWith('./'))
            return join(root, requirement.slice(2));
        while (requirement.startsWith('../'))
            root = dirname(root), requirement = requirement.slice(3);
        return requirement; // join(root, requirement);
    }
    /**
     * @param {string} name
     */
    function dirname(name) {
        const lastIndex = name.lastIndexOf('/');
        return lastIndex === -1 ? '' : name.slice(0, lastIndex);
    }
    /**
     * @param {string} name
     */
    function basename(name) {
        const lastIndex = name.lastIndexOf('/');
        return name.slice(lastIndex + 1);
    }
    /**
     * @param  {...string} path
     */
    function join(...path) {
        return path.filter(p => p).join('/');
    }
})();
define.nameNext('dexie');
(function (e, t) { "object" == typeof exports && "undefined" != typeof module ? module.exports = t() : "function" == typeof define && define.amd ? define(t) : (e = "undefined" != typeof globalThis ? globalThis : e || self).Dexie = t(); })(this, function () {
    "use strict";
    var s = function (e, t) { return (s = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function (e, t) { e.__proto__ = t; } || function (e, t) { for (var n in t)
        Object.prototype.hasOwnProperty.call(t, n) && (e[n] = t[n]); })(e, t); };
    var _ = function () { return (_ = Object.assign || function (e) { for (var t, n = 1, r = arguments.length; n < r; n++)
        for (var i in t = arguments[n])
            Object.prototype.hasOwnProperty.call(t, i) && (e[i] = t[i]); return e; }).apply(this, arguments); };
    function i(e, t, n) { if (n || 2 === arguments.length)
        for (var r, i = 0, o = t.length; i < o; i++)
            !r && i in t || ((r = r || Array.prototype.slice.call(t, 0, i))[i] = t[i]); return e.concat(r || Array.prototype.slice.call(t)); }
    var f = "undefined" != typeof globalThis ? globalThis : "undefined" != typeof self ? self : "undefined" != typeof window ? window : global, x = Object.keys, k = Array.isArray;
    function a(t, n) { return "object" != typeof n || x(n).forEach(function (e) { t[e] = n[e]; }), t; }
    "undefined" == typeof Promise || f.Promise || (f.Promise = Promise);
    var c = Object.getPrototypeOf, n = {}.hasOwnProperty;
    function m(e, t) { return n.call(e, t); }
    function r(t, n) { "function" == typeof n && (n = n(c(t))), ("undefined" == typeof Reflect ? x : Reflect.ownKeys)(n).forEach(function (e) { l(t, e, n[e]); }); }
    var u = Object.defineProperty;
    function l(e, t, n, r) { u(e, t, a(n && m(n, "get") && "function" == typeof n.get ? { get: n.get, set: n.set, configurable: !0 } : { value: n, configurable: !0, writable: !0 }, r)); }
    function o(t) { return { from: function (e) { return t.prototype = Object.create(e.prototype), l(t.prototype, "constructor", t), { extend: r.bind(null, t.prototype) }; } }; }
    var h = Object.getOwnPropertyDescriptor;
    var d = [].slice;
    function b(e, t, n) { return d.call(e, t, n); }
    function p(e, t) { return t(e); }
    function y(e) { if (!e)
        throw new Error("Assertion Failed"); }
    function v(e) { f.setImmediate ? setImmediate(e) : setTimeout(e, 0); }
    function O(e, t) { if ("string" == typeof t && m(e, t))
        return e[t]; if (!t)
        return e; if ("string" != typeof t) {
        for (var n = [], r = 0, i = t.length; r < i; ++r) {
            var o = O(e, t[r]);
            n.push(o);
        }
        return n;
    } var a = t.indexOf("."); if (-1 !== a) {
        var u = e[t.substr(0, a)];
        return null == u ? void 0 : O(u, t.substr(a + 1));
    } }
    function P(e, t, n) { if (e && void 0 !== t && !("isFrozen" in Object && Object.isFrozen(e)))
        if ("string" != typeof t && "length" in t) {
            y("string" != typeof n && "length" in n);
            for (var r = 0, i = t.length; r < i; ++r)
                P(e, t[r], n[r]);
        }
        else {
            var o, a, u = t.indexOf(".");
            -1 !== u ? (o = t.substr(0, u), "" === (a = t.substr(u + 1)) ? void 0 === n ? k(e) && !isNaN(parseInt(o)) ? e.splice(o, 1) : delete e[o] : e[o] = n : P(u = !(u = e[o]) || !m(e, o) ? e[o] = {} : u, a, n)) : void 0 === n ? k(e) && !isNaN(parseInt(t)) ? e.splice(t, 1) : delete e[t] : e[t] = n;
        } }
    function g(e) { var t, n = {}; for (t in e)
        m(e, t) && (n[t] = e[t]); return n; }
    var t = [].concat;
    function w(e) { return t.apply([], e); }
    var e = "BigUint64Array,BigInt64Array,Array,Boolean,String,Date,RegExp,Blob,File,FileList,FileSystemFileHandle,FileSystemDirectoryHandle,ArrayBuffer,DataView,Uint8ClampedArray,ImageBitmap,ImageData,Map,Set,CryptoKey".split(",").concat(w([8, 16, 32, 64].map(function (t) { return ["Int", "Uint", "Float"].map(function (e) { return e + t + "Array"; }); }))).filter(function (e) { return f[e]; }), K = new Set(e.map(function (e) { return f[e]; }));
    var E = null;
    function S(e) { E = new WeakMap; e = function e(t) { if (!t || "object" != typeof t)
        return t; var n = E.get(t); if (n)
        return n; if (k(t)) {
        n = [], E.set(t, n);
        for (var r = 0, i = t.length; r < i; ++r)
            n.push(e(t[r]));
    }
    else if (K.has(t.constructor))
        n = t;
    else {
        var o, a = c(t);
        for (o in n = a === Object.prototype ? {} : Object.create(a), E.set(t, n), t)
            m(t, o) && (n[o] = e(t[o]));
    } return n; }(e); return E = null, e; }
    var j = {}.toString;
    function A(e) { return j.call(e).slice(8, -1); }
    var C = "undefined" != typeof Symbol ? Symbol.iterator : "@@iterator", T = "symbol" == typeof C ? function (e) { var t; return null != e && (t = e[C]) && t.apply(e); } : function () { return null; };
    function q(e, t) { t = e.indexOf(t); return 0 <= t && e.splice(t, 1), 0 <= t; }
    var D = {};
    function I(e) { var t, n, r, i; if (1 === arguments.length) {
        if (k(e))
            return e.slice();
        if (this === D && "string" == typeof e)
            return [e];
        if (i = T(e)) {
            for (n = []; !(r = i.next()).done;)
                n.push(r.value);
            return n;
        }
        if (null == e)
            return [e];
        if ("number" != typeof (t = e.length))
            return [e];
        for (n = new Array(t); t--;)
            n[t] = e[t];
        return n;
    } for (t = arguments.length, n = new Array(t); t--;)
        n[t] = arguments[t]; return n; }
    var B = "undefined" != typeof Symbol ? function (e) { return "AsyncFunction" === e[Symbol.toStringTag]; } : function () { return !1; }, R = ["Unknown", "Constraint", "Data", "TransactionInactive", "ReadOnly", "Version", "NotFound", "InvalidState", "InvalidAccess", "Abort", "Timeout", "QuotaExceeded", "Syntax", "DataClone"], F = ["Modify", "Bulk", "OpenFailed", "VersionChange", "Schema", "Upgrade", "InvalidTable", "MissingAPI", "NoSuchDatabase", "InvalidArgument", "SubTransaction", "Unsupported", "Internal", "DatabaseClosed", "PrematureCommit", "ForeignAwait"].concat(R), M = { VersionChanged: "Database version changed by other database connection", DatabaseClosed: "Database has been closed", Abort: "Transaction aborted", TransactionInactive: "Transaction has already completed or failed", MissingAPI: "IndexedDB API missing. Please visit https://tinyurl.com/y2uuvskb" };
    function N(e, t) { this.name = e, this.message = t; }
    function L(e, t) { return e + ". Errors: " + Object.keys(t).map(function (e) { return t[e].toString(); }).filter(function (e, t, n) { return n.indexOf(e) === t; }).join("\n"); }
    function U(e, t, n, r) { this.failures = t, this.failedKeys = r, this.successCount = n, this.message = L(e, t); }
    function V(e, t) { this.name = "BulkError", this.failures = Object.keys(t).map(function (e) { return t[e]; }), this.failuresByPos = t, this.message = L(e, this.failures); }
    o(N).from(Error).extend({ toString: function () { return this.name + ": " + this.message; } }), o(U).from(N), o(V).from(N);
    var z = F.reduce(function (e, t) { return e[t] = t + "Error", e; }, {}), W = N, Y = F.reduce(function (e, n) { var r = n + "Error"; function t(e, t) { this.name = r, e ? "string" == typeof e ? (this.message = "".concat(e).concat(t ? "\n " + t : ""), this.inner = t || null) : "object" == typeof e && (this.message = "".concat(e.name, " ").concat(e.message), this.inner = e) : (this.message = M[n] || r, this.inner = null); } return o(t).from(W), e[n] = t, e; }, {});
    Y.Syntax = SyntaxError, Y.Type = TypeError, Y.Range = RangeError;
    var $ = R.reduce(function (e, t) { return e[t + "Error"] = Y[t], e; }, {});
    var Q = F.reduce(function (e, t) { return -1 === ["Syntax", "Type", "Range"].indexOf(t) && (e[t + "Error"] = Y[t]), e; }, {});
    function G() { }
    function X(e) { return e; }
    function H(t, n) { return null == t || t === X ? n : function (e) { return n(t(e)); }; }
    function J(e, t) { return function () { e.apply(this, arguments), t.apply(this, arguments); }; }
    function Z(i, o) { return i === G ? o : function () { var e = i.apply(this, arguments); void 0 !== e && (arguments[0] = e); var t = this.onsuccess, n = this.onerror; this.onsuccess = null, this.onerror = null; var r = o.apply(this, arguments); return t && (this.onsuccess = this.onsuccess ? J(t, this.onsuccess) : t), n && (this.onerror = this.onerror ? J(n, this.onerror) : n), void 0 !== r ? r : e; }; }
    function ee(n, r) { return n === G ? r : function () { n.apply(this, arguments); var e = this.onsuccess, t = this.onerror; this.onsuccess = this.onerror = null, r.apply(this, arguments), e && (this.onsuccess = this.onsuccess ? J(e, this.onsuccess) : e), t && (this.onerror = this.onerror ? J(t, this.onerror) : t); }; }
    function te(i, o) { return i === G ? o : function (e) { var t = i.apply(this, arguments); a(e, t); var n = this.onsuccess, r = this.onerror; this.onsuccess = null, this.onerror = null; e = o.apply(this, arguments); return n && (this.onsuccess = this.onsuccess ? J(n, this.onsuccess) : n), r && (this.onerror = this.onerror ? J(r, this.onerror) : r), void 0 === t ? void 0 === e ? void 0 : e : a(t, e); }; }
    function ne(e, t) { return e === G ? t : function () { return !1 !== t.apply(this, arguments) && e.apply(this, arguments); }; }
    function re(i, o) { return i === G ? o : function () { var e = i.apply(this, arguments); if (e && "function" == typeof e.then) {
        for (var t = this, n = arguments.length, r = new Array(n); n--;)
            r[n] = arguments[n];
        return e.then(function () { return o.apply(t, r); });
    } return o.apply(this, arguments); }; }
    Q.ModifyError = U, Q.DexieError = N, Q.BulkError = V;
    var ie = "undefined" != typeof location && /^(http|https):\/\/(localhost|127\.0\.0\.1)/.test(location.href);
    function oe(e) { ie = e; }
    var ae = {}, ue = 100, e = "undefined" == typeof Promise ? [] : function () { var e = Promise.resolve(); if ("undefined" == typeof crypto || !crypto.subtle)
        return [e, c(e), e]; var t = crypto.subtle.digest("SHA-512", new Uint8Array([0])); return [t, c(t), e]; }(), R = e[0], F = e[1], e = e[2], F = F && F.then, se = R && R.constructor, ce = !!e;
    var le = function (e, t) { be.push([e, t]), he && (queueMicrotask(Se), he = !1); }, fe = !0, he = !0, de = [], pe = [], ye = X, ve = { id: "global", global: !0, ref: 0, unhandleds: [], onunhandled: G, pgp: !1, env: {}, finalize: G }, me = ve, be = [], ge = 0, we = [];
    function _e(e) { if ("object" != typeof this)
        throw new TypeError("Promises must be constructed via new"); this._listeners = [], this._lib = !1; var t = this._PSD = me; if ("function" != typeof e) {
        if (e !== ae)
            throw new TypeError("Not a function");
        return this._state = arguments[1], this._value = arguments[2], void (!1 === this._state && Oe(this, this._value));
    } this._state = null, this._value = null, ++t.ref, function t(r, e) { try {
        e(function (n) { if (null === r._state) {
            if (n === r)
                throw new TypeError("A promise cannot be resolved with itself.");
            var e = r._lib && je();
            n && "function" == typeof n.then ? t(r, function (e, t) { n instanceof _e ? n._then(e, t) : n.then(e, t); }) : (r._state = !0, r._value = n, Pe(r)), e && Ae();
        } }, Oe.bind(null, r));
    }
    catch (e) {
        Oe(r, e);
    } }(this, e); }
    var xe = { get: function () { var u = me, t = Fe; function e(n, r) { var i = this, o = !u.global && (u !== me || t !== Fe), a = o && !Ue(), e = new _e(function (e, t) { Ke(i, new ke(Qe(n, u, o, a), Qe(r, u, o, a), e, t, u)); }); return this._consoleTask && (e._consoleTask = this._consoleTask), e; } return e.prototype = ae, e; }, set: function (e) { l(this, "then", e && e.prototype === ae ? xe : { get: function () { return e; }, set: xe.set }); } };
    function ke(e, t, n, r, i) { this.onFulfilled = "function" == typeof e ? e : null, this.onRejected = "function" == typeof t ? t : null, this.resolve = n, this.reject = r, this.psd = i; }
    function Oe(e, t) { var n, r; pe.push(t), null === e._state && (n = e._lib && je(), t = ye(t), e._state = !1, e._value = t, r = e, de.some(function (e) { return e._value === r._value; }) || de.push(r), Pe(e), n && Ae()); }
    function Pe(e) { var t = e._listeners; e._listeners = []; for (var n = 0, r = t.length; n < r; ++n)
        Ke(e, t[n]); var i = e._PSD; --i.ref || i.finalize(), 0 === ge && (++ge, le(function () { 0 == --ge && Ce(); }, [])); }
    function Ke(e, t) { if (null !== e._state) {
        var n = e._state ? t.onFulfilled : t.onRejected;
        if (null === n)
            return (e._state ? t.resolve : t.reject)(e._value);
        ++t.psd.ref, ++ge, le(Ee, [n, e, t]);
    }
    else
        e._listeners.push(t); }
    function Ee(e, t, n) { try {
        var r, i = t._value;
        !t._state && pe.length && (pe = []), r = ie && t._consoleTask ? t._consoleTask.run(function () { return e(i); }) : e(i), t._state || -1 !== pe.indexOf(i) || function (e) { var t = de.length; for (; t;)
            if (de[--t]._value === e._value)
                return de.splice(t, 1); }(t), n.resolve(r);
    }
    catch (e) {
        n.reject(e);
    }
    finally {
        0 == --ge && Ce(), --n.psd.ref || n.psd.finalize();
    } }
    function Se() { $e(ve, function () { je() && Ae(); }); }
    function je() { var e = fe; return he = fe = !1, e; }
    function Ae() { var e, t, n; do {
        for (; 0 < be.length;)
            for (e = be, be = [], n = e.length, t = 0; t < n; ++t) {
                var r = e[t];
                r[0].apply(null, r[1]);
            }
    } while (0 < be.length); he = fe = !0; }
    function Ce() { var e = de; de = [], e.forEach(function (e) { e._PSD.onunhandled.call(null, e._value, e); }); for (var t = we.slice(0), n = t.length; n;)
        t[--n](); }
    function Te(e) { return new _e(ae, !1, e); }
    function qe(n, r) { var i = me; return function () { var e = je(), t = me; try {
        return We(i, !0), n.apply(this, arguments);
    }
    catch (e) {
        r && r(e);
    }
    finally {
        We(t, !1), e && Ae();
    } }; }
    r(_e.prototype, { then: xe, _then: function (e, t) { Ke(this, new ke(null, null, e, t, me)); }, catch: function (e) { if (1 === arguments.length)
            return this.then(null, e); var t = e, n = arguments[1]; return "function" == typeof t ? this.then(null, function (e) { return (e instanceof t ? n : Te)(e); }) : this.then(null, function (e) { return (e && e.name === t ? n : Te)(e); }); }, finally: function (t) { return this.then(function (e) { return _e.resolve(t()).then(function () { return e; }); }, function (e) { return _e.resolve(t()).then(function () { return Te(e); }); }); }, timeout: function (r, i) { var o = this; return r < 1 / 0 ? new _e(function (e, t) { var n = setTimeout(function () { return t(new Y.Timeout(i)); }, r); o.then(e, t).finally(clearTimeout.bind(null, n)); }) : this; } }), "undefined" != typeof Symbol && Symbol.toStringTag && l(_e.prototype, Symbol.toStringTag, "Dexie.Promise"), ve.env = Ye(), r(_e, { all: function () { var o = I.apply(null, arguments).map(Ve); return new _e(function (n, r) { 0 === o.length && n([]); var i = o.length; o.forEach(function (e, t) { return _e.resolve(e).then(function (e) { o[t] = e, --i || n(o); }, r); }); }); }, resolve: function (n) { return n instanceof _e ? n : n && "function" == typeof n.then ? new _e(function (e, t) { n.then(e, t); }) : new _e(ae, !0, n); }, reject: Te, race: function () { var e = I.apply(null, arguments).map(Ve); return new _e(function (t, n) { e.map(function (e) { return _e.resolve(e).then(t, n); }); }); }, PSD: { get: function () { return me; }, set: function (e) { return me = e; } }, totalEchoes: { get: function () { return Fe; } }, newPSD: Ne, usePSD: $e, scheduler: { get: function () { return le; }, set: function (e) { le = e; } }, rejectionMapper: { get: function () { return ye; }, set: function (e) { ye = e; } }, follow: function (i, n) { return new _e(function (e, t) { return Ne(function (n, r) { var e = me; e.unhandleds = [], e.onunhandled = r, e.finalize = J(function () { var t, e = this; t = function () { 0 === e.unhandleds.length ? n() : r(e.unhandleds[0]); }, we.push(function e() { t(), we.splice(we.indexOf(e), 1); }), ++ge, le(function () { 0 == --ge && Ce(); }, []); }, e.finalize), i(); }, n, e, t); }); } }), se && (se.allSettled && l(_e, "allSettled", function () { var e = I.apply(null, arguments).map(Ve); return new _e(function (n) { 0 === e.length && n([]); var r = e.length, i = new Array(r); e.forEach(function (e, t) { return _e.resolve(e).then(function (e) { return i[t] = { status: "fulfilled", value: e }; }, function (e) { return i[t] = { status: "rejected", reason: e }; }).then(function () { return --r || n(i); }); }); }); }), se.any && "undefined" != typeof AggregateError && l(_e, "any", function () { var e = I.apply(null, arguments).map(Ve); return new _e(function (n, r) { 0 === e.length && r(new AggregateError([])); var i = e.length, o = new Array(i); e.forEach(function (e, t) { return _e.resolve(e).then(function (e) { return n(e); }, function (e) { o[t] = e, --i || r(new AggregateError(o)); }); }); }); }), se.withResolvers && (_e.withResolvers = se.withResolvers));
    var De = { awaits: 0, echoes: 0, id: 0 }, Ie = 0, Be = [], Re = 0, Fe = 0, Me = 0;
    function Ne(e, t, n, r) { var i = me, o = Object.create(i); o.parent = i, o.ref = 0, o.global = !1, o.id = ++Me, ve.env, o.env = ce ? { Promise: _e, PromiseProp: { value: _e, configurable: !0, writable: !0 }, all: _e.all, race: _e.race, allSettled: _e.allSettled, any: _e.any, resolve: _e.resolve, reject: _e.reject } : {}, t && a(o, t), ++i.ref, o.finalize = function () { --this.parent.ref || this.parent.finalize(); }; r = $e(o, e, n, r); return 0 === o.ref && o.finalize(), r; }
    function Le() { return De.id || (De.id = ++Ie), ++De.awaits, De.echoes += ue, De.id; }
    function Ue() { return !!De.awaits && (0 == --De.awaits && (De.id = 0), De.echoes = De.awaits * ue, !0); }
    function Ve(e) { return De.echoes && e && e.constructor === se ? (Le(), e.then(function (e) { return Ue(), e; }, function (e) { return Ue(), Xe(e); })) : e; }
    function ze() { var e = Be[Be.length - 1]; Be.pop(), We(e, !1); }
    function We(e, t) { var n, r = me; (t ? !De.echoes || Re++ && e === me : !Re || --Re && e === me) || queueMicrotask(t ? function (e) { ++Fe, De.echoes && 0 != --De.echoes || (De.echoes = De.awaits = De.id = 0), Be.push(me), We(e, !0); }.bind(null, e) : ze), e !== me && (me = e, r === ve && (ve.env = Ye()), ce && (n = ve.env.Promise, t = e.env, (r.global || e.global) && (Object.defineProperty(f, "Promise", t.PromiseProp), n.all = t.all, n.race = t.race, n.resolve = t.resolve, n.reject = t.reject, t.allSettled && (n.allSettled = t.allSettled), t.any && (n.any = t.any)))); }
    function Ye() { var e = f.Promise; return ce ? { Promise: e, PromiseProp: Object.getOwnPropertyDescriptor(f, "Promise"), all: e.all, race: e.race, allSettled: e.allSettled, any: e.any, resolve: e.resolve, reject: e.reject } : {}; }
    function $e(e, t, n, r, i) { var o = me; try {
        return We(e, !0), t(n, r, i);
    }
    finally {
        We(o, !1);
    } }
    function Qe(t, n, r, i) { return "function" != typeof t ? t : function () { var e = me; r && Le(), We(n, !0); try {
        return t.apply(this, arguments);
    }
    finally {
        We(e, !1), i && queueMicrotask(Ue);
    } }; }
    function Ge(e) { Promise === se && 0 === De.echoes ? 0 === Re ? e() : enqueueNativeMicroTask(e) : setTimeout(e, 0); }
    -1 === ("" + F).indexOf("[native code]") && (Le = Ue = G);
    var Xe = _e.reject;
    var He = String.fromCharCode(65535), Je = "Invalid key provided. Keys must be of type string, number, Date or Array<string | number | Date>.", Ze = "String expected.", et = [], tt = "__dbnames", nt = "readonly", rt = "readwrite";
    function it(e, t) { return e ? t ? function () { return e.apply(this, arguments) && t.apply(this, arguments); } : e : t; }
    var ot = { type: 3, lower: -1 / 0, lowerOpen: !1, upper: [[]], upperOpen: !1 };
    function at(t) { return "string" != typeof t || /\./.test(t) ? function (e) { return e; } : function (e) { return void 0 === e[t] && t in e && delete (e = S(e))[t], e; }; }
    function ut() { throw Y.Type(); }
    function st(e, t) { try {
        var n = ct(e), r = ct(t);
        if (n !== r)
            return "Array" === n ? 1 : "Array" === r ? -1 : "binary" === n ? 1 : "binary" === r ? -1 : "string" === n ? 1 : "string" === r ? -1 : "Date" === n ? 1 : "Date" !== r ? NaN : -1;
        switch (n) {
            case "number":
            case "Date":
            case "string": return t < e ? 1 : e < t ? -1 : 0;
            case "binary": return function (e, t) { for (var n = e.length, r = t.length, i = n < r ? n : r, o = 0; o < i; ++o)
                if (e[o] !== t[o])
                    return e[o] < t[o] ? -1 : 1; return n === r ? 0 : n < r ? -1 : 1; }(lt(e), lt(t));
            case "Array": return function (e, t) { for (var n = e.length, r = t.length, i = n < r ? n : r, o = 0; o < i; ++o) {
                var a = st(e[o], t[o]);
                if (0 !== a)
                    return a;
            } return n === r ? 0 : n < r ? -1 : 1; }(e, t);
        }
    }
    catch (e) { } return NaN; }
    function ct(e) { var t = typeof e; if ("object" != t)
        return t; if (ArrayBuffer.isView(e))
        return "binary"; e = A(e); return "ArrayBuffer" === e ? "binary" : e; }
    function lt(e) { return e instanceof Uint8Array ? e : ArrayBuffer.isView(e) ? new Uint8Array(e.buffer, e.byteOffset, e.byteLength) : new Uint8Array(e); }
    var ft = (ht.prototype._trans = function (e, r, t) { var n = this._tx || me.trans, i = this.name, o = ie && "undefined" != typeof console && console.createTask && console.createTask("Dexie: ".concat("readonly" === e ? "read" : "write", " ").concat(this.name)); function a(e, t, n) { if (!n.schema[i])
        throw new Y.NotFound("Table " + i + " not part of transaction"); return r(n.idbtrans, n); } var u = je(); try {
        var s = n && n.db._novip === this.db._novip ? n === me.trans ? n._promise(e, a, t) : Ne(function () { return n._promise(e, a, t); }, { trans: n, transless: me.transless || me }) : function t(n, r, i, o) { if (n.idbdb && (n._state.openComplete || me.letThrough || n._vip)) {
            var a = n._createTransaction(r, i, n._dbSchema);
            try {
                a.create(), n._state.PR1398_maxLoop = 3;
            }
            catch (e) {
                return e.name === z.InvalidState && n.isOpen() && 0 < --n._state.PR1398_maxLoop ? (console.warn("Dexie: Need to reopen db"), n.close({ disableAutoOpen: !1 }), n.open().then(function () { return t(n, r, i, o); })) : Xe(e);
            }
            return a._promise(r, function (e, t) { return Ne(function () { return me.trans = a, o(e, t, a); }); }).then(function (e) { if ("readwrite" === r)
                try {
                    a.idbtrans.commit();
                }
                catch (e) { } return "readonly" === r ? e : a._completion.then(function () { return e; }); });
        } if (n._state.openComplete)
            return Xe(new Y.DatabaseClosed(n._state.dbOpenError)); if (!n._state.isBeingOpened) {
            if (!n._state.autoOpen)
                return Xe(new Y.DatabaseClosed);
            n.open().catch(G);
        } return n._state.dbReadyPromise.then(function () { return t(n, r, i, o); }); }(this.db, e, [this.name], a);
        return o && (s._consoleTask = o, s = s.catch(function (e) { return console.trace(e), Xe(e); })), s;
    }
    finally {
        u && Ae();
    } }, ht.prototype.get = function (t, e) { var n = this; return t && t.constructor === Object ? this.where(t).first(e) : null == t ? Xe(new Y.Type("Invalid argument to Table.get()")) : this._trans("readonly", function (e) { return n.core.get({ trans: e, key: t }).then(function (e) { return n.hook.reading.fire(e); }); }).then(e); }, ht.prototype.where = function (o) { if ("string" == typeof o)
        return new this.db.WhereClause(this, o); if (k(o))
        return new this.db.WhereClause(this, "[".concat(o.join("+"), "]")); var n = x(o); if (1 === n.length)
        return this.where(n[0]).equals(o[n[0]]); var e = this.schema.indexes.concat(this.schema.primKey).filter(function (t) { if (t.compound && n.every(function (e) { return 0 <= t.keyPath.indexOf(e); })) {
        for (var e = 0; e < n.length; ++e)
            if (-1 === n.indexOf(t.keyPath[e]))
                return !1;
        return !0;
    } return !1; }).sort(function (e, t) { return e.keyPath.length - t.keyPath.length; })[0]; if (e && this.db._maxKey !== He) {
        var t = e.keyPath.slice(0, n.length);
        return this.where(t).equals(t.map(function (e) { return o[e]; }));
    } !e && ie && console.warn("The query ".concat(JSON.stringify(o), " on ").concat(this.name, " would benefit from a ") + "compound index [".concat(n.join("+"), "]")); var a = this.schema.idxByName; function u(e, t) { return 0 === st(e, t); } var r = n.reduce(function (e, t) { var n = e[0], r = e[1], e = a[t], i = o[t]; return [n || e, n || !e ? it(r, e && e.multi ? function (e) { e = O(e, t); return k(e) && e.some(function (e) { return u(i, e); }); } : function (e) { return u(i, O(e, t)); }) : r]; }, [null, null]), t = r[0], r = r[1]; return t ? this.where(t.name).equals(o[t.keyPath]).filter(r) : e ? this.filter(r) : this.where(n).equals(""); }, ht.prototype.filter = function (e) { return this.toCollection().and(e); }, ht.prototype.count = function (e) { return this.toCollection().count(e); }, ht.prototype.offset = function (e) { return this.toCollection().offset(e); }, ht.prototype.limit = function (e) { return this.toCollection().limit(e); }, ht.prototype.each = function (e) { return this.toCollection().each(e); }, ht.prototype.toArray = function (e) { return this.toCollection().toArray(e); }, ht.prototype.toCollection = function () { return new this.db.Collection(new this.db.WhereClause(this)); }, ht.prototype.orderBy = function (e) { return new this.db.Collection(new this.db.WhereClause(this, k(e) ? "[".concat(e.join("+"), "]") : e)); }, ht.prototype.reverse = function () { return this.toCollection().reverse(); }, ht.prototype.mapToClass = function (r) { var e, t = this.db, n = this.name; function i() { return null !== e && e.apply(this, arguments) || this; } (this.schema.mappedClass = r).prototype instanceof ut && (function (e, t) { if ("function" != typeof t && null !== t)
        throw new TypeError("Class extends value " + String(t) + " is not a constructor or null"); function n() { this.constructor = e; } s(e, t), e.prototype = null === t ? Object.create(t) : (n.prototype = t.prototype, new n); }(i, e = r), Object.defineProperty(i.prototype, "db", { get: function () { return t; }, enumerable: !1, configurable: !0 }), i.prototype.table = function () { return n; }, r = i); for (var o = new Set, a = r.prototype; a; a = c(a))
        Object.getOwnPropertyNames(a).forEach(function (e) { return o.add(e); }); function u(e) { if (!e)
        return e; var t, n = Object.create(r.prototype); for (t in e)
        if (!o.has(t))
            try {
                n[t] = e[t];
            }
            catch (e) { } return n; } return this.schema.readHook && this.hook.reading.unsubscribe(this.schema.readHook), this.schema.readHook = u, this.hook("reading", u), r; }, ht.prototype.defineClass = function () { return this.mapToClass(function (e) { a(this, e); }); }, ht.prototype.add = function (t, n) { var r = this, e = this.schema.primKey, i = e.auto, o = e.keyPath, a = t; return o && i && (a = at(o)(t)), this._trans("readwrite", function (e) { return r.core.mutate({ trans: e, type: "add", keys: null != n ? [n] : null, values: [a] }); }).then(function (e) { return e.numFailures ? _e.reject(e.failures[0]) : e.lastResult; }).then(function (e) { if (o)
        try {
            P(t, o, e);
        }
        catch (e) { } return e; }); }, ht.prototype.update = function (e, t) { if ("object" != typeof e || k(e))
        return this.where(":id").equals(e).modify(t); e = O(e, this.schema.primKey.keyPath); return void 0 === e ? Xe(new Y.InvalidArgument("Given object does not contain its primary key")) : this.where(":id").equals(e).modify(t); }, ht.prototype.put = function (t, n) { var r = this, e = this.schema.primKey, i = e.auto, o = e.keyPath, a = t; return o && i && (a = at(o)(t)), this._trans("readwrite", function (e) { return r.core.mutate({ trans: e, type: "put", values: [a], keys: null != n ? [n] : null }); }).then(function (e) { return e.numFailures ? _e.reject(e.failures[0]) : e.lastResult; }).then(function (e) { if (o)
        try {
            P(t, o, e);
        }
        catch (e) { } return e; }); }, ht.prototype.delete = function (t) { var n = this; return this._trans("readwrite", function (e) { return n.core.mutate({ trans: e, type: "delete", keys: [t] }); }).then(function (e) { return e.numFailures ? _e.reject(e.failures[0]) : void 0; }); }, ht.prototype.clear = function () { var t = this; return this._trans("readwrite", function (e) { return t.core.mutate({ trans: e, type: "deleteRange", range: ot }); }).then(function (e) { return e.numFailures ? _e.reject(e.failures[0]) : void 0; }); }, ht.prototype.bulkGet = function (t) { var n = this; return this._trans("readonly", function (e) { return n.core.getMany({ keys: t, trans: e }).then(function (e) { return e.map(function (e) { return n.hook.reading.fire(e); }); }); }); }, ht.prototype.bulkAdd = function (r, e, t) { var o = this, a = Array.isArray(e) ? e : void 0, u = (t = t || (a ? void 0 : e)) ? t.allKeys : void 0; return this._trans("readwrite", function (e) { var t = o.schema.primKey, n = t.auto, t = t.keyPath; if (t && a)
        throw new Y.InvalidArgument("bulkAdd(): keys argument invalid on tables with inbound keys"); if (a && a.length !== r.length)
        throw new Y.InvalidArgument("Arguments objects and keys must have the same length"); var i = r.length, t = t && n ? r.map(at(t)) : r; return o.core.mutate({ trans: e, type: "add", keys: a, values: t, wantResults: u }).then(function (e) { var t = e.numFailures, n = e.results, r = e.lastResult, e = e.failures; if (0 === t)
        return u ? n : r; throw new V("".concat(o.name, ".bulkAdd(): ").concat(t, " of ").concat(i, " operations failed"), e); }); }); }, ht.prototype.bulkPut = function (r, e, t) { var o = this, a = Array.isArray(e) ? e : void 0, u = (t = t || (a ? void 0 : e)) ? t.allKeys : void 0; return this._trans("readwrite", function (e) { var t = o.schema.primKey, n = t.auto, t = t.keyPath; if (t && a)
        throw new Y.InvalidArgument("bulkPut(): keys argument invalid on tables with inbound keys"); if (a && a.length !== r.length)
        throw new Y.InvalidArgument("Arguments objects and keys must have the same length"); var i = r.length, t = t && n ? r.map(at(t)) : r; return o.core.mutate({ trans: e, type: "put", keys: a, values: t, wantResults: u }).then(function (e) { var t = e.numFailures, n = e.results, r = e.lastResult, e = e.failures; if (0 === t)
        return u ? n : r; throw new V("".concat(o.name, ".bulkPut(): ").concat(t, " of ").concat(i, " operations failed"), e); }); }); }, ht.prototype.bulkUpdate = function (t) { var h = this, n = this.core, r = t.map(function (e) { return e.key; }), i = t.map(function (e) { return e.changes; }), d = []; return this._trans("readwrite", function (e) { return n.getMany({ trans: e, keys: r, cache: "clone" }).then(function (c) { var l = [], f = []; t.forEach(function (e, t) { var n = e.key, r = e.changes, i = c[t]; if (i) {
        for (var o = 0, a = Object.keys(r); o < a.length; o++) {
            var u = a[o], s = r[u];
            if (u === h.schema.primKey.keyPath) {
                if (0 !== st(s, n))
                    throw new Y.Constraint("Cannot update primary key in bulkUpdate()");
            }
            else
                P(i, u, s);
        }
        d.push(t), l.push(n), f.push(i);
    } }); var s = l.length; return n.mutate({ trans: e, type: "put", keys: l, values: f, updates: { keys: r, changeSpecs: i } }).then(function (e) { var t = e.numFailures, n = e.failures; if (0 === t)
        return s; for (var r = 0, i = Object.keys(n); r < i.length; r++) {
        var o, a = i[r], u = d[Number(a)];
        null != u && (o = n[a], delete n[a], n[u] = o);
    } throw new V("".concat(h.name, ".bulkUpdate(): ").concat(t, " of ").concat(s, " operations failed"), n); }); }); }); }, ht.prototype.bulkDelete = function (t) { var r = this, i = t.length; return this._trans("readwrite", function (e) { return r.core.mutate({ trans: e, type: "delete", keys: t }); }).then(function (e) { var t = e.numFailures, n = e.lastResult, e = e.failures; if (0 === t)
        return n; throw new V("".concat(r.name, ".bulkDelete(): ").concat(t, " of ").concat(i, " operations failed"), e); }); }, ht);
    function ht() { }
    function dt(i) { function t(e, t) { if (t) {
        for (var n = arguments.length, r = new Array(n - 1); --n;)
            r[n - 1] = arguments[n];
        return a[e].subscribe.apply(null, r), i;
    } if ("string" == typeof e)
        return a[e]; } var a = {}; t.addEventType = u; for (var e = 1, n = arguments.length; e < n; ++e)
        u(arguments[e]); return t; function u(e, n, r) { if ("object" != typeof e) {
        var i;
        n = n || ne;
        var o = { subscribers: [], fire: r = r || G, subscribe: function (e) { -1 === o.subscribers.indexOf(e) && (o.subscribers.push(e), o.fire = n(o.fire, e)); }, unsubscribe: function (t) { o.subscribers = o.subscribers.filter(function (e) { return e !== t; }), o.fire = o.subscribers.reduce(n, r); } };
        return a[e] = t[e] = o;
    } x(i = e).forEach(function (e) { var t = i[e]; if (k(t))
        u(e, i[e][0], i[e][1]);
    else {
        if ("asap" !== t)
            throw new Y.InvalidArgument("Invalid event config");
        var n = u(e, X, function () { for (var e = arguments.length, t = new Array(e); e--;)
            t[e] = arguments[e]; n.subscribers.forEach(function (e) { v(function () { e.apply(null, t); }); }); });
    } }); } }
    function pt(e, t) { return o(t).from({ prototype: e }), t; }
    function yt(e, t) { return !(e.filter || e.algorithm || e.or) && (t ? e.justLimit : !e.replayFilter); }
    function vt(e, t) { e.filter = it(e.filter, t); }
    function mt(e, t, n) { var r = e.replayFilter; e.replayFilter = r ? function () { return it(r(), t()); } : t, e.justLimit = n && !r; }
    function bt(e, t) { if (e.isPrimKey)
        return t.primaryKey; var n = t.getIndexByKeyPath(e.index); if (!n)
        throw new Y.Schema("KeyPath " + e.index + " on object store " + t.name + " is not indexed"); return n; }
    function gt(e, t, n) { var r = bt(e, t.schema); return t.openCursor({ trans: n, values: !e.keysOnly, reverse: "prev" === e.dir, unique: !!e.unique, query: { index: r, range: e.range } }); }
    function wt(e, o, t, n) { var a = e.replayFilter ? it(e.filter, e.replayFilter()) : e.filter; if (e.or) {
        var u = {}, r = function (e, t, n) { var r, i; a && !a(t, n, function (e) { return t.stop(e); }, function (e) { return t.fail(e); }) || ("[object ArrayBuffer]" === (i = "" + (r = t.primaryKey)) && (i = "" + new Uint8Array(r)), m(u, i) || (u[i] = !0, o(e, t, n))); };
        return Promise.all([e.or._iterate(r, t), _t(gt(e, n, t), e.algorithm, r, !e.keysOnly && e.valueMapper)]);
    } return _t(gt(e, n, t), it(e.algorithm, a), o, !e.keysOnly && e.valueMapper); }
    function _t(e, r, i, o) { var a = qe(o ? function (e, t, n) { return i(o(e), t, n); } : i); return e.then(function (n) { if (n)
        return n.start(function () { var t = function () { return n.continue(); }; r && !r(n, function (e) { return t = e; }, function (e) { n.stop(e), t = G; }, function (e) { n.fail(e), t = G; }) || a(n.value, n, function (e) { return t = e; }), t(); }); }); }
    var xt = (kt.prototype.execute = function (e) { var t = this["@@propmod"]; if (void 0 !== t.add) {
        var n = t.add;
        if (k(n))
            return i(i([], k(e) ? e : [], !0), n, !0).sort();
        if ("number" == typeof n)
            return (Number(e) || 0) + n;
        if ("bigint" == typeof n)
            try {
                return BigInt(e) + n;
            }
            catch (e) {
                return BigInt(0) + n;
            }
        throw new TypeError("Invalid term ".concat(n));
    } if (void 0 !== t.remove) {
        var r = t.remove;
        if (k(r))
            return k(e) ? e.filter(function (e) { return !r.includes(e); }).sort() : [];
        if ("number" == typeof r)
            return Number(e) - r;
        if ("bigint" == typeof r)
            try {
                return BigInt(e) - r;
            }
            catch (e) {
                return BigInt(0) - r;
            }
        throw new TypeError("Invalid subtrahend ".concat(r));
    } n = null === (n = t.replacePrefix) || void 0 === n ? void 0 : n[0]; return n && "string" == typeof e && e.startsWith(n) ? t.replacePrefix[1] + e.substring(n.length) : e; }, kt);
    function kt(e) { this["@@propmod"] = e; }
    var Ot = (Pt.prototype._read = function (e, t) { var n = this._ctx; return n.error ? n.table._trans(null, Xe.bind(null, n.error)) : n.table._trans("readonly", e).then(t); }, Pt.prototype._write = function (e) { var t = this._ctx; return t.error ? t.table._trans(null, Xe.bind(null, t.error)) : t.table._trans("readwrite", e, "locked"); }, Pt.prototype._addAlgorithm = function (e) { var t = this._ctx; t.algorithm = it(t.algorithm, e); }, Pt.prototype._iterate = function (e, t) { return wt(this._ctx, e, t, this._ctx.table.core); }, Pt.prototype.clone = function (e) { var t = Object.create(this.constructor.prototype), n = Object.create(this._ctx); return e && a(n, e), t._ctx = n, t; }, Pt.prototype.raw = function () { return this._ctx.valueMapper = null, this; }, Pt.prototype.each = function (t) { var n = this._ctx; return this._read(function (e) { return wt(n, t, e, n.table.core); }); }, Pt.prototype.count = function (e) { var i = this; return this._read(function (e) { var t = i._ctx, n = t.table.core; if (yt(t, !0))
        return n.count({ trans: e, query: { index: bt(t, n.schema), range: t.range } }).then(function (e) { return Math.min(e, t.limit); }); var r = 0; return wt(t, function () { return ++r, !1; }, e, n).then(function () { return r; }); }).then(e); }, Pt.prototype.sortBy = function (e, t) { var n = e.split(".").reverse(), r = n[0], i = n.length - 1; function o(e, t) { return t ? o(e[n[t]], t - 1) : e[r]; } var a = "next" === this._ctx.dir ? 1 : -1; function u(e, t) { return st(o(e, i), o(t, i)) * a; } return this.toArray(function (e) { return e.sort(u); }).then(t); }, Pt.prototype.toArray = function (e) { var o = this; return this._read(function (e) { var t = o._ctx; if ("next" === t.dir && yt(t, !0) && 0 < t.limit) {
        var n = t.valueMapper, r = bt(t, t.table.core.schema);
        return t.table.core.query({ trans: e, limit: t.limit, values: !0, query: { index: r, range: t.range } }).then(function (e) { e = e.result; return n ? e.map(n) : e; });
    } var i = []; return wt(t, function (e) { return i.push(e); }, e, t.table.core).then(function () { return i; }); }, e); }, Pt.prototype.offset = function (t) { var e = this._ctx; return t <= 0 || (e.offset += t, yt(e) ? mt(e, function () { var n = t; return function (e, t) { return 0 === n || (1 === n ? --n : t(function () { e.advance(n), n = 0; }), !1); }; }) : mt(e, function () { var e = t; return function () { return --e < 0; }; })), this; }, Pt.prototype.limit = function (e) { return this._ctx.limit = Math.min(this._ctx.limit, e), mt(this._ctx, function () { var r = e; return function (e, t, n) { return --r <= 0 && t(n), 0 <= r; }; }, !0), this; }, Pt.prototype.until = function (r, i) { return vt(this._ctx, function (e, t, n) { return !r(e.value) || (t(n), i); }), this; }, Pt.prototype.first = function (e) { return this.limit(1).toArray(function (e) { return e[0]; }).then(e); }, Pt.prototype.last = function (e) { return this.reverse().first(e); }, Pt.prototype.filter = function (t) { var e; return vt(this._ctx, function (e) { return t(e.value); }), (e = this._ctx).isMatch = it(e.isMatch, t), this; }, Pt.prototype.and = function (e) { return this.filter(e); }, Pt.prototype.or = function (e) { return new this.db.WhereClause(this._ctx.table, e, this); }, Pt.prototype.reverse = function () { return this._ctx.dir = "prev" === this._ctx.dir ? "next" : "prev", this._ondirectionchange && this._ondirectionchange(this._ctx.dir), this; }, Pt.prototype.desc = function () { return this.reverse(); }, Pt.prototype.eachKey = function (n) { var e = this._ctx; return e.keysOnly = !e.isMatch, this.each(function (e, t) { n(t.key, t); }); }, Pt.prototype.eachUniqueKey = function (e) { return this._ctx.unique = "unique", this.eachKey(e); }, Pt.prototype.eachPrimaryKey = function (n) { var e = this._ctx; return e.keysOnly = !e.isMatch, this.each(function (e, t) { n(t.primaryKey, t); }); }, Pt.prototype.keys = function (e) { var t = this._ctx; t.keysOnly = !t.isMatch; var n = []; return this.each(function (e, t) { n.push(t.key); }).then(function () { return n; }).then(e); }, Pt.prototype.primaryKeys = function (e) { var n = this._ctx; if ("next" === n.dir && yt(n, !0) && 0 < n.limit)
        return this._read(function (e) { var t = bt(n, n.table.core.schema); return n.table.core.query({ trans: e, values: !1, limit: n.limit, query: { index: t, range: n.range } }); }).then(function (e) { return e.result; }).then(e); n.keysOnly = !n.isMatch; var r = []; return this.each(function (e, t) { r.push(t.primaryKey); }).then(function () { return r; }).then(e); }, Pt.prototype.uniqueKeys = function (e) { return this._ctx.unique = "unique", this.keys(e); }, Pt.prototype.firstKey = function (e) { return this.limit(1).keys(function (e) { return e[0]; }).then(e); }, Pt.prototype.lastKey = function (e) { return this.reverse().firstKey(e); }, Pt.prototype.distinct = function () { var e = this._ctx, e = e.index && e.table.schema.idxByName[e.index]; if (!e || !e.multi)
        return this; var n = {}; return vt(this._ctx, function (e) { var t = e.primaryKey.toString(), e = m(n, t); return n[t] = !0, !e; }), this; }, Pt.prototype.modify = function (w) { var n = this, r = this._ctx; return this._write(function (d) { var a, u, p; p = "function" == typeof w ? w : (a = x(w), u = a.length, function (e) { for (var t = !1, n = 0; n < u; ++n) {
        var r = a[n], i = w[r], o = O(e, r);
        i instanceof xt ? (P(e, r, i.execute(o)), t = !0) : o !== i && (P(e, r, i), t = !0);
    } return t; }); var y = r.table.core, e = y.schema.primaryKey, v = e.outbound, m = e.extractKey, b = 200, e = n.db._options.modifyChunkSize; e && (b = "object" == typeof e ? e[y.name] || e["*"] || 200 : e); function g(e, t) { var n = t.failures, t = t.numFailures; c += e - t; for (var r = 0, i = x(n); r < i.length; r++) {
        var o = i[r];
        s.push(n[o]);
    } } var s = [], c = 0, t = []; return n.clone().primaryKeys().then(function (l) { function f(s) { var c = Math.min(b, l.length - s); return y.getMany({ trans: d, keys: l.slice(s, s + c), cache: "immutable" }).then(function (e) { for (var n = [], t = [], r = v ? [] : null, i = [], o = 0; o < c; ++o) {
        var a = e[o], u = { value: S(a), primKey: l[s + o] };
        !1 !== p.call(u, u.value, u) && (null == u.value ? i.push(l[s + o]) : v || 0 === st(m(a), m(u.value)) ? (t.push(u.value), v && r.push(l[s + o])) : (i.push(l[s + o]), n.push(u.value)));
    } return Promise.resolve(0 < n.length && y.mutate({ trans: d, type: "add", values: n }).then(function (e) { for (var t in e.failures)
        i.splice(parseInt(t), 1); g(n.length, e); })).then(function () { return (0 < t.length || h && "object" == typeof w) && y.mutate({ trans: d, type: "put", keys: r, values: t, criteria: h, changeSpec: "function" != typeof w && w, isAdditionalChunk: 0 < s }).then(function (e) { return g(t.length, e); }); }).then(function () { return (0 < i.length || h && w === Kt) && y.mutate({ trans: d, type: "delete", keys: i, criteria: h, isAdditionalChunk: 0 < s }).then(function (e) { return g(i.length, e); }); }).then(function () { return l.length > s + c && f(s + b); }); }); } var h = yt(r) && r.limit === 1 / 0 && ("function" != typeof w || w === Kt) && { index: r.index, range: r.range }; return f(0).then(function () { if (0 < s.length)
        throw new U("Error modifying one or more objects", s, c, t); return l.length; }); }); }); }, Pt.prototype.delete = function () { var i = this._ctx, n = i.range; return yt(i) && (i.isPrimKey || 3 === n.type) ? this._write(function (e) { var t = i.table.core.schema.primaryKey, r = n; return i.table.core.count({ trans: e, query: { index: t, range: r } }).then(function (n) { return i.table.core.mutate({ trans: e, type: "deleteRange", range: r }).then(function (e) { var t = e.failures; e.lastResult, e.results; e = e.numFailures; if (e)
        throw new U("Could not delete some values", Object.keys(t).map(function (e) { return t[e]; }), n - e); return n - e; }); }); }) : this.modify(Kt); }, Pt);
    function Pt() { }
    var Kt = function (e, t) { return t.value = null; };
    function Et(e, t) { return e < t ? -1 : e === t ? 0 : 1; }
    function St(e, t) { return t < e ? -1 : e === t ? 0 : 1; }
    function jt(e, t, n) { e = e instanceof Dt ? new e.Collection(e) : e; return e._ctx.error = new (n || TypeError)(t), e; }
    function At(e) { return new e.Collection(e, function () { return qt(""); }).limit(0); }
    function Ct(e, s, n, r) { var i, c, l, f, h, d, p, y = n.length; if (!n.every(function (e) { return "string" == typeof e; }))
        return jt(e, Ze); function t(e) { i = "next" === e ? function (e) { return e.toUpperCase(); } : function (e) { return e.toLowerCase(); }, c = "next" === e ? function (e) { return e.toLowerCase(); } : function (e) { return e.toUpperCase(); }, l = "next" === e ? Et : St; var t = n.map(function (e) { return { lower: c(e), upper: i(e) }; }).sort(function (e, t) { return l(e.lower, t.lower); }); f = t.map(function (e) { return e.upper; }), h = t.map(function (e) { return e.lower; }), p = "next" === (d = e) ? "" : r; } t("next"); e = new e.Collection(e, function () { return Tt(f[0], h[y - 1] + r); }); e._ondirectionchange = function (e) { t(e); }; var v = 0; return e._addAlgorithm(function (e, t, n) { var r = e.key; if ("string" != typeof r)
        return !1; var i = c(r); if (s(i, h, v))
        return !0; for (var o = null, a = v; a < y; ++a) {
        var u = function (e, t, n, r, i, o) { for (var a = Math.min(e.length, r.length), u = -1, s = 0; s < a; ++s) {
            var c = t[s];
            if (c !== r[s])
                return i(e[s], n[s]) < 0 ? e.substr(0, s) + n[s] + n.substr(s + 1) : i(e[s], r[s]) < 0 ? e.substr(0, s) + r[s] + n.substr(s + 1) : 0 <= u ? e.substr(0, u) + t[u] + n.substr(u + 1) : null;
            i(e[s], c) < 0 && (u = s);
        } return a < r.length && "next" === o ? e + n.substr(e.length) : a < e.length && "prev" === o ? e.substr(0, n.length) : u < 0 ? null : e.substr(0, u) + r[u] + n.substr(u + 1); }(r, i, f[a], h[a], l, d);
        null === u && null === o ? v = a + 1 : (null === o || 0 < l(o, u)) && (o = u);
    } return t(null !== o ? function () { e.continue(o + p); } : n), !1; }), e; }
    function Tt(e, t, n, r) { return { type: 2, lower: e, upper: t, lowerOpen: n, upperOpen: r }; }
    function qt(e) { return { type: 1, lower: e, upper: e }; }
    var Dt = (Object.defineProperty(It.prototype, "Collection", { get: function () { return this._ctx.table.db.Collection; }, enumerable: !1, configurable: !0 }), It.prototype.between = function (e, t, n, r) { n = !1 !== n, r = !0 === r; try {
        return 0 < this._cmp(e, t) || 0 === this._cmp(e, t) && (n || r) && (!n || !r) ? At(this) : new this.Collection(this, function () { return Tt(e, t, !n, !r); });
    }
    catch (e) {
        return jt(this, Je);
    } }, It.prototype.equals = function (e) { return null == e ? jt(this, Je) : new this.Collection(this, function () { return qt(e); }); }, It.prototype.above = function (e) { return null == e ? jt(this, Je) : new this.Collection(this, function () { return Tt(e, void 0, !0); }); }, It.prototype.aboveOrEqual = function (e) { return null == e ? jt(this, Je) : new this.Collection(this, function () { return Tt(e, void 0, !1); }); }, It.prototype.below = function (e) { return null == e ? jt(this, Je) : new this.Collection(this, function () { return Tt(void 0, e, !1, !0); }); }, It.prototype.belowOrEqual = function (e) { return null == e ? jt(this, Je) : new this.Collection(this, function () { return Tt(void 0, e); }); }, It.prototype.startsWith = function (e) { return "string" != typeof e ? jt(this, Ze) : this.between(e, e + He, !0, !0); }, It.prototype.startsWithIgnoreCase = function (e) { return "" === e ? this.startsWith(e) : Ct(this, function (e, t) { return 0 === e.indexOf(t[0]); }, [e], He); }, It.prototype.equalsIgnoreCase = function (e) { return Ct(this, function (e, t) { return e === t[0]; }, [e], ""); }, It.prototype.anyOfIgnoreCase = function () { var e = I.apply(D, arguments); return 0 === e.length ? At(this) : Ct(this, function (e, t) { return -1 !== t.indexOf(e); }, e, ""); }, It.prototype.startsWithAnyOfIgnoreCase = function () { var e = I.apply(D, arguments); return 0 === e.length ? At(this) : Ct(this, function (t, e) { return e.some(function (e) { return 0 === t.indexOf(e); }); }, e, He); }, It.prototype.anyOf = function () { var t = this, i = I.apply(D, arguments), o = this._cmp; try {
        i.sort(o);
    }
    catch (e) {
        return jt(this, Je);
    } if (0 === i.length)
        return At(this); var e = new this.Collection(this, function () { return Tt(i[0], i[i.length - 1]); }); e._ondirectionchange = function (e) { o = "next" === e ? t._ascending : t._descending, i.sort(o); }; var a = 0; return e._addAlgorithm(function (e, t, n) { for (var r = e.key; 0 < o(r, i[a]);)
        if (++a === i.length)
            return t(n), !1; return 0 === o(r, i[a]) || (t(function () { e.continue(i[a]); }), !1); }), e; }, It.prototype.notEqual = function (e) { return this.inAnyRange([[-1 / 0, e], [e, this.db._maxKey]], { includeLowers: !1, includeUppers: !1 }); }, It.prototype.noneOf = function () { var e = I.apply(D, arguments); if (0 === e.length)
        return new this.Collection(this); try {
        e.sort(this._ascending);
    }
    catch (e) {
        return jt(this, Je);
    } var t = e.reduce(function (e, t) { return e ? e.concat([[e[e.length - 1][1], t]]) : [[-1 / 0, t]]; }, null); return t.push([e[e.length - 1], this.db._maxKey]), this.inAnyRange(t, { includeLowers: !1, includeUppers: !1 }); }, It.prototype.inAnyRange = function (e, t) { var o = this, a = this._cmp, u = this._ascending, n = this._descending, s = this._min, c = this._max; if (0 === e.length)
        return At(this); if (!e.every(function (e) { return void 0 !== e[0] && void 0 !== e[1] && u(e[0], e[1]) <= 0; }))
        return jt(this, "First argument to inAnyRange() must be an Array of two-value Arrays [lower,upper] where upper must not be lower than lower", Y.InvalidArgument); var r = !t || !1 !== t.includeLowers, i = t && !0 === t.includeUppers; var l, f = u; function h(e, t) { return f(e[0], t[0]); } try {
        (l = e.reduce(function (e, t) { for (var n = 0, r = e.length; n < r; ++n) {
            var i = e[n];
            if (a(t[0], i[1]) < 0 && 0 < a(t[1], i[0])) {
                i[0] = s(i[0], t[0]), i[1] = c(i[1], t[1]);
                break;
            }
        } return n === r && e.push(t), e; }, [])).sort(h);
    }
    catch (e) {
        return jt(this, Je);
    } var d = 0, p = i ? function (e) { return 0 < u(e, l[d][1]); } : function (e) { return 0 <= u(e, l[d][1]); }, y = r ? function (e) { return 0 < n(e, l[d][0]); } : function (e) { return 0 <= n(e, l[d][0]); }; var v = p, e = new this.Collection(this, function () { return Tt(l[0][0], l[l.length - 1][1], !r, !i); }); return e._ondirectionchange = function (e) { f = "next" === e ? (v = p, u) : (v = y, n), l.sort(h); }, e._addAlgorithm(function (e, t, n) { for (var r, i = e.key; v(i);)
        if (++d === l.length)
            return t(n), !1; return !p(r = i) && !y(r) || (0 === o._cmp(i, l[d][1]) || 0 === o._cmp(i, l[d][0]) || t(function () { f === u ? e.continue(l[d][0]) : e.continue(l[d][1]); }), !1); }), e; }, It.prototype.startsWithAnyOf = function () { var e = I.apply(D, arguments); return e.every(function (e) { return "string" == typeof e; }) ? 0 === e.length ? At(this) : this.inAnyRange(e.map(function (e) { return [e, e + He]; })) : jt(this, "startsWithAnyOf() only works with strings"); }, It);
    function It() { }
    function Bt(t) { return qe(function (e) { return Rt(e), t(e.target.error), !1; }); }
    function Rt(e) { e.stopPropagation && e.stopPropagation(), e.preventDefault && e.preventDefault(); }
    var Ft = "storagemutated", Mt = "x-storagemutated-1", Nt = dt(null, Ft), Lt = (Ut.prototype._lock = function () { return y(!me.global), ++this._reculock, 1 !== this._reculock || me.global || (me.lockOwnerFor = this), this; }, Ut.prototype._unlock = function () { if (y(!me.global), 0 == --this._reculock)
        for (me.global || (me.lockOwnerFor = null); 0 < this._blockedFuncs.length && !this._locked();) {
            var e = this._blockedFuncs.shift();
            try {
                $e(e[1], e[0]);
            }
            catch (e) { }
        } return this; }, Ut.prototype._locked = function () { return this._reculock && me.lockOwnerFor !== this; }, Ut.prototype.create = function (t) { var n = this; if (!this.mode)
        return this; var e = this.db.idbdb, r = this.db._state.dbOpenError; if (y(!this.idbtrans), !t && !e)
        switch (r && r.name) {
            case "DatabaseClosedError": throw new Y.DatabaseClosed(r);
            case "MissingAPIError": throw new Y.MissingAPI(r.message, r);
            default: throw new Y.OpenFailed(r);
        } if (!this.active)
        throw new Y.TransactionInactive; return y(null === this._completion._state), (t = this.idbtrans = t || (this.db.core || e).transaction(this.storeNames, this.mode, { durability: this.chromeTransactionDurability })).onerror = qe(function (e) { Rt(e), n._reject(t.error); }), t.onabort = qe(function (e) { Rt(e), n.active && n._reject(new Y.Abort(t.error)), n.active = !1, n.on("abort").fire(e); }), t.oncomplete = qe(function () { n.active = !1, n._resolve(), "mutatedParts" in t && Nt.storagemutated.fire(t.mutatedParts); }), this; }, Ut.prototype._promise = function (n, r, i) { var o = this; if ("readwrite" === n && "readwrite" !== this.mode)
        return Xe(new Y.ReadOnly("Transaction is readonly")); if (!this.active)
        return Xe(new Y.TransactionInactive); if (this._locked())
        return new _e(function (e, t) { o._blockedFuncs.push([function () { o._promise(n, r, i).then(e, t); }, me]); }); if (i)
        return Ne(function () { var e = new _e(function (e, t) { o._lock(); var n = r(e, t, o); n && n.then && n.then(e, t); }); return e.finally(function () { return o._unlock(); }), e._lib = !0, e; }); var e = new _e(function (e, t) { var n = r(e, t, o); n && n.then && n.then(e, t); }); return e._lib = !0, e; }, Ut.prototype._root = function () { return this.parent ? this.parent._root() : this; }, Ut.prototype.waitFor = function (e) { var t, r = this._root(), i = _e.resolve(e); r._waitingFor ? r._waitingFor = r._waitingFor.then(function () { return i; }) : (r._waitingFor = i, r._waitingQueue = [], t = r.idbtrans.objectStore(r.storeNames[0]), function e() { for (++r._spinCount; r._waitingQueue.length;)
        r._waitingQueue.shift()(); r._waitingFor && (t.get(-1 / 0).onsuccess = e); }()); var o = r._waitingFor; return new _e(function (t, n) { i.then(function (e) { return r._waitingQueue.push(qe(t.bind(null, e))); }, function (e) { return r._waitingQueue.push(qe(n.bind(null, e))); }).finally(function () { r._waitingFor === o && (r._waitingFor = null); }); }); }, Ut.prototype.abort = function () { this.active && (this.active = !1, this.idbtrans && this.idbtrans.abort(), this._reject(new Y.Abort)); }, Ut.prototype.table = function (e) { var t = this._memoizedTables || (this._memoizedTables = {}); if (m(t, e))
        return t[e]; var n = this.schema[e]; if (!n)
        throw new Y.NotFound("Table " + e + " not part of transaction"); n = new this.db.Table(e, n, this); return n.core = this.db.core.table(e), t[e] = n; }, Ut);
    function Ut() { }
    function Vt(e, t, n, r, i, o, a) { return { name: e, keyPath: t, unique: n, multi: r, auto: i, compound: o, src: (n && !a ? "&" : "") + (r ? "*" : "") + (i ? "++" : "") + zt(t) }; }
    function zt(e) { return "string" == typeof e ? e : e ? "[" + [].join.call(e, "+") + "]" : ""; }
    function Wt(e, t, n) { return { name: e, primKey: t, indexes: n, mappedClass: null, idxByName: (r = function (e) { return [e.name, e]; }, n.reduce(function (e, t, n) { n = r(t, n); return n && (e[n[0]] = n[1]), e; }, {})) }; var r; }
    var Yt = function (e) { try {
        return e.only([[]]), Yt = function () { return [[]]; }, [[]];
    }
    catch (e) {
        return Yt = function () { return He; }, He;
    } };
    function $t(t) { return null == t ? function () { } : "string" == typeof t ? 1 === (n = t).split(".").length ? function (e) { return e[n]; } : function (e) { return O(e, n); } : function (e) { return O(e, t); }; var n; }
    function Qt(e) { return [].slice.call(e); }
    var Gt = 0;
    function Xt(e) { return null == e ? ":id" : "string" == typeof e ? e : "[".concat(e.join("+"), "]"); }
    function Ht(e, i, t) { function _(e) { if (3 === e.type)
        return null; if (4 === e.type)
        throw new Error("Cannot convert never type to IDBKeyRange"); var t = e.lower, n = e.upper, r = e.lowerOpen, e = e.upperOpen; return void 0 === t ? void 0 === n ? null : i.upperBound(n, !!e) : void 0 === n ? i.lowerBound(t, !!r) : i.bound(t, n, !!r, !!e); } function n(e) { var h, w = e.name; return { name: w, schema: e, mutate: function (e) { var y = e.trans, v = e.type, m = e.keys, b = e.values, g = e.range; return new Promise(function (t, e) { t = qe(t); var n = y.objectStore(w), r = null == n.keyPath, i = "put" === v || "add" === v; if (!i && "delete" !== v && "deleteRange" !== v)
            throw new Error("Invalid operation type: " + v); var o, a = (m || b || { length: 1 }).length; if (m && b && m.length !== b.length)
            throw new Error("Given keys array must have same length as given values array."); if (0 === a)
            return t({ numFailures: 0, failures: {}, results: [], lastResult: void 0 }); function u(e) { ++l, Rt(e); } var s = [], c = [], l = 0; if ("deleteRange" === v) {
            if (4 === g.type)
                return t({ numFailures: l, failures: c, results: [], lastResult: void 0 });
            3 === g.type ? s.push(o = n.clear()) : s.push(o = n.delete(_(g)));
        }
        else {
            var r = i ? r ? [b, m] : [b, null] : [m, null], f = r[0], h = r[1];
            if (i)
                for (var d = 0; d < a; ++d)
                    s.push(o = h && void 0 !== h[d] ? n[v](f[d], h[d]) : n[v](f[d])), o.onerror = u;
            else
                for (d = 0; d < a; ++d)
                    s.push(o = n[v](f[d])), o.onerror = u;
        } function p(e) { e = e.target.result, s.forEach(function (e, t) { return null != e.error && (c[t] = e.error); }), t({ numFailures: l, failures: c, results: "delete" === v ? m : s.map(function (e) { return e.result; }), lastResult: e }); } o.onerror = function (e) { u(e), p(e); }, o.onsuccess = p; }); }, getMany: function (e) { var f = e.trans, h = e.keys; return new Promise(function (t, e) { t = qe(t); for (var n, r = f.objectStore(w), i = h.length, o = new Array(i), a = 0, u = 0, s = function (e) { e = e.target; o[e._pos] = e.result, ++u === a && t(o); }, c = Bt(e), l = 0; l < i; ++l)
            null != h[l] && ((n = r.get(h[l]))._pos = l, n.onsuccess = s, n.onerror = c, ++a); 0 === a && t(o); }); }, get: function (e) { var r = e.trans, i = e.key; return new Promise(function (t, e) { t = qe(t); var n = r.objectStore(w).get(i); n.onsuccess = function (e) { return t(e.target.result); }, n.onerror = Bt(e); }); }, query: (h = s, function (f) { return new Promise(function (n, e) { n = qe(n); var r, i, o, t = f.trans, a = f.values, u = f.limit, s = f.query, c = u === 1 / 0 ? void 0 : u, l = s.index, s = s.range, t = t.objectStore(w), l = l.isPrimaryKey ? t : t.index(l.name), s = _(s); if (0 === u)
            return n({ result: [] }); h ? ((c = a ? l.getAll(s, c) : l.getAllKeys(s, c)).onsuccess = function (e) { return n({ result: e.target.result }); }, c.onerror = Bt(e)) : (r = 0, i = !a && "openKeyCursor" in l ? l.openKeyCursor(s) : l.openCursor(s), o = [], i.onsuccess = function (e) { var t = i.result; return t ? (o.push(a ? t.value : t.primaryKey), ++r === u ? n({ result: o }) : void t.continue()) : n({ result: o }); }, i.onerror = Bt(e)); }); }), openCursor: function (e) { var c = e.trans, o = e.values, a = e.query, u = e.reverse, l = e.unique; return new Promise(function (t, n) { t = qe(t); var e = a.index, r = a.range, i = c.objectStore(w), i = e.isPrimaryKey ? i : i.index(e.name), e = u ? l ? "prevunique" : "prev" : l ? "nextunique" : "next", s = !o && "openKeyCursor" in i ? i.openKeyCursor(_(r), e) : i.openCursor(_(r), e); s.onerror = Bt(n), s.onsuccess = qe(function (e) { var r, i, o, a, u = s.result; u ? (u.___id = ++Gt, u.done = !1, r = u.continue.bind(u), i = (i = u.continuePrimaryKey) && i.bind(u), o = u.advance.bind(u), a = function () { throw new Error("Cursor not stopped"); }, u.trans = c, u.stop = u.continue = u.continuePrimaryKey = u.advance = function () { throw new Error("Cursor not started"); }, u.fail = qe(n), u.next = function () { var e = this, t = 1; return this.start(function () { return t-- ? e.continue() : e.stop(); }).then(function () { return e; }); }, u.start = function (e) { function t() { if (s.result)
            try {
                e();
            }
            catch (e) {
                u.fail(e);
            }
        else
            u.done = !0, u.start = function () { throw new Error("Cursor behind last entry"); }, u.stop(); } var n = new Promise(function (t, e) { t = qe(t), s.onerror = Bt(e), u.fail = e, u.stop = function (e) { u.stop = u.continue = u.continuePrimaryKey = u.advance = a, t(e); }; }); return s.onsuccess = qe(function (e) { s.onsuccess = t, t(); }), u.continue = r, u.continuePrimaryKey = i, u.advance = o, t(), n; }, t(u)) : t(null); }, n); }); }, count: function (e) { var t = e.query, i = e.trans, o = t.index, a = t.range; return new Promise(function (t, e) { var n = i.objectStore(w), r = o.isPrimaryKey ? n : n.index(o.name), n = _(a), r = n ? r.count(n) : r.count(); r.onsuccess = qe(function (e) { return t(e.target.result); }), r.onerror = Bt(e); }); } }; } var r, o, a, u = (o = t, a = Qt((r = e).objectStoreNames), { schema: { name: r.name, tables: a.map(function (e) { return o.objectStore(e); }).map(function (t) { var e = t.keyPath, n = t.autoIncrement, r = k(e), i = {}, n = { name: t.name, primaryKey: { name: null, isPrimaryKey: !0, outbound: null == e, compound: r, keyPath: e, autoIncrement: n, unique: !0, extractKey: $t(e) }, indexes: Qt(t.indexNames).map(function (e) { return t.index(e); }).map(function (e) { var t = e.name, n = e.unique, r = e.multiEntry, e = e.keyPath, r = { name: t, compound: k(e), keyPath: e, unique: n, multiEntry: r, extractKey: $t(e) }; return i[Xt(e)] = r; }), getIndexByKeyPath: function (e) { return i[Xt(e)]; } }; return i[":id"] = n.primaryKey, null != e && (i[Xt(e)] = n.primaryKey), n; }) }, hasGetAll: 0 < a.length && "getAll" in o.objectStore(a[0]) && !("undefined" != typeof navigator && /Safari/.test(navigator.userAgent) && !/(Chrome\/|Edge\/)/.test(navigator.userAgent) && [].concat(navigator.userAgent.match(/Safari\/(\d*)/))[1] < 604) }), t = u.schema, s = u.hasGetAll, u = t.tables.map(n), c = {}; return u.forEach(function (e) { return c[e.name] = e; }), { stack: "dbcore", transaction: e.transaction.bind(e), table: function (e) { if (!c[e])
            throw new Error("Table '".concat(e, "' not found")); return c[e]; }, MIN_KEY: -1 / 0, MAX_KEY: Yt(i), schema: t }; }
    function Jt(e, t, n, r) { var i = n.IDBKeyRange; return n.indexedDB, { dbcore: (r = Ht(t, i, r), e.dbcore.reduce(function (e, t) { t = t.create; return _(_({}, e), t(e)); }, r)) }; }
    function Zt(n, e) { var t = e.db, e = Jt(n._middlewares, t, n._deps, e); n.core = e.dbcore, n.tables.forEach(function (e) { var t = e.name; n.core.schema.tables.some(function (e) { return e.name === t; }) && (e.core = n.core.table(t), n[t] instanceof n.Table && (n[t].core = e.core)); }); }
    function en(i, e, t, o) { t.forEach(function (n) { var r = o[n]; e.forEach(function (e) { var t = function e(t, n) { return h(t, n) || (t = c(t)) && e(t, n); }(e, n); (!t || "value" in t && void 0 === t.value) && (e === i.Transaction.prototype || e instanceof i.Transaction ? l(e, n, { get: function () { return this.table(n); }, set: function (e) { u(this, n, { value: e, writable: !0, configurable: !0, enumerable: !0 }); } }) : e[n] = new i.Table(n, r)); }); }); }
    function tn(n, e) { e.forEach(function (e) { for (var t in e)
        e[t] instanceof n.Table && delete e[t]; }); }
    function nn(e, t) { return e._cfg.version - t._cfg.version; }
    function rn(n, r, i, e) { var o = n._dbSchema; i.objectStoreNames.contains("$meta") && !o.$meta && (o.$meta = Wt("$meta", hn("")[0], []), n._storeNames.push("$meta")); var a = n._createTransaction("readwrite", n._storeNames, o); a.create(i), a._completion.catch(e); var u = a._reject.bind(a), s = me.transless || me; Ne(function () { return me.trans = a, me.transless = s, 0 !== r ? (Zt(n, i), t = r, ((e = a).storeNames.includes("$meta") ? e.table("$meta").get("version").then(function (e) { return null != e ? e : t; }) : _e.resolve(t)).then(function (e) { return c = e, l = a, f = i, t = [], e = (s = n)._versions, h = s._dbSchema = ln(0, s.idbdb, f), 0 !== (e = e.filter(function (e) { return e._cfg.version >= c; })).length ? (e.forEach(function (u) { t.push(function () { var t = h, e = u._cfg.dbschema; fn(s, t, f), fn(s, e, f), h = s._dbSchema = e; var n = an(t, e); n.add.forEach(function (e) { un(f, e[0], e[1].primKey, e[1].indexes); }), n.change.forEach(function (e) { if (e.recreate)
        throw new Y.Upgrade("Not yet support for changing primary key"); var t = f.objectStore(e.name); e.add.forEach(function (e) { return cn(t, e); }), e.change.forEach(function (e) { t.deleteIndex(e.name), cn(t, e); }), e.del.forEach(function (e) { return t.deleteIndex(e); }); }); var r = u._cfg.contentUpgrade; if (r && u._cfg.version > c) {
        Zt(s, f), l._memoizedTables = {};
        var i = g(e);
        n.del.forEach(function (e) { i[e] = t[e]; }), tn(s, [s.Transaction.prototype]), en(s, [s.Transaction.prototype], x(i), i), l.schema = i;
        var o, a = B(r);
        a && Le();
        n = _e.follow(function () { var e; (o = r(l)) && a && (e = Ue.bind(null, null), o.then(e, e)); });
        return o && "function" == typeof o.then ? _e.resolve(o) : n.then(function () { return o; });
    } }), t.push(function (e) { var t, n, r = u._cfg.dbschema; t = r, n = e, [].slice.call(n.db.objectStoreNames).forEach(function (e) { return null == t[e] && n.db.deleteObjectStore(e); }), tn(s, [s.Transaction.prototype]), en(s, [s.Transaction.prototype], s._storeNames, s._dbSchema), l.schema = s._dbSchema; }), t.push(function (e) { s.idbdb.objectStoreNames.contains("$meta") && (Math.ceil(s.idbdb.version / 10) === u._cfg.version ? (s.idbdb.deleteObjectStore("$meta"), delete s._dbSchema.$meta, s._storeNames = s._storeNames.filter(function (e) { return "$meta" !== e; })) : e.objectStore("$meta").put(u._cfg.version, "version")); }); }), function e() { return t.length ? _e.resolve(t.shift()(l.idbtrans)).then(e) : _e.resolve(); }().then(function () { sn(h, f); })) : _e.resolve(); var s, c, l, f, t, h; }).catch(u)) : (x(o).forEach(function (e) { un(i, e, o[e].primKey, o[e].indexes); }), Zt(n, i), void _e.follow(function () { return n.on.populate.fire(a); }).catch(u)); var e, t; }); }
    function on(e, r) { sn(e._dbSchema, r), r.db.version % 10 != 0 || r.objectStoreNames.contains("$meta") || r.db.createObjectStore("$meta").add(Math.ceil(r.db.version / 10 - 1), "version"); var t = ln(0, e.idbdb, r); fn(e, e._dbSchema, r); for (var n = 0, i = an(t, e._dbSchema).change; n < i.length; n++) {
        var o = function (t) { if (t.change.length || t.recreate)
            return console.warn("Unable to patch indexes of table ".concat(t.name, " because it has changes on the type of index or primary key.")), { value: void 0 }; var n = r.objectStore(t.name); t.add.forEach(function (e) { ie && console.debug("Dexie upgrade patch: Creating missing index ".concat(t.name, ".").concat(e.src)), cn(n, e); }); }(i[n]);
        if ("object" == typeof o)
            return o.value;
    } }
    function an(e, t) { var n, r = { del: [], add: [], change: [] }; for (n in e)
        t[n] || r.del.push(n); for (n in t) {
        var i = e[n], o = t[n];
        if (i) {
            var a = { name: n, def: o, recreate: !1, del: [], add: [], change: [] };
            if ("" + (i.primKey.keyPath || "") != "" + (o.primKey.keyPath || "") || i.primKey.auto !== o.primKey.auto)
                a.recreate = !0, r.change.push(a);
            else {
                var u = i.idxByName, s = o.idxByName, c = void 0;
                for (c in u)
                    s[c] || a.del.push(c);
                for (c in s) {
                    var l = u[c], f = s[c];
                    l ? l.src !== f.src && a.change.push(f) : a.add.push(f);
                }
                (0 < a.del.length || 0 < a.add.length || 0 < a.change.length) && r.change.push(a);
            }
        }
        else
            r.add.push([n, o]);
    } return r; }
    function un(e, t, n, r) { var i = e.db.createObjectStore(t, n.keyPath ? { keyPath: n.keyPath, autoIncrement: n.auto } : { autoIncrement: n.auto }); return r.forEach(function (e) { return cn(i, e); }), i; }
    function sn(t, n) { x(t).forEach(function (e) { n.db.objectStoreNames.contains(e) || (ie && console.debug("Dexie: Creating missing table", e), un(n, e, t[e].primKey, t[e].indexes)); }); }
    function cn(e, t) { e.createIndex(t.name, t.keyPath, { unique: t.unique, multiEntry: t.multi }); }
    function ln(e, t, u) { var s = {}; return b(t.objectStoreNames, 0).forEach(function (e) { for (var t = u.objectStore(e), n = Vt(zt(a = t.keyPath), a || "", !0, !1, !!t.autoIncrement, a && "string" != typeof a, !0), r = [], i = 0; i < t.indexNames.length; ++i) {
        var o = t.index(t.indexNames[i]), a = o.keyPath, o = Vt(o.name, a, !!o.unique, !!o.multiEntry, !1, a && "string" != typeof a, !1);
        r.push(o);
    } s[e] = Wt(e, n, r); }), s; }
    function fn(e, t, n) { for (var r = n.db.objectStoreNames, i = 0; i < r.length; ++i) {
        var o = r[i], a = n.objectStore(o);
        e._hasGetAll = "getAll" in a;
        for (var u = 0; u < a.indexNames.length; ++u) {
            var s = a.indexNames[u], c = a.index(s).keyPath, l = "string" == typeof c ? c : "[" + b(c).join("+") + "]";
            !t[o] || (c = t[o].idxByName[l]) && (c.name = s, delete t[o].idxByName[l], t[o].idxByName[s] = c);
        }
    } "undefined" != typeof navigator && /Safari/.test(navigator.userAgent) && !/(Chrome\/|Edge\/)/.test(navigator.userAgent) && f.WorkerGlobalScope && f instanceof f.WorkerGlobalScope && [].concat(navigator.userAgent.match(/Safari\/(\d*)/))[1] < 604 && (e._hasGetAll = !1); }
    function hn(e) { return e.split(",").map(function (e, t) { var n = (e = e.trim()).replace(/([&*]|\+\+)/g, ""), r = /^\[/.test(n) ? n.match(/^\[(.*)\]$/)[1].split("+") : n; return Vt(n, r || null, /\&/.test(e), /\*/.test(e), /\+\+/.test(e), k(r), 0 === t); }); }
    var dn = (pn.prototype._parseStoresSpec = function (r, i) { x(r).forEach(function (e) { if (null !== r[e]) {
        var t = hn(r[e]), n = t.shift();
        if (n.unique = !0, n.multi)
            throw new Y.Schema("Primary key cannot be multi-valued");
        t.forEach(function (e) { if (e.auto)
            throw new Y.Schema("Only primary key can be marked as autoIncrement (++)"); if (!e.keyPath)
            throw new Y.Schema("Index must have a name and cannot be an empty string"); }), i[e] = Wt(e, n, t);
    } }); }, pn.prototype.stores = function (e) { var t = this.db; this._cfg.storesSource = this._cfg.storesSource ? a(this._cfg.storesSource, e) : e; var e = t._versions, n = {}, r = {}; return e.forEach(function (e) { a(n, e._cfg.storesSource), r = e._cfg.dbschema = {}, e._parseStoresSpec(n, r); }), t._dbSchema = r, tn(t, [t._allTables, t, t.Transaction.prototype]), en(t, [t._allTables, t, t.Transaction.prototype, this._cfg.tables], x(r), r), t._storeNames = x(r), this; }, pn.prototype.upgrade = function (e) { return this._cfg.contentUpgrade = re(this._cfg.contentUpgrade || G, e), this; }, pn);
    function pn() { }
    function yn(e, t) { var n = e._dbNamesDB; return n || (n = e._dbNamesDB = new er(tt, { addons: [], indexedDB: e, IDBKeyRange: t })).version(1).stores({ dbnames: "name" }), n.table("dbnames"); }
    function vn(e) { return e && "function" == typeof e.databases; }
    function mn(e) { return Ne(function () { return me.letThrough = !0, e(); }); }
    function bn(e) { return !("from" in e); }
    var gn = function (e, t) { if (!this) {
        var n = new gn;
        return e && "d" in e && a(n, e), n;
    } a(this, arguments.length ? { d: 1, from: e, to: 1 < arguments.length ? t : e } : { d: 0 }); };
    function wn(e, t, n) { var r = st(t, n); if (!isNaN(r)) {
        if (0 < r)
            throw RangeError();
        if (bn(e))
            return a(e, { from: t, to: n, d: 1 });
        var i = e.l, r = e.r;
        if (st(n, e.from) < 0)
            return i ? wn(i, t, n) : e.l = { from: t, to: n, d: 1, l: null, r: null }, On(e);
        if (0 < st(t, e.to))
            return r ? wn(r, t, n) : e.r = { from: t, to: n, d: 1, l: null, r: null }, On(e);
        st(t, e.from) < 0 && (e.from = t, e.l = null, e.d = r ? r.d + 1 : 1), 0 < st(n, e.to) && (e.to = n, e.r = null, e.d = e.l ? e.l.d + 1 : 1);
        n = !e.r;
        i && !e.l && _n(e, i), r && n && _n(e, r);
    } }
    function _n(e, t) { bn(t) || function e(t, n) { var r = n.from, i = n.to, o = n.l, n = n.r; wn(t, r, i), o && e(t, o), n && e(t, n); }(e, t); }
    function xn(e, t) { var n = kn(t), r = n.next(); if (r.done)
        return !1; for (var i = r.value, o = kn(e), a = o.next(i.from), u = a.value; !r.done && !a.done;) {
        if (st(u.from, i.to) <= 0 && 0 <= st(u.to, i.from))
            return !0;
        st(i.from, u.from) < 0 ? i = (r = n.next(u.from)).value : u = (a = o.next(i.from)).value;
    } return !1; }
    function kn(e) { var n = bn(e) ? null : { s: 0, n: e }; return { next: function (e) { for (var t = 0 < arguments.length; n;)
            switch (n.s) {
                case 0: if (n.s = 1, t)
                    for (; n.n.l && st(e, n.n.from) < 0;)
                        n = { up: n, n: n.n.l, s: 1 };
                else
                    for (; n.n.l;)
                        n = { up: n, n: n.n.l, s: 1 };
                case 1: if (n.s = 2, !t || st(e, n.n.to) <= 0)
                    return { value: n.n, done: !1 };
                case 2: if (n.n.r) {
                    n.s = 3, n = { up: n, n: n.n.r, s: 0 };
                    continue;
                }
                case 3: n = n.up;
            } return { done: !0 }; } }; }
    function On(e) { var t, n, r = ((null === (t = e.r) || void 0 === t ? void 0 : t.d) || 0) - ((null === (n = e.l) || void 0 === n ? void 0 : n.d) || 0), i = 1 < r ? "r" : r < -1 ? "l" : ""; i && (t = "r" == i ? "l" : "r", n = _({}, e), r = e[i], e.from = r.from, e.to = r.to, e[i] = r[i], n[i] = r[t], (e[t] = n).d = Pn(n)), e.d = Pn(e); }
    function Pn(e) { var t = e.r, e = e.l; return (t ? e ? Math.max(t.d, e.d) : t.d : e ? e.d : 0) + 1; }
    function Kn(t, n) { return x(n).forEach(function (e) { t[e] ? _n(t[e], n[e]) : t[e] = function e(t) { var n, r, i = {}; for (n in t)
        m(t, n) && (r = t[n], i[n] = !r || "object" != typeof r || K.has(r.constructor) ? r : e(r)); return i; }(n[e]); }), t; }
    function En(t, n) { return t.all || n.all || Object.keys(t).some(function (e) { return n[e] && xn(n[e], t[e]); }); }
    r(gn.prototype, ((F = { add: function (e) { return _n(this, e), this; }, addKey: function (e) { return wn(this, e, e), this; }, addKeys: function (e) { var t = this; return e.forEach(function (e) { return wn(t, e, e); }), this; }, hasKey: function (e) { var t = kn(this).next(e).value; return t && st(t.from, e) <= 0 && 0 <= st(t.to, e); } })[C] = function () { return kn(this); }, F));
    var Sn = {}, jn = {}, An = !1;
    function Cn(e) { Kn(jn, e), An || (An = !0, setTimeout(function () { An = !1, Tn(jn, !(jn = {})); }, 0)); }
    function Tn(e, t) { void 0 === t && (t = !1); var n = new Set; if (e.all)
        for (var r = 0, i = Object.values(Sn); r < i.length; r++)
            qn(a = i[r], e, n, t);
    else
        for (var o in e) {
            var a, u = /^idb\:\/\/(.*)\/(.*)\//.exec(o);
            u && (o = u[1], u = u[2], (a = Sn["idb://".concat(o, "/").concat(u)]) && qn(a, e, n, t));
        } n.forEach(function (e) { return e(); }); }
    function qn(e, t, n, r) { for (var i = [], o = 0, a = Object.entries(e.queries.query); o < a.length; o++) {
        for (var u = a[o], s = u[0], c = [], l = 0, f = u[1]; l < f.length; l++) {
            var h = f[l];
            En(t, h.obsSet) ? h.subscribers.forEach(function (e) { return n.add(e); }) : r && c.push(h);
        }
        r && i.push([s, c]);
    } if (r)
        for (var d = 0, p = i; d < p.length; d++) {
            var y = p[d], s = y[0], c = y[1];
            e.queries.query[s] = c;
        } }
    function Dn(f) { var h = f._state, r = f._deps.indexedDB; if (h.isBeingOpened || f.idbdb)
        return h.dbReadyPromise.then(function () { return h.dbOpenError ? Xe(h.dbOpenError) : f; }); h.isBeingOpened = !0, h.dbOpenError = null, h.openComplete = !1; var t = h.openCanceller, d = Math.round(10 * f.verno), p = !1; function e() { if (h.openCanceller !== t)
        throw new Y.DatabaseClosed("db.open() was cancelled"); } function y() { return new _e(function (s, n) { if (e(), !r)
        throw new Y.MissingAPI; var c = f.name, l = h.autoSchema || !d ? r.open(c) : r.open(c, d); if (!l)
        throw new Y.MissingAPI; l.onerror = Bt(n), l.onblocked = qe(f._fireOnBlocked), l.onupgradeneeded = qe(function (e) { var t; v = l.transaction, h.autoSchema && !f._options.allowEmptyDB ? (l.onerror = Rt, v.abort(), l.result.close(), (t = r.deleteDatabase(c)).onsuccess = t.onerror = qe(function () { n(new Y.NoSuchDatabase("Database ".concat(c, " doesnt exist"))); })) : (v.onerror = Bt(n), e = e.oldVersion > Math.pow(2, 62) ? 0 : e.oldVersion, m = e < 1, f.idbdb = l.result, p && on(f, v), rn(f, e / 10, v, n)); }, n), l.onsuccess = qe(function () { v = null; var e, t, n, r, i, o = f.idbdb = l.result, a = b(o.objectStoreNames); if (0 < a.length)
        try {
            var u = o.transaction(1 === (r = a).length ? r[0] : r, "readonly");
            if (h.autoSchema)
                t = o, n = u, (e = f).verno = t.version / 10, n = e._dbSchema = ln(0, t, n), e._storeNames = b(t.objectStoreNames, 0), en(e, [e._allTables], x(n), n);
            else if (fn(f, f._dbSchema, u), ((i = an(ln(0, (i = f).idbdb, u), i._dbSchema)).add.length || i.change.some(function (e) { return e.add.length || e.change.length; })) && !p)
                return console.warn("Dexie SchemaDiff: Schema was extended without increasing the number passed to db.version(). Dexie will add missing parts and increment native version number to workaround this."), o.close(), d = o.version + 1, p = !0, s(y());
            Zt(f, u);
        }
        catch (e) { } et.push(f), o.onversionchange = qe(function (e) { h.vcFired = !0, f.on("versionchange").fire(e); }), o.onclose = qe(function (e) { f.on("close").fire(e); }), m && (i = f._deps, u = c, o = i.indexedDB, i = i.IDBKeyRange, vn(o) || u === tt || yn(o, i).put({ name: u }).catch(G)), s(); }, n); }).catch(function (e) { switch (null == e ? void 0 : e.name) {
        case "UnknownError":
            if (0 < h.PR1398_maxLoop)
                return h.PR1398_maxLoop--, console.warn("Dexie: Workaround for Chrome UnknownError on open()"), y();
            break;
        case "VersionError": if (0 < d)
            return d = 0, y();
    } return _e.reject(e); }); } var n, i = h.dbReadyResolve, v = null, m = !1; return _e.race([t, ("undefined" == typeof navigator ? _e.resolve() : !navigator.userAgentData && /Safari\//.test(navigator.userAgent) && !/Chrom(e|ium)\//.test(navigator.userAgent) && indexedDB.databases ? new Promise(function (e) { function t() { return indexedDB.databases().finally(e); } n = setInterval(t, 100), t(); }).finally(function () { return clearInterval(n); }) : Promise.resolve()).then(y)]).then(function () { return e(), h.onReadyBeingFired = [], _e.resolve(mn(function () { return f.on.ready.fire(f.vip); })).then(function e() { if (0 < h.onReadyBeingFired.length) {
        var t = h.onReadyBeingFired.reduce(re, G);
        return h.onReadyBeingFired = [], _e.resolve(mn(function () { return t(f.vip); })).then(e);
    } }); }).finally(function () { h.openCanceller === t && (h.onReadyBeingFired = null, h.isBeingOpened = !1); }).catch(function (e) { h.dbOpenError = e; try {
        v && v.abort();
    }
    catch (e) { } return t === h.openCanceller && f._close(), Xe(e); }).finally(function () { h.openComplete = !0, i(); }).then(function () { var n; return m && (n = {}, f.tables.forEach(function (t) { t.schema.indexes.forEach(function (e) { e.name && (n["idb://".concat(f.name, "/").concat(t.name, "/").concat(e.name)] = new gn(-1 / 0, [[[]]])); }), n["idb://".concat(f.name, "/").concat(t.name, "/")] = n["idb://".concat(f.name, "/").concat(t.name, "/:dels")] = new gn(-1 / 0, [[[]]]); }), Nt(Ft).fire(n), Tn(n, !0)), f; }); }
    function In(t) { function e(e) { return t.next(e); } var r = n(e), i = n(function (e) { return t.throw(e); }); function n(n) { return function (e) { var t = n(e), e = t.value; return t.done ? e : e && "function" == typeof e.then ? e.then(r, i) : k(e) ? Promise.all(e).then(r, i) : r(e); }; } return n(e)(); }
    function Bn(e, t, n) { for (var r = k(e) ? e.slice() : [e], i = 0; i < n; ++i)
        r.push(t); return r; }
    var Rn = { stack: "dbcore", name: "VirtualIndexMiddleware", level: 1, create: function (f) { return _(_({}, f), { table: function (e) { var a = f.table(e), t = a.schema, u = {}, s = []; function c(e, t, n) { var r = Xt(e), i = u[r] = u[r] || [], o = null == e ? 0 : "string" == typeof e ? 1 : e.length, a = 0 < t, a = _(_({}, n), { name: a ? "".concat(r, "(virtual-from:").concat(n.name, ")") : n.name, lowLevelIndex: n, isVirtual: a, keyTail: t, keyLength: o, extractKey: $t(e), unique: !a && n.unique }); return i.push(a), a.isPrimaryKey || s.push(a), 1 < o && c(2 === o ? e[0] : e.slice(0, o - 1), t + 1, n), i.sort(function (e, t) { return e.keyTail - t.keyTail; }), a; } e = c(t.primaryKey.keyPath, 0, t.primaryKey); u[":id"] = [e]; for (var n = 0, r = t.indexes; n < r.length; n++) {
                var i = r[n];
                c(i.keyPath, 0, i);
            } function l(e) { var t, n = e.query.index; return n.isVirtual ? _(_({}, e), { query: { index: n.lowLevelIndex, range: (t = e.query.range, n = n.keyTail, { type: 1 === t.type ? 2 : t.type, lower: Bn(t.lower, t.lowerOpen ? f.MAX_KEY : f.MIN_KEY, n), lowerOpen: !0, upper: Bn(t.upper, t.upperOpen ? f.MIN_KEY : f.MAX_KEY, n), upperOpen: !0 }) } }) : e; } return _(_({}, a), { schema: _(_({}, t), { primaryKey: e, indexes: s, getIndexByKeyPath: function (e) { return (e = u[Xt(e)]) && e[0]; } }), count: function (e) { return a.count(l(e)); }, query: function (e) { return a.query(l(e)); }, openCursor: function (t) { var e = t.query.index, r = e.keyTail, n = e.isVirtual, i = e.keyLength; return n ? a.openCursor(l(t)).then(function (e) { return e && o(e); }) : a.openCursor(t); function o(n) { return Object.create(n, { continue: { value: function (e) { null != e ? n.continue(Bn(e, t.reverse ? f.MAX_KEY : f.MIN_KEY, r)) : t.unique ? n.continue(n.key.slice(0, i).concat(t.reverse ? f.MIN_KEY : f.MAX_KEY, r)) : n.continue(); } }, continuePrimaryKey: { value: function (e, t) { n.continuePrimaryKey(Bn(e, f.MAX_KEY, r), t); } }, primaryKey: { get: function () { return n.primaryKey; } }, key: { get: function () { var e = n.key; return 1 === i ? e[0] : e.slice(0, i); } }, value: { get: function () { return n.value; } } }); } } }); } }); } };
    function Fn(i, o, a, u) { return a = a || {}, u = u || "", x(i).forEach(function (e) { var t, n, r; m(o, e) ? (t = i[e], n = o[e], "object" == typeof t && "object" == typeof n && t && n ? (r = A(t)) !== A(n) ? a[u + e] = o[e] : "Object" === r ? Fn(t, n, a, u + e + ".") : t !== n && (a[u + e] = o[e]) : t !== n && (a[u + e] = o[e])) : a[u + e] = void 0; }), x(o).forEach(function (e) { m(i, e) || (a[u + e] = o[e]); }), a; }
    function Mn(e, t) { return "delete" === t.type ? t.keys : t.keys || t.values.map(e.extractKey); }
    var Nn = { stack: "dbcore", name: "HooksMiddleware", level: 2, create: function (e) { return _(_({}, e), { table: function (r) { var y = e.table(r), v = y.schema.primaryKey; return _(_({}, y), { mutate: function (e) { var t = me.trans, n = t.table(r).hook, h = n.deleting, d = n.creating, p = n.updating; switch (e.type) {
                    case "add":
                        if (d.fire === G)
                            break;
                        return t._promise("readwrite", function () { return a(e); }, !0);
                    case "put":
                        if (d.fire === G && p.fire === G)
                            break;
                        return t._promise("readwrite", function () { return a(e); }, !0);
                    case "delete":
                        if (h.fire === G)
                            break;
                        return t._promise("readwrite", function () { return a(e); }, !0);
                    case "deleteRange":
                        if (h.fire === G)
                            break;
                        return t._promise("readwrite", function () { return function n(r, i, o) { return y.query({ trans: r, values: !1, query: { index: v, range: i }, limit: o }).then(function (e) { var t = e.result; return a({ type: "delete", keys: t, trans: r }).then(function (e) { return 0 < e.numFailures ? Promise.reject(e.failures[0]) : t.length < o ? { failures: [], numFailures: 0, lastResult: void 0 } : n(r, _(_({}, i), { lower: t[t.length - 1], lowerOpen: !0 }), o); }); }); }(e.trans, e.range, 1e4); }, !0);
                } return y.mutate(e); function a(c) { var e, t, n, l = me.trans, f = c.keys || Mn(v, c); if (!f)
                    throw new Error("Keys missing"); return "delete" !== (c = "add" === c.type || "put" === c.type ? _(_({}, c), { keys: f }) : _({}, c)).type && (c.values = i([], c.values, !0)), c.keys && (c.keys = i([], c.keys, !0)), e = y, n = f, ("add" === (t = c).type ? Promise.resolve([]) : e.getMany({ trans: t.trans, keys: n, cache: "immutable" })).then(function (u) { var s = f.map(function (e, t) { var n, r, i, o = u[t], a = { onerror: null, onsuccess: null }; return "delete" === c.type ? h.fire.call(a, e, o, l) : "add" === c.type || void 0 === o ? (n = d.fire.call(a, e, c.values[t], l), null == e && null != n && (c.keys[t] = e = n, v.outbound || P(c.values[t], v.keyPath, e))) : (n = Fn(o, c.values[t]), (r = p.fire.call(a, n, e, o, l)) && (i = c.values[t], Object.keys(r).forEach(function (e) { m(i, e) ? i[e] = r[e] : P(i, e, r[e]); }))), a; }); return y.mutate(c).then(function (e) { for (var t = e.failures, n = e.results, r = e.numFailures, e = e.lastResult, i = 0; i < f.length; ++i) {
                    var o = (n || f)[i], a = s[i];
                    null == o ? a.onerror && a.onerror(t[i]) : a.onsuccess && a.onsuccess("put" === c.type && u[i] ? c.values[i] : o);
                } return { failures: t, results: n, numFailures: r, lastResult: e }; }).catch(function (t) { return s.forEach(function (e) { return e.onerror && e.onerror(t); }), Promise.reject(t); }); }); } } }); } }); } };
    function Ln(e, t, n) { try {
        if (!t)
            return null;
        if (t.keys.length < e.length)
            return null;
        for (var r = [], i = 0, o = 0; i < t.keys.length && o < e.length; ++i)
            0 === st(t.keys[i], e[o]) && (r.push(n ? S(t.values[i]) : t.values[i]), ++o);
        return r.length === e.length ? r : null;
    }
    catch (e) {
        return null;
    } }
    var Un = { stack: "dbcore", level: -1, create: function (t) { return { table: function (e) { var n = t.table(e); return _(_({}, n), { getMany: function (t) { if (!t.cache)
                    return n.getMany(t); var e = Ln(t.keys, t.trans._cache, "clone" === t.cache); return e ? _e.resolve(e) : n.getMany(t).then(function (e) { return t.trans._cache = { keys: t.keys, values: "clone" === t.cache ? S(e) : e }, e; }); }, mutate: function (e) { return "add" !== e.type && (e.trans._cache = null), n.mutate(e); } }); } }; } };
    function Vn(e, t) { return "readonly" === e.trans.mode && !!e.subscr && !e.trans.explicit && "disabled" !== e.trans.db._options.cache && !t.schema.primaryKey.outbound; }
    function zn(e, t) { switch (e) {
        case "query": return t.values && !t.unique;
        case "get":
        case "getMany":
        case "count":
        case "openCursor": return !1;
    } }
    var Wn = { stack: "dbcore", level: 0, name: "Observability", create: function (b) { var g = b.schema.name, w = new gn(b.MIN_KEY, b.MAX_KEY); return _(_({}, b), { transaction: function (e, t, n) { if (me.subscr && "readonly" !== t)
                throw new Y.ReadOnly("Readwrite transaction in liveQuery context. Querier source: ".concat(me.querier)); return b.transaction(e, t, n); }, table: function (d) { var p = b.table(d), y = p.schema, v = y.primaryKey, e = y.indexes, c = v.extractKey, l = v.outbound, m = v.autoIncrement && e.filter(function (e) { return e.compound && e.keyPath.includes(v.keyPath); }), t = _(_({}, p), { mutate: function (a) { function u(e) { return e = "idb://".concat(g, "/").concat(d, "/").concat(e), n[e] || (n[e] = new gn); } var e, o, s, t = a.trans, n = a.mutatedParts || (a.mutatedParts = {}), r = u(""), i = u(":dels"), c = a.type, l = "deleteRange" === a.type ? [a.range] : "delete" === a.type ? [a.keys] : a.values.length < 50 ? [Mn(v, a).filter(function (e) { return e; }), a.values] : [], f = l[0], h = l[1], l = a.trans._cache; return k(f) ? (r.addKeys(f), (l = "delete" === c || f.length === h.length ? Ln(f, l) : null) || i.addKeys(f), (l || h) && (e = u, o = l, s = h, y.indexes.forEach(function (t) { var n = e(t.name || ""); function r(e) { return null != e ? t.extractKey(e) : null; } function i(e) { return t.multiEntry && k(e) ? e.forEach(function (e) { return n.addKey(e); }) : n.addKey(e); } (o || s).forEach(function (e, t) { var n = o && r(o[t]), t = s && r(s[t]); 0 !== st(n, t) && (null != n && i(n), null != t && i(t)); }); }))) : f ? (h = { from: null !== (h = f.lower) && void 0 !== h ? h : b.MIN_KEY, to: null !== (h = f.upper) && void 0 !== h ? h : b.MAX_KEY }, i.add(h), r.add(h)) : (r.add(w), i.add(w), y.indexes.forEach(function (e) { return u(e.name).add(w); })), p.mutate(a).then(function (o) { return !f || "add" !== a.type && "put" !== a.type || (r.addKeys(o.results), m && m.forEach(function (t) { for (var e = a.values.map(function (e) { return t.extractKey(e); }), n = t.keyPath.findIndex(function (e) { return e === v.keyPath; }), r = 0, i = o.results.length; r < i; ++r)
                    e[r][n] = o.results[r]; u(t.name).addKeys(e); })), t.mutatedParts = Kn(t.mutatedParts || {}, n), o; }); } }), e = function (e) { var t = e.query, e = t.index, t = t.range; return [e, new gn(null !== (e = t.lower) && void 0 !== e ? e : b.MIN_KEY, null !== (t = t.upper) && void 0 !== t ? t : b.MAX_KEY)]; }, f = { get: function (e) { return [v, new gn(e.key)]; }, getMany: function (e) { return [v, (new gn).addKeys(e.keys)]; }, count: e, query: e, openCursor: e }; return x(f).forEach(function (s) { t[s] = function (i) { var e = me.subscr, t = !!e, n = Vn(me, p) && zn(s, i) ? i.obsSet = {} : e; if (t) {
                var r = function (e) { e = "idb://".concat(g, "/").concat(d, "/").concat(e); return n[e] || (n[e] = new gn); }, o = r(""), a = r(":dels"), e = f[s](i), t = e[0], e = e[1];
                if (("query" === s && t.isPrimaryKey && !i.values ? a : r(t.name || "")).add(e), !t.isPrimaryKey) {
                    if ("count" !== s) {
                        var u = "query" === s && l && i.values && p.query(_(_({}, i), { values: !1 }));
                        return p[s].apply(this, arguments).then(function (t) { if ("query" === s) {
                            if (l && i.values)
                                return u.then(function (e) { e = e.result; return o.addKeys(e), t; });
                            var e = i.values ? t.result.map(c) : t.result;
                            (i.values ? o : a).addKeys(e);
                        }
                        else if ("openCursor" === s) {
                            var n = t, r = i.values;
                            return n && Object.create(n, { key: { get: function () { return a.addKey(n.primaryKey), n.key; } }, primaryKey: { get: function () { var e = n.primaryKey; return a.addKey(e), e; } }, value: { get: function () { return r && o.addKey(n.primaryKey), n.value; } } });
                        } return t; });
                    }
                    a.add(w);
                }
            } return p[s].apply(this, arguments); }; }), t; } }); } };
    function Yn(e, t, n) { if (0 === n.numFailures)
        return t; if ("deleteRange" === t.type)
        return null; var r = t.keys ? t.keys.length : "values" in t && t.values ? t.values.length : 1; if (n.numFailures === r)
        return null; t = _({}, t); return k(t.keys) && (t.keys = t.keys.filter(function (e, t) { return !(t in n.failures); })), "values" in t && k(t.values) && (t.values = t.values.filter(function (e, t) { return !(t in n.failures); })), t; }
    function $n(e, t) { return n = e, (void 0 === (r = t).lower || (r.lowerOpen ? 0 < st(n, r.lower) : 0 <= st(n, r.lower))) && (e = e, void 0 === (t = t).upper || (t.upperOpen ? st(e, t.upper) < 0 : st(e, t.upper) <= 0)); var n, r; }
    function Qn(e, d, t, n, r, i) { if (!t || 0 === t.length)
        return e; var o = d.query.index, p = o.multiEntry, y = d.query.range, v = n.schema.primaryKey.extractKey, m = o.extractKey, a = (o.lowLevelIndex || o).extractKey, t = t.reduce(function (e, t) { var n = e, r = []; if ("add" === t.type || "put" === t.type)
        for (var i = new gn, o = t.values.length - 1; 0 <= o; --o) {
            var a, u = t.values[o], s = v(u);
            i.hasKey(s) || (a = m(u), (p && k(a) ? a.some(function (e) { return $n(e, y); }) : $n(a, y)) && (i.addKey(s), r.push(u)));
        } switch (t.type) {
        case "add":
            var c = (new gn).addKeys(d.values ? e.map(function (e) { return v(e); }) : e), n = e.concat(d.values ? r.filter(function (e) { e = v(e); return !c.hasKey(e) && (c.addKey(e), !0); }) : r.map(function (e) { return v(e); }).filter(function (e) { return !c.hasKey(e) && (c.addKey(e), !0); }));
            break;
        case "put":
            var l = (new gn).addKeys(t.values.map(function (e) { return v(e); }));
            n = e.filter(function (e) { return !l.hasKey(d.values ? v(e) : e); }).concat(d.values ? r : r.map(function (e) { return v(e); }));
            break;
        case "delete":
            var f = (new gn).addKeys(t.keys);
            n = e.filter(function (e) { return !f.hasKey(d.values ? v(e) : e); });
            break;
        case "deleteRange":
            var h = t.range;
            n = e.filter(function (e) { return !$n(v(e), h); });
    } return n; }, e); return t === e ? e : (t.sort(function (e, t) { return st(a(e), a(t)) || st(v(e), v(t)); }), d.limit && d.limit < 1 / 0 && (t.length > d.limit ? t.length = d.limit : e.length === d.limit && t.length < d.limit && (r.dirty = !0)), i ? Object.freeze(t) : t); }
    function Gn(e, t) { return 0 === st(e.lower, t.lower) && 0 === st(e.upper, t.upper) && !!e.lowerOpen == !!t.lowerOpen && !!e.upperOpen == !!t.upperOpen; }
    function Xn(e, t) { return function (e, t, n, r) { if (void 0 === e)
        return void 0 !== t ? -1 : 0; if (void 0 === t)
        return 1; if (0 === (t = st(e, t))) {
        if (n && r)
            return 0;
        if (n)
            return 1;
        if (r)
            return -1;
    } return t; }(e.lower, t.lower, e.lowerOpen, t.lowerOpen) <= 0 && 0 <= function (e, t, n, r) { if (void 0 === e)
        return void 0 !== t ? 1 : 0; if (void 0 === t)
        return -1; if (0 === (t = st(e, t))) {
        if (n && r)
            return 0;
        if (n)
            return -1;
        if (r)
            return 1;
    } return t; }(e.upper, t.upper, e.upperOpen, t.upperOpen); }
    function Hn(n, r, i, e) { n.subscribers.add(i), e.addEventListener("abort", function () { var e, t; n.subscribers.delete(i), 0 === n.subscribers.size && (e = n, t = r, setTimeout(function () { 0 === e.subscribers.size && q(t, e); }, 3e3)); }); }
    var Jn = { stack: "dbcore", level: 0, name: "Cache", create: function (k) { var O = k.schema.name; return _(_({}, k), { transaction: function (g, w, e) { var _, t, x = k.transaction(g, w, e); return "readwrite" === w && (t = (_ = new AbortController).signal, e = function (b) { return function () { if (_.abort(), "readwrite" === w) {
                for (var t = new Set, e = 0, n = g; e < n.length; e++) {
                    var r = n[e], i = Sn["idb://".concat(O, "/").concat(r)];
                    if (i) {
                        var o = k.table(r), a = i.optimisticOps.filter(function (e) { return e.trans === x; });
                        if (x._explicit && b && x.mutatedParts)
                            for (var u = 0, s = Object.values(i.queries.query); u < s.length; u++)
                                for (var c = 0, l = (d = s[u]).slice(); c < l.length; c++)
                                    En((p = l[c]).obsSet, x.mutatedParts) && (q(d, p), p.subscribers.forEach(function (e) { return t.add(e); }));
                        else if (0 < a.length) {
                            i.optimisticOps = i.optimisticOps.filter(function (e) { return e.trans !== x; });
                            for (var f = 0, h = Object.values(i.queries.query); f < h.length; f++)
                                for (var d, p, y, v = 0, m = (d = h[f]).slice(); v < m.length; v++)
                                    null != (p = m[v]).res && x.mutatedParts && (b && !p.dirty ? (y = Object.isFrozen(p.res), y = Qn(p.res, p.req, a, o, p, y), p.dirty ? (q(d, p), p.subscribers.forEach(function (e) { return t.add(e); })) : y !== p.res && (p.res = y, p.promise = _e.resolve({ result: y }))) : (p.dirty && q(d, p), p.subscribers.forEach(function (e) { return t.add(e); })));
                        }
                    }
                }
                t.forEach(function (e) { return e(); });
            } }; }, x.addEventListener("abort", e(!1), { signal: t }), x.addEventListener("error", e(!1), { signal: t }), x.addEventListener("complete", e(!0), { signal: t })), x; }, table: function (c) { var l = k.table(c), i = l.schema.primaryKey; return _(_({}, l), { mutate: function (t) { var e = me.trans; if (i.outbound || "disabled" === e.db._options.cache || e.explicit || "readwrite" !== e.idbtrans.mode)
                    return l.mutate(t); var n = Sn["idb://".concat(O, "/").concat(c)]; if (!n)
                    return l.mutate(t); e = l.mutate(t); return "add" !== t.type && "put" !== t.type || !(50 <= t.values.length || Mn(i, t).some(function (e) { return null == e; })) ? (n.optimisticOps.push(t), t.mutatedParts && Cn(t.mutatedParts), e.then(function (e) { 0 < e.numFailures && (q(n.optimisticOps, t), (e = Yn(0, t, e)) && n.optimisticOps.push(e), t.mutatedParts && Cn(t.mutatedParts)); }), e.catch(function () { q(n.optimisticOps, t), t.mutatedParts && Cn(t.mutatedParts); })) : e.then(function (r) { var e = Yn(0, _(_({}, t), { values: t.values.map(function (e, t) { var n; if (r.failures[t])
                        return e; e = null !== (n = i.keyPath) && void 0 !== n && n.includes(".") ? S(e) : _({}, e); return P(e, i.keyPath, r.results[t]), e; }) }), r); n.optimisticOps.push(e), queueMicrotask(function () { return t.mutatedParts && Cn(t.mutatedParts); }); }), e; }, query: function (t) { if (!Vn(me, l) || !zn("query", t))
                    return l.query(t); var i = "immutable" === (null === (o = me.trans) || void 0 === o ? void 0 : o.db._options.cache), e = me, n = e.requery, r = e.signal, o = function (e, t, n, r) { var i = Sn["idb://".concat(e, "/").concat(t)]; if (!i)
                    return []; if (!(t = i.queries[n]))
                    return [null, !1, i, null]; var o = t[(r.query ? r.query.index.name : null) || ""]; if (!o)
                    return [null, !1, i, null]; switch (n) {
                    case "query":
                        var a = o.find(function (e) { return e.req.limit === r.limit && e.req.values === r.values && Gn(e.req.query.range, r.query.range); });
                        return a ? [a, !0, i, o] : [o.find(function (e) { return ("limit" in e.req ? e.req.limit : 1 / 0) >= r.limit && (!r.values || e.req.values) && Xn(e.req.query.range, r.query.range); }), !1, i, o];
                    case "count":
                        a = o.find(function (e) { return Gn(e.req.query.range, r.query.range); });
                        return [a, !!a, i, o];
                } }(O, c, "query", t), a = o[0], e = o[1], u = o[2], s = o[3]; return a && e ? a.obsSet = t.obsSet : (e = l.query(t).then(function (e) { var t = e.result; if (a && (a.res = t), i) {
                    for (var n = 0, r = t.length; n < r; ++n)
                        Object.freeze(t[n]);
                    Object.freeze(t);
                }
                else
                    e.result = S(t); return e; }).catch(function (e) { return s && a && q(s, a), Promise.reject(e); }), a = { obsSet: t.obsSet, promise: e, subscribers: new Set, type: "query", req: t, dirty: !1 }, s ? s.push(a) : (s = [a], (u = u || (Sn["idb://".concat(O, "/").concat(c)] = { queries: { query: {}, count: {} }, objs: new Map, optimisticOps: [], unsignaledParts: {} })).queries.query[t.query.index.name || ""] = s)), Hn(a, s, n, r), a.promise.then(function (e) { return { result: Qn(e.result, t, null == u ? void 0 : u.optimisticOps, l, a, i) }; }); } }); } }); } };
    function Zn(e, r) { return new Proxy(e, { get: function (e, t, n) { return "db" === t ? r : Reflect.get(e, t, n); } }); }
    var er = (tr.prototype.version = function (t) { if (isNaN(t) || t < .1)
        throw new Y.Type("Given version is not a positive number"); if (t = Math.round(10 * t) / 10, this.idbdb || this._state.isBeingOpened)
        throw new Y.Schema("Cannot add version when database is open"); this.verno = Math.max(this.verno, t); var e = this._versions, n = e.filter(function (e) { return e._cfg.version === t; })[0]; return n || (n = new this.Version(t), e.push(n), e.sort(nn), n.stores({}), this._state.autoSchema = !1, n); }, tr.prototype._whenReady = function (e) { var n = this; return this.idbdb && (this._state.openComplete || me.letThrough || this._vip) ? e() : new _e(function (e, t) { if (n._state.openComplete)
        return t(new Y.DatabaseClosed(n._state.dbOpenError)); if (!n._state.isBeingOpened) {
        if (!n._state.autoOpen)
            return void t(new Y.DatabaseClosed);
        n.open().catch(G);
    } n._state.dbReadyPromise.then(e, t); }).then(e); }, tr.prototype.use = function (e) { var t = e.stack, n = e.create, r = e.level, i = e.name; i && this.unuse({ stack: t, name: i }); e = this._middlewares[t] || (this._middlewares[t] = []); return e.push({ stack: t, create: n, level: null == r ? 10 : r, name: i }), e.sort(function (e, t) { return e.level - t.level; }), this; }, tr.prototype.unuse = function (e) { var t = e.stack, n = e.name, r = e.create; return t && this._middlewares[t] && (this._middlewares[t] = this._middlewares[t].filter(function (e) { return r ? e.create !== r : !!n && e.name !== n; })), this; }, tr.prototype.open = function () { var e = this; return $e(ve, function () { return Dn(e); }); }, tr.prototype._close = function () { var n = this._state, e = et.indexOf(this); if (0 <= e && et.splice(e, 1), this.idbdb) {
        try {
            this.idbdb.close();
        }
        catch (e) { }
        this.idbdb = null;
    } n.isBeingOpened || (n.dbReadyPromise = new _e(function (e) { n.dbReadyResolve = e; }), n.openCanceller = new _e(function (e, t) { n.cancelOpen = t; })); }, tr.prototype.close = function (e) { var t = (void 0 === e ? { disableAutoOpen: !0 } : e).disableAutoOpen, e = this._state; t ? (e.isBeingOpened && e.cancelOpen(new Y.DatabaseClosed), this._close(), e.autoOpen = !1, e.dbOpenError = new Y.DatabaseClosed) : (this._close(), e.autoOpen = this._options.autoOpen || e.isBeingOpened, e.openComplete = !1, e.dbOpenError = null); }, tr.prototype.delete = function (n) { var i = this; void 0 === n && (n = { disableAutoOpen: !0 }); var o = 0 < arguments.length && "object" != typeof arguments[0], a = this._state; return new _e(function (r, t) { function e() { i.close(n); var e = i._deps.indexedDB.deleteDatabase(i.name); e.onsuccess = qe(function () { var e, t, n; e = i._deps, t = i.name, n = e.indexedDB, e = e.IDBKeyRange, vn(n) || t === tt || yn(n, e).delete(t).catch(G), r(); }), e.onerror = Bt(t), e.onblocked = i._fireOnBlocked; } if (o)
        throw new Y.InvalidArgument("Invalid closeOptions argument to db.delete()"); a.isBeingOpened ? a.dbReadyPromise.then(e) : e(); }); }, tr.prototype.backendDB = function () { return this.idbdb; }, tr.prototype.isOpen = function () { return null !== this.idbdb; }, tr.prototype.hasBeenClosed = function () { var e = this._state.dbOpenError; return e && "DatabaseClosed" === e.name; }, tr.prototype.hasFailed = function () { return null !== this._state.dbOpenError; }, tr.prototype.dynamicallyOpened = function () { return this._state.autoSchema; }, Object.defineProperty(tr.prototype, "tables", { get: function () { var t = this; return x(this._allTables).map(function (e) { return t._allTables[e]; }); }, enumerable: !1, configurable: !0 }), tr.prototype.transaction = function () { var e = function (e, t, n) { var r = arguments.length; if (r < 2)
        throw new Y.InvalidArgument("Too few arguments"); for (var i = new Array(r - 1); --r;)
        i[r - 1] = arguments[r]; return n = i.pop(), [e, w(i), n]; }.apply(this, arguments); return this._transaction.apply(this, e); }, tr.prototype._transaction = function (e, t, n) { var r = this, i = me.trans; i && i.db === this && -1 === e.indexOf("!") || (i = null); var o, a, u = -1 !== e.indexOf("?"); e = e.replace("!", "").replace("?", ""); try {
        if (a = t.map(function (e) { e = e instanceof r.Table ? e.name : e; if ("string" != typeof e)
            throw new TypeError("Invalid table argument to Dexie.transaction(). Only Table or String are allowed"); return e; }), "r" == e || e === nt)
            o = nt;
        else {
            if ("rw" != e && e != rt)
                throw new Y.InvalidArgument("Invalid transaction mode: " + e);
            o = rt;
        }
        if (i) {
            if (i.mode === nt && o === rt) {
                if (!u)
                    throw new Y.SubTransaction("Cannot enter a sub-transaction with READWRITE mode when parent transaction is READONLY");
                i = null;
            }
            i && a.forEach(function (e) { if (i && -1 === i.storeNames.indexOf(e)) {
                if (!u)
                    throw new Y.SubTransaction("Table " + e + " not included in parent transaction.");
                i = null;
            } }), u && i && !i.active && (i = null);
        }
    }
    catch (n) {
        return i ? i._promise(null, function (e, t) { t(n); }) : Xe(n);
    } var s = function i(o, a, u, s, c) { return _e.resolve().then(function () { var e = me.transless || me, t = o._createTransaction(a, u, o._dbSchema, s); if (t.explicit = !0, e = { trans: t, transless: e }, s)
        t.idbtrans = s.idbtrans;
    else
        try {
            t.create(), t.idbtrans._explicit = !0, o._state.PR1398_maxLoop = 3;
        }
        catch (e) {
            return e.name === z.InvalidState && o.isOpen() && 0 < --o._state.PR1398_maxLoop ? (console.warn("Dexie: Need to reopen db"), o.close({ disableAutoOpen: !1 }), o.open().then(function () { return i(o, a, u, null, c); })) : Xe(e);
        } var n, r = B(c); return r && Le(), e = _e.follow(function () { var e; (n = c.call(t, t)) && (r ? (e = Ue.bind(null, null), n.then(e, e)) : "function" == typeof n.next && "function" == typeof n.throw && (n = In(n))); }, e), (n && "function" == typeof n.then ? _e.resolve(n).then(function (e) { return t.active ? e : Xe(new Y.PrematureCommit("Transaction committed too early. See http://bit.ly/2kdckMn")); }) : e.then(function () { return n; })).then(function (e) { return s && t._resolve(), t._completion.then(function () { return e; }); }).catch(function (e) { return t._reject(e), Xe(e); }); }); }.bind(null, this, o, a, i, n); return i ? i._promise(o, s, "lock") : me.trans ? $e(me.transless, function () { return r._whenReady(s); }) : this._whenReady(s); }, tr.prototype.table = function (e) { if (!m(this._allTables, e))
        throw new Y.InvalidTable("Table ".concat(e, " does not exist")); return this._allTables[e]; }, tr);
    function tr(e, t) { var o = this; this._middlewares = {}, this.verno = 0; var n = tr.dependencies; this._options = t = _({ addons: tr.addons, autoOpen: !0, indexedDB: n.indexedDB, IDBKeyRange: n.IDBKeyRange, cache: "cloned" }, t), this._deps = { indexedDB: t.indexedDB, IDBKeyRange: t.IDBKeyRange }; n = t.addons; this._dbSchema = {}, this._versions = [], this._storeNames = [], this._allTables = {}, this.idbdb = null, this._novip = this; var a, r, u, i, s, c = { dbOpenError: null, isBeingOpened: !1, onReadyBeingFired: null, openComplete: !1, dbReadyResolve: G, dbReadyPromise: null, cancelOpen: G, openCanceller: null, autoSchema: !0, PR1398_maxLoop: 3, autoOpen: t.autoOpen }; c.dbReadyPromise = new _e(function (e) { c.dbReadyResolve = e; }), c.openCanceller = new _e(function (e, t) { c.cancelOpen = t; }), this._state = c, this.name = e, this.on = dt(this, "populate", "blocked", "versionchange", "close", { ready: [re, G] }), this.on.ready.subscribe = p(this.on.ready.subscribe, function (i) { return function (n, r) { tr.vip(function () { var t, e = o._state; e.openComplete ? (e.dbOpenError || _e.resolve().then(n), r && i(n)) : e.onReadyBeingFired ? (e.onReadyBeingFired.push(n), r && i(n)) : (i(n), t = o, r || i(function e() { t.on.ready.unsubscribe(n), t.on.ready.unsubscribe(e); })); }); }; }), this.Collection = (a = this, pt(Ot.prototype, function (e, t) { this.db = a; var n = ot, r = null; if (t)
        try {
            n = t();
        }
        catch (e) {
            r = e;
        } var i = e._ctx, t = i.table, e = t.hook.reading.fire; this._ctx = { table: t, index: i.index, isPrimKey: !i.index || t.schema.primKey.keyPath && i.index === t.schema.primKey.name, range: n, keysOnly: !1, dir: "next", unique: "", algorithm: null, filter: null, replayFilter: null, justLimit: !0, isMatch: null, offset: 0, limit: 1 / 0, error: r, or: i.or, valueMapper: e !== X ? e : null }; })), this.Table = (r = this, pt(ft.prototype, function (e, t, n) { this.db = r, this._tx = n, this.name = e, this.schema = t, this.hook = r._allTables[e] ? r._allTables[e].hook : dt(null, { creating: [Z, G], reading: [H, X], updating: [te, G], deleting: [ee, G] }); })), this.Transaction = (u = this, pt(Lt.prototype, function (e, t, n, r, i) { var o = this; this.db = u, this.mode = e, this.storeNames = t, this.schema = n, this.chromeTransactionDurability = r, this.idbtrans = null, this.on = dt(this, "complete", "error", "abort"), this.parent = i || null, this.active = !0, this._reculock = 0, this._blockedFuncs = [], this._resolve = null, this._reject = null, this._waitingFor = null, this._waitingQueue = null, this._spinCount = 0, this._completion = new _e(function (e, t) { o._resolve = e, o._reject = t; }), this._completion.then(function () { o.active = !1, o.on.complete.fire(); }, function (e) { var t = o.active; return o.active = !1, o.on.error.fire(e), o.parent ? o.parent._reject(e) : t && o.idbtrans && o.idbtrans.abort(), Xe(e); }); })), this.Version = (i = this, pt(dn.prototype, function (e) { this.db = i, this._cfg = { version: e, storesSource: null, dbschema: {}, tables: {}, contentUpgrade: null }; })), this.WhereClause = (s = this, pt(Dt.prototype, function (e, t, n) { if (this.db = s, this._ctx = { table: e, index: ":id" === t ? null : t, or: n }, this._cmp = this._ascending = st, this._descending = function (e, t) { return st(t, e); }, this._max = function (e, t) { return 0 < st(e, t) ? e : t; }, this._min = function (e, t) { return st(e, t) < 0 ? e : t; }, this._IDBKeyRange = s._deps.IDBKeyRange, !this._IDBKeyRange)
        throw new Y.MissingAPI; })), this.on("versionchange", function (e) { 0 < e.newVersion ? console.warn("Another connection wants to upgrade database '".concat(o.name, "'. Closing db now to resume the upgrade.")) : console.warn("Another connection wants to delete database '".concat(o.name, "'. Closing db now to resume the delete request.")), o.close({ disableAutoOpen: !1 }); }), this.on("blocked", function (e) { !e.newVersion || e.newVersion < e.oldVersion ? console.warn("Dexie.delete('".concat(o.name, "') was blocked")) : console.warn("Upgrade '".concat(o.name, "' blocked by other connection holding version ").concat(e.oldVersion / 10)); }), this._maxKey = Yt(t.IDBKeyRange), this._createTransaction = function (e, t, n, r) { return new o.Transaction(e, t, n, o._options.chromeTransactionDurability, r); }, this._fireOnBlocked = function (t) { o.on("blocked").fire(t), et.filter(function (e) { return e.name === o.name && e !== o && !e._state.vcFired; }).map(function (e) { return e.on("versionchange").fire(t); }); }, this.use(Un), this.use(Jn), this.use(Wn), this.use(Rn), this.use(Nn); var l = new Proxy(this, { get: function (e, t, n) { if ("_vip" === t)
            return !0; if ("table" === t)
            return function (e) { return Zn(o.table(e), l); }; var r = Reflect.get(e, t, n); return r instanceof ft ? Zn(r, l) : "tables" === t ? r.map(function (e) { return Zn(e, l); }) : "_createTransaction" === t ? function () { return Zn(r.apply(this, arguments), l); } : r; } }); this.vip = l, n.forEach(function (e) { return e(o); }); }
    var nr, F = "undefined" != typeof Symbol && "observable" in Symbol ? Symbol.observable : "@@observable", rr = (ir.prototype.subscribe = function (e, t, n) { return this._subscribe(e && "function" != typeof e ? e : { next: e, error: t, complete: n }); }, ir.prototype[F] = function () { return this; }, ir);
    function ir(e) { this._subscribe = e; }
    try {
        nr = { indexedDB: f.indexedDB || f.mozIndexedDB || f.webkitIndexedDB || f.msIndexedDB, IDBKeyRange: f.IDBKeyRange || f.webkitIDBKeyRange };
    }
    catch (e) {
        nr = { indexedDB: null, IDBKeyRange: null };
    }
    function or(h) { var d, p = !1, e = new rr(function (r) { var i = B(h); var o, a = !1, u = {}, s = {}, e = { get closed() { return a; }, unsubscribe: function () { a || (a = !0, o && o.abort(), c && Nt.storagemutated.unsubscribe(f)); } }; r.start && r.start(e); var c = !1, l = function () { return Ge(t); }; var f = function (e) { Kn(u, e), En(s, u) && l(); }, t = function () { var t, n, e; !a && nr.indexedDB && (u = {}, t = {}, o && o.abort(), o = new AbortController, e = function (e) { var t = je(); try {
        i && Le();
        var n = Ne(h, e);
        return n = i ? n.finally(Ue) : n;
    }
    finally {
        t && Ae();
    } }(n = { subscr: t, signal: o.signal, requery: l, querier: h, trans: null }), Promise.resolve(e).then(function (e) { p = !0, d = e, a || n.signal.aborted || (u = {}, function (e) { for (var t in e)
        if (m(e, t))
            return; return 1; }(s = t) || c || (Nt(Ft, f), c = !0), Ge(function () { return !a && r.next && r.next(e); })); }, function (e) { p = !1, ["DatabaseClosedError", "AbortError"].includes(null == e ? void 0 : e.name) || a || Ge(function () { a || r.error && r.error(e); }); })); }; return setTimeout(l, 0), e; }); return e.hasValue = function () { return p; }, e.getValue = function () { return d; }, e; }
    var ar = er;
    function ur(e) { var t = cr; try {
        cr = !0, Nt.storagemutated.fire(e), Tn(e, !0);
    }
    finally {
        cr = t;
    } }
    r(ar, _(_({}, Q), { delete: function (e) { return new ar(e, { addons: [] }).delete(); }, exists: function (e) { return new ar(e, { addons: [] }).open().then(function (e) { return e.close(), !0; }).catch("NoSuchDatabaseError", function () { return !1; }); }, getDatabaseNames: function (e) { try {
            return t = ar.dependencies, n = t.indexedDB, t = t.IDBKeyRange, (vn(n) ? Promise.resolve(n.databases()).then(function (e) { return e.map(function (e) { return e.name; }).filter(function (e) { return e !== tt; }); }) : yn(n, t).toCollection().primaryKeys()).then(e);
        }
        catch (e) {
            return Xe(new Y.MissingAPI);
        } var t, n; }, defineClass: function () { return function (e) { a(this, e); }; }, ignoreTransaction: function (e) { return me.trans ? $e(me.transless, e) : e(); }, vip: mn, async: function (t) { return function () { try {
            var e = In(t.apply(this, arguments));
            return e && "function" == typeof e.then ? e : _e.resolve(e);
        }
        catch (e) {
            return Xe(e);
        } }; }, spawn: function (e, t, n) { try {
            var r = In(e.apply(n, t || []));
            return r && "function" == typeof r.then ? r : _e.resolve(r);
        }
        catch (e) {
            return Xe(e);
        } }, currentTransaction: { get: function () { return me.trans || null; } }, waitFor: function (e, t) { t = _e.resolve("function" == typeof e ? ar.ignoreTransaction(e) : e).timeout(t || 6e4); return me.trans ? me.trans.waitFor(t) : t; }, Promise: _e, debug: { get: function () { return ie; }, set: function (e) { oe(e); } }, derive: o, extend: a, props: r, override: p, Events: dt, on: Nt, liveQuery: or, extendObservabilitySet: Kn, getByKeyPath: O, setByKeyPath: P, delByKeyPath: function (t, e) { "string" == typeof e ? P(t, e, void 0) : "length" in e && [].map.call(e, function (e) { P(t, e, void 0); }); }, shallowClone: g, deepClone: S, getObjectDiff: Fn, cmp: st, asap: v, minKey: -1 / 0, addons: [], connections: et, errnames: z, dependencies: nr, cache: Sn, semVer: "4.0.11", version: "4.0.11".split(".").map(function (e) { return parseInt(e); }).reduce(function (e, t, n) { return e + t / Math.pow(10, 2 * n); }) })), ar.maxKey = Yt(ar.dependencies.IDBKeyRange), "undefined" != typeof dispatchEvent && "undefined" != typeof addEventListener && (Nt(Ft, function (e) { cr || (e = new CustomEvent(Mt, { detail: e }), cr = !0, dispatchEvent(e), cr = !1); }), addEventListener(Mt, function (e) { e = e.detail; cr || ur(e); }));
    var sr, cr = !1, lr = function () { };
    return "undefined" != typeof BroadcastChannel && ((lr = function () { (sr = new BroadcastChannel(Mt)).onmessage = function (e) { return e.data && ur(e.data); }; })(), "function" == typeof sr.unref && sr.unref(), Nt(Ft, function (e) { cr || sr.postMessage(e); })), "undefined" != typeof addEventListener && (addEventListener("pagehide", function (e) { if (!er.disableBfCache && e.persisted) {
        ie && console.debug("Dexie: handling persisted pagehide"), null != sr && sr.close();
        for (var t = 0, n = et; t < n.length; t++)
            n[t].close({ disableAutoOpen: !1 });
    } }), addEventListener("pageshow", function (e) { !er.disableBfCache && e.persisted && (ie && console.debug("Dexie: handling persisted pageshow"), lr(), ur({ all: new gn(-1 / 0, [[]]) })); })), _e.rejectionMapper = function (e, t) { return !e || e instanceof N || e instanceof TypeError || e instanceof SyntaxError || !e.name || !$[e.name] ? e : (t = new $[e.name](t || e.message, e), "stack" in e && l(t, "stack", { get: function () { return this.inner.stack; } }), t); }, oe(ie), _(er, Object.freeze({ __proto__: null, Dexie: er, liveQuery: or, Entity: ut, cmp: st, PropModification: xt, replacePrefix: function (e, t) { return new xt({ replacePrefix: [e, t] }); }, add: function (e) { return new xt({ add: e }); }, remove: function (e) { return new xt({ remove: e }); }, default: er, RangeSet: gn, mergeRanges: _n, rangesOverlap: xn }), { default: er }), er;
});
//# sourceMappingURL=dexie.min.js.map
define.nameNext('jsonpath-plus');
!function (e, t) { "object" == typeof exports && "undefined" != typeof module ? t(exports) : "function" == typeof define && define.amd ? define(["exports"], t) : t((e = "undefined" != typeof globalThis ? globalThis : e || self).JSONPath = {}); }(this, (function (e) {
    "use strict";
    class t {
        static get version() { return "1.4.0"; }
        static toString() { return "JavaScript Expression Parser (JSEP) v" + t.version; }
        static addUnaryOp(e) { return t.max_unop_len = Math.max(e.length, t.max_unop_len), t.unary_ops[e] = 1, t; }
        static addBinaryOp(e, r, s) { return t.max_binop_len = Math.max(e.length, t.max_binop_len), t.binary_ops[e] = r, s ? t.right_associative.add(e) : t.right_associative.delete(e), t; }
        static addIdentifierChar(e) { return t.additional_identifier_chars.add(e), t; }
        static addLiteral(e, r) { return t.literals[e] = r, t; }
        static removeUnaryOp(e) { return delete t.unary_ops[e], e.length === t.max_unop_len && (t.max_unop_len = t.getMaxKeyLen(t.unary_ops)), t; }
        static removeAllUnaryOps() { return t.unary_ops = {}, t.max_unop_len = 0, t; }
        static removeIdentifierChar(e) { return t.additional_identifier_chars.delete(e), t; }
        static removeBinaryOp(e) { return delete t.binary_ops[e], e.length === t.max_binop_len && (t.max_binop_len = t.getMaxKeyLen(t.binary_ops)), t.right_associative.delete(e), t; }
        static removeAllBinaryOps() { return t.binary_ops = {}, t.max_binop_len = 0, t; }
        static removeLiteral(e) { return delete t.literals[e], t; }
        static removeAllLiterals() { return t.literals = {}, t; }
        get char() { return this.expr.charAt(this.index); }
        get code() { return this.expr.charCodeAt(this.index); }
        constructor(e) { this.expr = e, this.index = 0; }
        static parse(e) { return new t(e).parse(); }
        static getMaxKeyLen(e) { return Math.max(0, ...Object.keys(e).map((e => e.length))); }
        static isDecimalDigit(e) { return e >= 48 && e <= 57; }
        static binaryPrecedence(e) { return t.binary_ops[e] || 0; }
        static isIdentifierStart(e) { return e >= 65 && e <= 90 || e >= 97 && e <= 122 || e >= 128 && !t.binary_ops[String.fromCharCode(e)] || t.additional_identifier_chars.has(String.fromCharCode(e)); }
        static isIdentifierPart(e) { return t.isIdentifierStart(e) || t.isDecimalDigit(e); }
        throwError(e) { const t = new Error(e + " at character " + this.index); throw t.index = this.index, t.description = e, t; }
        runHook(e, r) { if (t.hooks[e]) {
            const s = { context: this, node: r };
            return t.hooks.run(e, s), s.node;
        } return r; }
        searchHook(e) { if (t.hooks[e]) {
            const r = { context: this };
            return t.hooks[e].find((function (e) { return e.call(r.context, r), r.node; })), r.node;
        } }
        gobbleSpaces() { let e = this.code; for (; e === t.SPACE_CODE || e === t.TAB_CODE || e === t.LF_CODE || e === t.CR_CODE;)
            e = this.expr.charCodeAt(++this.index); this.runHook("gobble-spaces"); }
        parse() { this.runHook("before-all"); const e = this.gobbleExpressions(), r = 1 === e.length ? e[0] : { type: t.COMPOUND, body: e }; return this.runHook("after-all", r); }
        gobbleExpressions(e) { let r, s, n = []; for (; this.index < this.expr.length;)
            if (r = this.code, r === t.SEMCOL_CODE || r === t.COMMA_CODE)
                this.index++;
            else if (s = this.gobbleExpression())
                n.push(s);
            else if (this.index < this.expr.length) {
                if (r === e)
                    break;
                this.throwError('Unexpected "' + this.char + '"');
            } return n; }
        gobbleExpression() { const e = this.searchHook("gobble-expression") || this.gobbleBinaryExpression(); return this.gobbleSpaces(), this.runHook("after-expression", e); }
        gobbleBinaryOp() { this.gobbleSpaces(); let e = this.expr.substr(this.index, t.max_binop_len), r = e.length; for (; r > 0;) {
            if (t.binary_ops.hasOwnProperty(e) && (!t.isIdentifierStart(this.code) || this.index + e.length < this.expr.length && !t.isIdentifierPart(this.expr.charCodeAt(this.index + e.length))))
                return this.index += r, e;
            e = e.substr(0, --r);
        } return !1; }
        gobbleBinaryExpression() { let e, r, s, n, i, o, a, h, l; if (o = this.gobbleToken(), !o)
            return o; if (r = this.gobbleBinaryOp(), !r)
            return o; for (i = { value: r, prec: t.binaryPrecedence(r), right_a: t.right_associative.has(r) }, a = this.gobbleToken(), a || this.throwError("Expected expression after " + r), n = [o, i, a]; r = this.gobbleBinaryOp();) {
            if (s = t.binaryPrecedence(r), 0 === s) {
                this.index -= r.length;
                break;
            }
            i = { value: r, prec: s, right_a: t.right_associative.has(r) }, l = r;
            const h = e => i.right_a && e.right_a ? s > e.prec : s <= e.prec;
            for (; n.length > 2 && h(n[n.length - 2]);)
                a = n.pop(), r = n.pop().value, o = n.pop(), e = { type: t.BINARY_EXP, operator: r, left: o, right: a }, n.push(e);
            e = this.gobbleToken(), e || this.throwError("Expected expression after " + l), n.push(i, e);
        } for (h = n.length - 1, e = n[h]; h > 1;)
            e = { type: t.BINARY_EXP, operator: n[h - 1].value, left: n[h - 2], right: e }, h -= 2; return e; }
        gobbleToken() { let e, r, s, n; if (this.gobbleSpaces(), n = this.searchHook("gobble-token"), n)
            return this.runHook("after-token", n); if (e = this.code, t.isDecimalDigit(e) || e === t.PERIOD_CODE)
            return this.gobbleNumericLiteral(); if (e === t.SQUOTE_CODE || e === t.DQUOTE_CODE)
            n = this.gobbleStringLiteral();
        else if (e === t.OBRACK_CODE)
            n = this.gobbleArray();
        else {
            for (r = this.expr.substr(this.index, t.max_unop_len), s = r.length; s > 0;) {
                if (t.unary_ops.hasOwnProperty(r) && (!t.isIdentifierStart(this.code) || this.index + r.length < this.expr.length && !t.isIdentifierPart(this.expr.charCodeAt(this.index + r.length)))) {
                    this.index += s;
                    const e = this.gobbleToken();
                    return e || this.throwError("missing unaryOp argument"), this.runHook("after-token", { type: t.UNARY_EXP, operator: r, argument: e, prefix: !0 });
                }
                r = r.substr(0, --s);
            }
            t.isIdentifierStart(e) ? (n = this.gobbleIdentifier(), t.literals.hasOwnProperty(n.name) ? n = { type: t.LITERAL, value: t.literals[n.name], raw: n.name } : n.name === t.this_str && (n = { type: t.THIS_EXP })) : e === t.OPAREN_CODE && (n = this.gobbleGroup());
        } return n ? (n = this.gobbleTokenProperty(n), this.runHook("after-token", n)) : this.runHook("after-token", !1); }
        gobbleTokenProperty(e) { this.gobbleSpaces(); let r = this.code; for (; r === t.PERIOD_CODE || r === t.OBRACK_CODE || r === t.OPAREN_CODE || r === t.QUMARK_CODE;) {
            let s;
            if (r === t.QUMARK_CODE) {
                if (this.expr.charCodeAt(this.index + 1) !== t.PERIOD_CODE)
                    break;
                s = !0, this.index += 2, this.gobbleSpaces(), r = this.code;
            }
            this.index++, r === t.OBRACK_CODE ? ((e = { type: t.MEMBER_EXP, computed: !0, object: e, property: this.gobbleExpression() }).property || this.throwError('Unexpected "' + this.char + '"'), this.gobbleSpaces(), r = this.code, r !== t.CBRACK_CODE && this.throwError("Unclosed ["), this.index++) : r === t.OPAREN_CODE ? e = { type: t.CALL_EXP, arguments: this.gobbleArguments(t.CPAREN_CODE), callee: e } : (r === t.PERIOD_CODE || s) && (s && this.index--, this.gobbleSpaces(), e = { type: t.MEMBER_EXP, computed: !1, object: e, property: this.gobbleIdentifier() }), s && (e.optional = !0), this.gobbleSpaces(), r = this.code;
        } return e; }
        gobbleNumericLiteral() { let e, r, s = ""; for (; t.isDecimalDigit(this.code);)
            s += this.expr.charAt(this.index++); if (this.code === t.PERIOD_CODE)
            for (s += this.expr.charAt(this.index++); t.isDecimalDigit(this.code);)
                s += this.expr.charAt(this.index++); if (e = this.char, "e" === e || "E" === e) {
            for (s += this.expr.charAt(this.index++), e = this.char, "+" !== e && "-" !== e || (s += this.expr.charAt(this.index++)); t.isDecimalDigit(this.code);)
                s += this.expr.charAt(this.index++);
            t.isDecimalDigit(this.expr.charCodeAt(this.index - 1)) || this.throwError("Expected exponent (" + s + this.char + ")");
        } return r = this.code, t.isIdentifierStart(r) ? this.throwError("Variable names cannot start with a number (" + s + this.char + ")") : (r === t.PERIOD_CODE || 1 === s.length && s.charCodeAt(0) === t.PERIOD_CODE) && this.throwError("Unexpected period"), { type: t.LITERAL, value: parseFloat(s), raw: s }; }
        gobbleStringLiteral() { let e = ""; const r = this.index, s = this.expr.charAt(this.index++); let n = !1; for (; this.index < this.expr.length;) {
            let t = this.expr.charAt(this.index++);
            if (t === s) {
                n = !0;
                break;
            }
            if ("\\" === t)
                switch (t = this.expr.charAt(this.index++), t) {
                    case "n":
                        e += "\n";
                        break;
                    case "r":
                        e += "\r";
                        break;
                    case "t":
                        e += "\t";
                        break;
                    case "b":
                        e += "\b";
                        break;
                    case "f":
                        e += "\f";
                        break;
                    case "v":
                        e += "\v";
                        break;
                    default: e += t;
                }
            else
                e += t;
        } return n || this.throwError('Unclosed quote after "' + e + '"'), { type: t.LITERAL, value: e, raw: this.expr.substring(r, this.index) }; }
        gobbleIdentifier() { let e = this.code, r = this.index; for (t.isIdentifierStart(e) ? this.index++ : this.throwError("Unexpected " + this.char); this.index < this.expr.length && (e = this.code, t.isIdentifierPart(e));)
            this.index++; return { type: t.IDENTIFIER, name: this.expr.slice(r, this.index) }; }
        gobbleArguments(e) { const r = []; let s = !1, n = 0; for (; this.index < this.expr.length;) {
            this.gobbleSpaces();
            let i = this.code;
            if (i === e) {
                s = !0, this.index++, e === t.CPAREN_CODE && n && n >= r.length && this.throwError("Unexpected token " + String.fromCharCode(e));
                break;
            }
            if (i === t.COMMA_CODE) {
                if (this.index++, n++, n !== r.length)
                    if (e === t.CPAREN_CODE)
                        this.throwError("Unexpected token ,");
                    else if (e === t.CBRACK_CODE)
                        for (let e = r.length; e < n; e++)
                            r.push(null);
            }
            else if (r.length !== n && 0 !== n)
                this.throwError("Expected comma");
            else {
                const e = this.gobbleExpression();
                e && e.type !== t.COMPOUND || this.throwError("Expected comma"), r.push(e);
            }
        } return s || this.throwError("Expected " + String.fromCharCode(e)), r; }
        gobbleGroup() { this.index++; let e = this.gobbleExpressions(t.CPAREN_CODE); if (this.code === t.CPAREN_CODE)
            return this.index++, 1 === e.length ? e[0] : !!e.length && { type: t.SEQUENCE_EXP, expressions: e }; this.throwError("Unclosed ("); }
        gobbleArray() { return this.index++, { type: t.ARRAY_EXP, elements: this.gobbleArguments(t.CBRACK_CODE) }; }
    }
    const r = new class {
        add(e, t, r) { if ("string" != typeof arguments[0])
            for (let e in arguments[0])
                this.add(e, arguments[0][e], arguments[1]);
        else
            (Array.isArray(e) ? e : [e]).forEach((function (e) { this[e] = this[e] || [], t && this[e][r ? "unshift" : "push"](t); }), this); }
        run(e, t) { this[e] = this[e] || [], this[e].forEach((function (e) { e.call(t && t.context ? t.context : t, t); })); }
    };
    Object.assign(t, { hooks: r, plugins: new class {
            constructor(e) { this.jsep = e, this.registered = {}; }
            register() { for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++)
                t[r] = arguments[r]; t.forEach((e => { if ("object" != typeof e || !e.name || !e.init)
                throw new Error("Invalid JSEP plugin format"); this.registered[e.name] || (e.init(this.jsep), this.registered[e.name] = e); })); }
        }(t), COMPOUND: "Compound", SEQUENCE_EXP: "SequenceExpression", IDENTIFIER: "Identifier", MEMBER_EXP: "MemberExpression", LITERAL: "Literal", THIS_EXP: "ThisExpression", CALL_EXP: "CallExpression", UNARY_EXP: "UnaryExpression", BINARY_EXP: "BinaryExpression", ARRAY_EXP: "ArrayExpression", TAB_CODE: 9, LF_CODE: 10, CR_CODE: 13, SPACE_CODE: 32, PERIOD_CODE: 46, COMMA_CODE: 44, SQUOTE_CODE: 39, DQUOTE_CODE: 34, OPAREN_CODE: 40, CPAREN_CODE: 41, OBRACK_CODE: 91, CBRACK_CODE: 93, QUMARK_CODE: 63, SEMCOL_CODE: 59, COLON_CODE: 58, unary_ops: { "-": 1, "!": 1, "~": 1, "+": 1 }, binary_ops: { "||": 1, "??": 1, "&&": 2, "|": 3, "^": 4, "&": 5, "==": 6, "!=": 6, "===": 6, "!==": 6, "<": 7, ">": 7, "<=": 7, ">=": 7, "<<": 8, ">>": 8, ">>>": 8, "+": 9, "-": 9, "*": 10, "/": 10, "%": 10, "**": 11 }, right_associative: new Set(["**"]), additional_identifier_chars: new Set(["$", "_"]), literals: { true: !0, false: !1, null: null }, this_str: "this" }), t.max_unop_len = t.getMaxKeyLen(t.unary_ops), t.max_binop_len = t.getMaxKeyLen(t.binary_ops);
    const s = e => new t(e).parse(), n = Object.getOwnPropertyNames(class {
    });
    Object.getOwnPropertyNames(t).filter((e => !n.includes(e) && void 0 === s[e])).forEach((e => { s[e] = t[e]; })), s.Jsep = t;
    var i = { name: "ternary", init(e) { e.hooks.add("after-expression", (function (t) { if (t.node && this.code === e.QUMARK_CODE) {
            this.index++;
            const r = t.node, s = this.gobbleExpression();
            if (s || this.throwError("Expected expression"), this.gobbleSpaces(), this.code === e.COLON_CODE) {
                this.index++;
                const n = this.gobbleExpression();
                if (n || this.throwError("Expected expression"), t.node = { type: "ConditionalExpression", test: r, consequent: s, alternate: n }, r.operator && e.binary_ops[r.operator] <= .9) {
                    let s = r;
                    for (; s.right.operator && e.binary_ops[s.right.operator] <= .9;)
                        s = s.right;
                    t.node.test = s.right, s.right = t.node, t.node = r;
                }
            }
            else
                this.throwError("Expected :");
        } })); } };
    s.plugins.register(i);
    var o = { name: "regex", init(e) { e.hooks.add("gobble-token", (function (t) { if (47 === this.code) {
            const r = ++this.index;
            let s = !1;
            for (; this.index < this.expr.length;) {
                if (47 === this.code && !s) {
                    const s = this.expr.slice(r, this.index);
                    let n, i = "";
                    for (; ++this.index < this.expr.length;) {
                        const e = this.code;
                        if (!(e >= 97 && e <= 122 || e >= 65 && e <= 90 || e >= 48 && e <= 57))
                            break;
                        i += this.char;
                    }
                    try {
                        n = new RegExp(s, i);
                    }
                    catch (e) {
                        this.throwError(e.message);
                    }
                    return t.node = { type: e.LITERAL, value: n, raw: this.expr.slice(r - 1, this.index) }, t.node = this.gobbleTokenProperty(t.node), t.node;
                }
                this.code === e.OBRACK_CODE ? s = !0 : s && this.code === e.CBRACK_CODE && (s = !1), this.index += 92 === this.code ? 2 : 1;
            }
            this.throwError("Unclosed Regex");
        } })); } };
    const a = { name: "assignment", assignmentOperators: new Set(["=", "*=", "**=", "/=", "%=", "+=", "-=", "<<=", ">>=", ">>>=", "&=", "^=", "|=", "||=", "&&=", "??="]), updateOperators: [43, 45], assignmentPrecedence: .9, init(e) { const t = [e.IDENTIFIER, e.MEMBER_EXP]; function r(e) { a.assignmentOperators.has(e.operator) ? (e.type = "AssignmentExpression", r(e.left), r(e.right)) : e.operator || Object.values(e).forEach((e => { e && "object" == typeof e && r(e); })); } a.assignmentOperators.forEach((t => e.addBinaryOp(t, a.assignmentPrecedence, !0))), e.hooks.add("gobble-token", (function (e) { const r = this.code; a.updateOperators.some((e => e === r && e === this.expr.charCodeAt(this.index + 1))) && (this.index += 2, e.node = { type: "UpdateExpression", operator: 43 === r ? "++" : "--", argument: this.gobbleTokenProperty(this.gobbleIdentifier()), prefix: !0 }, e.node.argument && t.includes(e.node.argument.type) || this.throwError(`Unexpected ${e.node.operator}`)); })), e.hooks.add("after-token", (function (e) { if (e.node) {
            const r = this.code;
            a.updateOperators.some((e => e === r && e === this.expr.charCodeAt(this.index + 1))) && (t.includes(e.node.type) || this.throwError(`Unexpected ${e.node.operator}`), this.index += 2, e.node = { type: "UpdateExpression", operator: 43 === r ? "++" : "--", argument: e.node, prefix: !1 });
        } })), e.hooks.add("after-expression", (function (e) { e.node && r(e.node); })); } };
    s.plugins.register(o, a), s.addUnaryOp("typeof"), s.addLiteral("null", null), s.addLiteral("undefined", void 0);
    const h = new Set(["constructor", "__proto__", "__defineGetter__", "__defineSetter__"]), l = { evalAst(e, t) { switch (e.type) {
            case "BinaryExpression":
            case "LogicalExpression": return l.evalBinaryExpression(e, t);
            case "Compound": return l.evalCompound(e, t);
            case "ConditionalExpression": return l.evalConditionalExpression(e, t);
            case "Identifier": return l.evalIdentifier(e, t);
            case "Literal": return l.evalLiteral(e, t);
            case "MemberExpression": return l.evalMemberExpression(e, t);
            case "UnaryExpression": return l.evalUnaryExpression(e, t);
            case "ArrayExpression": return l.evalArrayExpression(e, t);
            case "CallExpression": return l.evalCallExpression(e, t);
            case "AssignmentExpression": return l.evalAssignmentExpression(e, t);
            default: throw SyntaxError("Unexpected expression", e);
        } }, evalBinaryExpression: (e, t) => ({ "||": (e, t) => e || t(), "&&": (e, t) => e && t(), "|": (e, t) => e | t(), "^": (e, t) => e ^ t(), "&": (e, t) => e & t(), "==": (e, t) => e == t(), "!=": (e, t) => e != t(), "===": (e, t) => e === t(), "!==": (e, t) => e !== t(), "<": (e, t) => e < t(), ">": (e, t) => e > t(), "<=": (e, t) => e <= t(), ">=": (e, t) => e >= t(), "<<": (e, t) => e << t(), ">>": (e, t) => e >> t(), ">>>": (e, t) => e >>> t(), "+": (e, t) => e + t(), "-": (e, t) => e - t(), "*": (e, t) => e * t(), "/": (e, t) => e / t(), "%": (e, t) => e % t() }[e.operator](l.evalAst(e.left, t), (() => l.evalAst(e.right, t)))), evalCompound(e, t) { let r; for (let s = 0; s < e.body.length; s++) {
            "Identifier" === e.body[s].type && ["var", "let", "const"].includes(e.body[s].name) && e.body[s + 1] && "AssignmentExpression" === e.body[s + 1].type && (s += 1);
            const n = e.body[s];
            r = l.evalAst(n, t);
        } return r; }, evalConditionalExpression: (e, t) => l.evalAst(e.test, t) ? l.evalAst(e.consequent, t) : l.evalAst(e.alternate, t), evalIdentifier(e, t) { if (Object.hasOwn(t, e.name))
            return t[e.name]; throw ReferenceError(`${e.name} is not defined`); }, evalLiteral: e => e.value, evalMemberExpression(e, t) { const r = String(e.computed ? l.evalAst(e.property) : e.property.name), s = l.evalAst(e.object, t); if (null == s)
            throw TypeError(`Cannot read properties of ${s} (reading '${r}')`); if (!Object.hasOwn(s, r) && h.has(r))
            throw TypeError(`Cannot read properties of ${s} (reading '${r}')`); const n = s[r]; return "function" == typeof n ? n.bind(s) : n; }, evalUnaryExpression: (e, t) => ({ "-": e => -l.evalAst(e, t), "!": e => !l.evalAst(e, t), "~": e => ~l.evalAst(e, t), "+": e => +l.evalAst(e, t), typeof: e => typeof l.evalAst(e, t) }[e.operator](e.argument)), evalArrayExpression: (e, t) => e.elements.map((e => l.evalAst(e, t))), evalCallExpression(e, t) { const r = e.arguments.map((e => l.evalAst(e, t))); return l.evalAst(e.callee, t)(...r); }, evalAssignmentExpression(e, t) { if ("Identifier" !== e.left.type)
            throw SyntaxError("Invalid left-hand side in assignment"); const r = e.left.name, s = l.evalAst(e.right, t); return t[r] = s, t[r]; } };
    function c(e, t) { return (e = e.slice()).push(t), e; }
    function p(e, t) { return (t = t.slice()).unshift(e), t; }
    class u extends Error {
        constructor(e) { super('JSONPath should not be called with "new" (it prevents return of (unwrapped) scalar values)'), this.avoidNew = !0, this.value = e, this.name = "NewError"; }
    }
    function d(e, t, r, s, n) { if (!(this instanceof d))
        try {
            return new d(e, t, r, s, n);
        }
        catch (e) {
            if (!e.avoidNew)
                throw e;
            return e.value;
        } "string" == typeof e && (n = s, s = r, r = t, t = e, e = null); const i = e && "object" == typeof e; if (e = e || {}, this.json = e.json || r, this.path = e.path || t, this.resultType = e.resultType || "value", this.flatten = e.flatten || !1, this.wrap = !Object.hasOwn(e, "wrap") || e.wrap, this.sandbox = e.sandbox || {}, this.eval = void 0 === e.eval ? "safe" : e.eval, this.ignoreEvalErrors = void 0 !== e.ignoreEvalErrors && e.ignoreEvalErrors, this.parent = e.parent || null, this.parentProperty = e.parentProperty || null, this.callback = e.callback || s || null, this.otherTypeCallback = e.otherTypeCallback || n || function () { throw new TypeError("You must supply an otherTypeCallback callback option with the @other() operator."); }, !1 !== e.autostart) {
        const s = { path: i ? e.path : t };
        i ? "json" in e && (s.json = e.json) : s.json = r;
        const n = this.evaluate(s);
        if (!n || "object" != typeof n)
            throw new u(n);
        return n;
    } }
    d.prototype.evaluate = function (e, t, r, s) { let n = this.parent, i = this.parentProperty, { flatten: o, wrap: a } = this; if (this.currResultType = this.resultType, this.currEval = this.eval, this.currSandbox = this.sandbox, r = r || this.callback, this.currOtherTypeCallback = s || this.otherTypeCallback, t = t || this.json, (e = e || this.path) && "object" == typeof e && !Array.isArray(e)) {
        if (!e.path && "" !== e.path)
            throw new TypeError('You must supply a "path" property when providing an object argument to JSONPath.evaluate().');
        if (!Object.hasOwn(e, "json"))
            throw new TypeError('You must supply a "json" property when providing an object argument to JSONPath.evaluate().');
        ({ json: t } = e), o = Object.hasOwn(e, "flatten") ? e.flatten : o, this.currResultType = Object.hasOwn(e, "resultType") ? e.resultType : this.currResultType, this.currSandbox = Object.hasOwn(e, "sandbox") ? e.sandbox : this.currSandbox, a = Object.hasOwn(e, "wrap") ? e.wrap : a, this.currEval = Object.hasOwn(e, "eval") ? e.eval : this.currEval, r = Object.hasOwn(e, "callback") ? e.callback : r, this.currOtherTypeCallback = Object.hasOwn(e, "otherTypeCallback") ? e.otherTypeCallback : this.currOtherTypeCallback, n = Object.hasOwn(e, "parent") ? e.parent : n, i = Object.hasOwn(e, "parentProperty") ? e.parentProperty : i, e = e.path;
    } if (n = n || null, i = i || null, Array.isArray(e) && (e = d.toPathString(e)), !e && "" !== e || !t)
        return; const h = d.toPathArray(e); "$" === h[0] && h.length > 1 && h.shift(), this._hasParentSelector = null; const l = this._trace(h, t, ["$"], n, i, r).filter((function (e) { return e && !e.isParentSelector; })); return l.length ? a || 1 !== l.length || l[0].hasArrExpr ? l.reduce(((e, t) => { const r = this._getPreferredOutput(t); return o && Array.isArray(r) ? e = e.concat(r) : e.push(r), e; }), []) : this._getPreferredOutput(l[0]) : a ? [] : void 0; }, d.prototype._getPreferredOutput = function (e) { const t = this.currResultType; switch (t) {
        case "all": {
            const t = Array.isArray(e.path) ? e.path : d.toPathArray(e.path);
            return e.pointer = d.toPointer(t), e.path = "string" == typeof e.path ? e.path : d.toPathString(e.path), e;
        }
        case "value":
        case "parent":
        case "parentProperty": return e[t];
        case "path": return d.toPathString(e[t]);
        case "pointer": return d.toPointer(e.path);
        default: throw new TypeError("Unknown result type");
    } }, d.prototype._handleCallback = function (e, t, r) { if (t) {
        const s = this._getPreferredOutput(e);
        e.path = "string" == typeof e.path ? e.path : d.toPathString(e.path), t(s, r, e);
    } }, d.prototype._trace = function (e, t, r, s, n, i, o, a) { let h; if (!e.length)
        return h = { path: r, value: t, parent: s, parentProperty: n, hasArrExpr: o }, this._handleCallback(h, i, "value"), h; const l = e[0], u = e.slice(1), d = []; function f(e) { Array.isArray(e) ? e.forEach((e => { d.push(e); })) : d.push(e); } if (("string" != typeof l || a) && t && Object.hasOwn(t, l))
        f(this._trace(u, t[l], c(r, l), t, l, i, o));
    else if ("*" === l)
        this._walk(t, (e => { f(this._trace(u, t[e], c(r, e), t, e, i, !0, !0)); }));
    else if (".." === l)
        f(this._trace(u, t, r, s, n, i, o)), this._walk(t, (s => { "object" == typeof t[s] && f(this._trace(e.slice(), t[s], c(r, s), t, s, i, !0)); }));
    else {
        if ("^" === l)
            return this._hasParentSelector = !0, { path: r.slice(0, -1), expr: u, isParentSelector: !0 };
        if ("~" === l)
            return h = { path: c(r, l), value: n, parent: s, parentProperty: null }, this._handleCallback(h, i, "property"), h;
        if ("$" === l)
            f(this._trace(u, t, r, null, null, i, o));
        else if (/^(-?\d*):(-?\d*):?(\d*)$/u.test(l))
            f(this._slice(l, u, t, r, s, n, i));
        else if (0 === l.indexOf("?(")) {
            if (!1 === this.currEval)
                throw new Error("Eval [?(expr)] prevented in JSONPath expression.");
            const e = l.replace(/^\?\((.*?)\)$/u, "$1"), o = /@.?([^?]*)[['](\??\(.*?\))(?!.\)\])[\]']/gu.exec(e);
            o ? this._walk(t, (e => { const a = [o[2]], h = o[1] ? t[e][o[1]] : t[e]; this._trace(a, h, r, s, n, i, !0).length > 0 && f(this._trace(u, t[e], c(r, e), t, e, i, !0)); })) : this._walk(t, (o => { this._eval(e, t[o], o, r, s, n) && f(this._trace(u, t[o], c(r, o), t, o, i, !0)); }));
        }
        else if ("(" === l[0]) {
            if (!1 === this.currEval)
                throw new Error("Eval [(expr)] prevented in JSONPath expression.");
            f(this._trace(p(this._eval(l, t, r.at(-1), r.slice(0, -1), s, n), u), t, r, s, n, i, o));
        }
        else if ("@" === l[0]) {
            let e = !1;
            const o = l.slice(1, -2);
            switch (o) {
                case "scalar":
                    t && ["object", "function"].includes(typeof t) || (e = !0);
                    break;
                case "boolean":
                case "string":
                case "undefined":
                case "function":
                    typeof t === o && (e = !0);
                    break;
                case "integer":
                    !Number.isFinite(t) || t % 1 || (e = !0);
                    break;
                case "number":
                    Number.isFinite(t) && (e = !0);
                    break;
                case "nonFinite":
                    "number" != typeof t || Number.isFinite(t) || (e = !0);
                    break;
                case "object":
                    t && typeof t === o && (e = !0);
                    break;
                case "array":
                    Array.isArray(t) && (e = !0);
                    break;
                case "other":
                    e = this.currOtherTypeCallback(t, r, s, n);
                    break;
                case "null":
                    null === t && (e = !0);
                    break;
                default: throw new TypeError("Unknown value type " + o);
            }
            if (e)
                return h = { path: r, value: t, parent: s, parentProperty: n }, this._handleCallback(h, i, "value"), h;
        }
        else if ("`" === l[0] && t && Object.hasOwn(t, l.slice(1))) {
            const e = l.slice(1);
            f(this._trace(u, t[e], c(r, e), t, e, i, o, !0));
        }
        else if (l.includes(",")) {
            const e = l.split(",");
            for (const o of e)
                f(this._trace(p(o, u), t, r, s, n, i, !0));
        }
        else
            !a && t && Object.hasOwn(t, l) && f(this._trace(u, t[l], c(r, l), t, l, i, o, !0));
    } if (this._hasParentSelector)
        for (let e = 0; e < d.length; e++) {
            const r = d[e];
            if (r && r.isParentSelector) {
                const a = this._trace(r.expr, t, r.path, s, n, i, o);
                if (Array.isArray(a)) {
                    d[e] = a[0];
                    const t = a.length;
                    for (let r = 1; r < t; r++)
                        e++, d.splice(e, 0, a[r]);
                }
                else
                    d[e] = a;
            }
        } return d; }, d.prototype._walk = function (e, t) { if (Array.isArray(e)) {
        const r = e.length;
        for (let e = 0; e < r; e++)
            t(e);
    }
    else
        e && "object" == typeof e && Object.keys(e).forEach((e => { t(e); })); }, d.prototype._slice = function (e, t, r, s, n, i, o) { if (!Array.isArray(r))
        return; const a = r.length, h = e.split(":"), l = h[2] && Number.parseInt(h[2]) || 1; let c = h[0] && Number.parseInt(h[0]) || 0, u = h[1] && Number.parseInt(h[1]) || a; c = c < 0 ? Math.max(0, c + a) : Math.min(a, c), u = u < 0 ? Math.max(0, u + a) : Math.min(a, u); const d = []; for (let e = c; e < u; e += l) {
        this._trace(p(e, t), r, s, n, i, o, !0).forEach((e => { d.push(e); }));
    } return d; }, d.prototype._eval = function (e, t, r, s, n, i) { this.currSandbox._$_parentProperty = i, this.currSandbox._$_parent = n, this.currSandbox._$_property = r, this.currSandbox._$_root = this.json, this.currSandbox._$_v = t; const o = e.includes("@path"); o && (this.currSandbox._$_path = d.toPathString(s.concat([r]))); const a = this.currEval + "Script:" + e; if (!d.cache[a]) {
        let t = e.replaceAll("@parentProperty", "_$_parentProperty").replaceAll("@parent", "_$_parent").replaceAll("@property", "_$_property").replaceAll("@root", "_$_root").replaceAll(/@([.\s)[])/gu, "_$_v$1");
        if (o && (t = t.replaceAll("@path", "_$_path")), "safe" === this.currEval || !0 === this.currEval || void 0 === this.currEval)
            d.cache[a] = new this.safeVm.Script(t);
        else if ("native" === this.currEval)
            d.cache[a] = new this.vm.Script(t);
        else if ("function" == typeof this.currEval && this.currEval.prototype && Object.hasOwn(this.currEval.prototype, "runInNewContext")) {
            const e = this.currEval;
            d.cache[a] = new e(t);
        }
        else {
            if ("function" != typeof this.currEval)
                throw new TypeError(`Unknown "eval" property "${this.currEval}"`);
            d.cache[a] = { runInNewContext: e => this.currEval(t, e) };
        }
    } try {
        return d.cache[a].runInNewContext(this.currSandbox);
    }
    catch (t) {
        if (this.ignoreEvalErrors)
            return !1;
        throw new Error("jsonPath: " + t.message + ": " + e);
    } }, d.cache = {}, d.toPathString = function (e) { const t = e, r = t.length; let s = "$"; for (let e = 1; e < r; e++)
        /^(~|\^|@.*?\(\))$/u.test(t[e]) || (s += /^[0-9*]+$/u.test(t[e]) ? "[" + t[e] + "]" : "['" + t[e] + "']"); return s; }, d.toPointer = function (e) { const t = e, r = t.length; let s = ""; for (let e = 1; e < r; e++)
        /^(~|\^|@.*?\(\))$/u.test(t[e]) || (s += "/" + t[e].toString().replaceAll("~", "~0").replaceAll("/", "~1")); return s; }, d.toPathArray = function (e) { const { cache: t } = d; if (t[e])
        return t[e].concat(); const r = [], s = e.replaceAll(/@(?:null|boolean|number|string|integer|undefined|nonFinite|scalar|array|object|function|other)\(\)/gu, ";$&;").replaceAll(/[['](\??\(.*?\))[\]'](?!.\])/gu, (function (e, t) { return "[#" + (r.push(t) - 1) + "]"; })).replaceAll(/\[['"]([^'\]]*)['"]\]/gu, (function (e, t) { return "['" + t.replaceAll(".", "%@%").replaceAll("~", "%%@@%%") + "']"; })).replaceAll("~", ";~;").replaceAll(/['"]?\.['"]?(?![^[]*\])|\[['"]?/gu, ";").replaceAll("%@%", ".").replaceAll("%%@@%%", "~").replaceAll(/(?:;)?(\^+)(?:;)?/gu, (function (e, t) { return ";" + t.split("").join(";") + ";"; })).replaceAll(/;;;|;;/gu, ";..;").replaceAll(/;$|'?\]|'$/gu, "").split(";").map((function (e) { const t = e.match(/#(\d+)/u); return t && t[1] ? r[t[1]] : e; })); return t[e] = s, t[e].concat(); }, d.prototype.safeVm = { Script: class {
            constructor(e) { this.code = e, this.ast = s(this.code); }
            runInNewContext(e) { const t = Object.assign(Object.create(null), e); return l.evalAst(this.ast, t); }
        } };
    d.prototype.vm = { Script: class {
            constructor(e) { this.code = e; }
            runInNewContext(e) { let t = this.code; const r = Object.keys(e), s = []; !function (e, t, r) { const s = e.length; for (let n = 0; n < s; n++)
                r(e[n]) && t.push(e.splice(n--, 1)[0]); }(r, s, (t => "function" == typeof e[t])); const n = r.map((t => e[t])); t = s.reduce(((t, r) => { let s = e[r].toString(); return /function/u.test(s) || (s = "function " + s), "var " + r + "=" + s + ";" + t; }), "") + t, /(['"])use strict\1/u.test(t) || r.includes("arguments") || (t = "var arguments = undefined;" + t), t = t.replace(/;\s*$/u, ""); const i = t.lastIndexOf(";"), o = -1 !== i ? t.slice(0, i + 1) + " return " + t.slice(i + 1) : " return " + t; return new Function(...r, o)(...n); }
        } }, e.JSONPath = d;
}));
//# sourceMappingURL=index-browser-umd.min.cjs.map
define("utility/Env", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Env {
        async init() {
            const raw = await fetch('/.env').then(res => res.text());
            const acc = this;
            for (const line of raw.split('\n')) {
                if (line.startsWith('#') || !line.trim())
                    continue;
                let [key, value] = line.split('=');
                if (!key || !value)
                    throw new Error(`Invalid .env line: ${line}`);
                key = key.trim();
                value = value.trim();
                if (value.startsWith('"') && value.endsWith('"'))
                    value = value.slice(1, -1);
                acc[key] = value;
            }
        }
    }
    exports.default = new Env();
});
define("utility/Database", ["require", "exports", "dexie"], function (require, exports, dexie_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.db = void 0;
    dexie_1 = __importDefault(dexie_1);
    exports.db = new dexie_1.default('relic');
    exports.db.version(1).stores({
        versions: 'component, version, cacheTime',
        data: 'component',
        store: 'key',
        profiles: 'id, name, [name+code]',
    });
});
define("utility/Store", ["require", "exports", "utility/Database"], function (require, exports, Database_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.onUpdateStore = onUpdateStore;
    const trackedStoreStates = {};
    const methods = {
        has: async (key) => !!await Database_1.db.store.get(key),
        get: async (key) => await Database_1.db.store.get(key).then(item => item?.value),
        set: async (key, value) => {
            await Database_1.db.store.put({ key, value });
            const tracked = trackedStoreStates[key];
            if (tracked)
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                tracked.value = value;
            for (const handler of updateStoreHandlers)
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                void handler(key, value);
        },
        delete: async (key) => {
            await Database_1.db.store.delete(key);
            const tracked = trackedStoreStates[key];
            if (tracked)
                tracked.value = undefined;
            for (const handler of updateStoreHandlers)
                void handler(key, undefined);
        },
        state: (...args) => {
            const [key, orElse] = args;
            let state = trackedStoreStates[key];
            if (state)
                return state;
            if (args.length === 2) {
                state = { value: orElse };
                trackedStoreStates[key] = state;
                return state;
            }
            return methods.get(key).then(value => {
                state = { value };
                trackedStoreStates[key] = state;
                return state;
            });
        },
    };
    const methodNames = Object.keys(methods);
    const methodCache = new Map();
    const Store = new Proxy({}, {
        get(target, key) {
            if (typeof key !== 'string')
                return undefined;
            let cache = methodCache.get(key);
            if (cache)
                return cache;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            cache = Object.fromEntries(methodNames.map(methodName => [methodName, methods[methodName].bind(null, key)]));
            methodCache.set(key, cache);
            return cache;
        },
    });
    exports.default = Store;
    const updateStoreHandlers = [];
    function onUpdateStore(callback) {
        updateStoreHandlers.push(callback);
    }
    Object.assign(self, { Store });
});
define("utility/Log", ["require", "exports", "utility/Store"], function (require, exports, Store_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Store_1 = __importDefault(Store_1);
    var Log;
    (function (Log) {
        Log.VERBOSE = Store_1.default.verboseLogging.state(false);
        const SERVICE_FORMAT = 'color: #58946c;';
        const PUNCT_FORMAT = 'color: #888;';
        const WARN_FORMAT = 'color: #ee942e;';
        const ERROR_FORMAT = 'color: #d9534f;';
        function info(...args) {
            // log with coloured prefix [conduit.deepsight.gg]
            console[Log.VERBOSE.value ? 'info' : 'debug'](`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/`, PUNCT_FORMAT, SERVICE_FORMAT, PUNCT_FORMAT, 
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            ...args);
        }
        Log.info = info;
        function warn(...args) {
            // log with coloured prefix [conduit.deepsight.gg]
            console.warn(`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/`, WARN_FORMAT, SERVICE_FORMAT, PUNCT_FORMAT, 
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            ...args);
        }
        Log.warn = warn;
        function error(...args) {
            // log with coloured prefix [conduit.deepsight.gg]
            console.error(`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/`, ERROR_FORMAT, SERVICE_FORMAT, PUNCT_FORMAT, 
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            ...args);
        }
        Log.error = error;
    })(Log || (Log = {}));
    exports.default = Log;
});
define("model/Auth", ["require", "exports", "utility/Env", "utility/Log", "utility/Store"], function (require, exports, Env_1, Log_1, Store_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Env_1 = __importDefault(Env_1);
    Log_1 = __importDefault(Log_1);
    Store_2 = __importDefault(Store_2);
    var Auth;
    (function (Auth) {
        const AUTH_EXPIRY = 1000 * 60 * 60 * 24 * 30; // 30 days
        async function getAuthState() {
            const [auth, customApp, accessGrants] = await Promise.all([
                Store_2.default.auth.get(),
                Store_2.default.customApp.get(),
                getOriginGrants(),
            ]);
            const clientId = customApp?.clientId ?? Env_1.default.BUNGIE_AUTH_CLIENT_ID;
            return {
                authenticated: !!auth,
                accessGrants,
                bungieAuthURL: `https://www.bungie.net/en/OAuth/Authorize?client_id=${clientId}&response_type=code`,
                customApp,
            };
        }
        Auth.getAuthState = getAuthState;
        async function getOriginAccess(origin) {
            const origins = await Store_2.default.origins.get() ?? {};
            const auth = origins?.[origin];
            if (auth && auth.authTimestamp + AUTH_EXPIRY > Date.now())
                return auth;
            delete origins[origin];
            await Store_2.default.origins.set(origins);
            return undefined;
        }
        Auth.getOriginAccess = getOriginAccess;
        async function getOriginGrants() {
            const origins = await Store_2.default.origins.get() ?? {};
            return Object.values(origins).filter(auth => auth.authTimestamp + AUTH_EXPIRY > Date.now());
        }
        Auth.getOriginGrants = getOriginGrants;
        async function grantAccess(origin, appName) {
            const origins = await Store_2.default.origins.get() ?? {};
            if (origins[origin])
                return false;
            origins[origin] = {
                appName,
                origin,
                authTimestamp: Date.now(),
            };
            await Store_2.default.origins.set(origins);
            Log_1.default.info(`Granted access to origin: ${origin}`);
            return true;
        }
        Auth.grantAccess = grantAccess;
        async function denyAccess(origin) {
            const origins = await Store_2.default.origins.get() ?? {};
            if (origins[origin]) {
                delete origins[origin];
                await Store_2.default.origins.set(origins);
            }
            Log_1.default.info(`Denied access to origin: ${origin}`);
        }
        Auth.denyAccess = denyAccess;
        async function isOriginTrusted(origin) {
            const lastOwnOriginPart = self.origin.slice(self.origin.lastIndexOf('.', self.origin.lastIndexOf('.') - 1) + 1);
            if (origin.endsWith(lastOwnOriginPart) || origin.startsWith('https://localhost') || origin.startsWith('http://localhost'))
                return true;
            const origins = await Store_2.default.origins.get() ?? {};
            return !!origins[origin]?.fullTrust;
        }
        Auth.isOriginTrusted = isOriginTrusted;
        async function trustOrigin(origin) {
            const origins = await Store_2.default.origins.get() ?? {};
            if (origins[origin]) {
                origins[origin].fullTrust = true;
                await Store_2.default.origins.set(origins);
            }
            Log_1.default.info(`Trusted origin: ${origin}`);
        }
        Auth.trustOrigin = trustOrigin;
        async function untrustOrigin(origin) {
            const origins = await Store_2.default.origins.get() ?? {};
            if (origins[origin]) {
                delete origins[origin].fullTrust;
                await Store_2.default.origins.set(origins);
            }
            Log_1.default.info(`Untrusted origin: ${origin}`);
        }
        Auth.untrustOrigin = untrustOrigin;
        async function getAPIKey() {
            const customApp = await Store_2.default.customApp.get();
            return customApp?.apiKey ?? Env_1.default.BUNGIE_API_KEY;
        }
        Auth.getAPIKey = getAPIKey;
        async function getAuthorisation() {
            const customApp = await Store_2.default.customApp.get();
            const clientId = customApp?.clientId ?? Env_1.default.BUNGIE_AUTH_CLIENT_ID;
            const clientSecret = customApp?.clientSecret ?? Env_1.default.BUNGIE_AUTH_CLIENT_SECRET;
            return `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
        }
        Auth.getAuthorisation = getAuthorisation;
        async function getBungieAuthURL() {
            const customApp = await Store_2.default.customApp.get();
            const clientId = customApp?.clientId ?? Env_1.default.BUNGIE_AUTH_CLIENT_ID;
            return `https://www.bungie.net/en/OAuth/Authorize?client_id=${clientId}&response_type=code`;
        }
        Auth.getBungieAuthURL = getBungieAuthURL;
        async function getValid() {
            const auth = await Store_2.default.auth.get();
            if (!auth)
                return undefined;
            const now = Date.now() + 1000 * 60; // add a minute to account for latency of refresh requests
            if (now > auth.refreshExpiry) {
                // refresh token is expired, must re-authenticate
                Log_1.default.info('Bungie.net refresh token expired, must re-authenticate');
                return undefined;
            }
            if (auth.accessExpiry > now) {
                // access token is still valid
                Log_1.default.info('Bungie.net access token validated');
                return auth;
            }
            const authorisation = await getAuthorisation();
            // refresh access token
            Log_1.default.info('Refreshing Bungie.net access token...');
            const tokenRequestTime = Date.now();
            const tokenResponse = await fetch('https://www.bungie.net/Platform/App/OAuth/Token/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': authorisation,
                },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: auth.refreshToken,
                }),
            }).then(res => res.json());
            return handleTokenResponse(tokenRequestTime, tokenResponse);
        }
        Auth.getValid = getValid;
        async function complete(code) {
            if (!code)
                return undefined;
            if (!Env_1.default.BUNGIE_AUTH_CLIENT_ID || !Env_1.default.BUNGIE_AUTH_CLIENT_SECRET) {
                console.error('BUNGIE_AUTH_CLIENT_ID or BUNGIE_AUTH_CLIENT_SECRET is not set in the environment');
                return undefined;
            }
            const authorisation = await getAuthorisation();
            const tokenRequestTime = Date.now();
            const tokenResponse = await fetch('https://www.bungie.net/Platform/App/OAuth/Token/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    // 'X-API-Key': Env.BUNGIE_API_KEY,
                    'Authorization': authorisation,
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code: code,
                }),
            }).then(res => res.json());
            return handleTokenResponse(tokenRequestTime, tokenResponse);
        }
        Auth.complete = complete;
        async function handleTokenResponse(requestTime, tokenResponse) {
            if (tokenResponse.token_type !== 'Bearer' || !tokenResponse.access_token || !tokenResponse.refresh_token) {
                console.error('Invalid Bungie.net token response');
                return undefined;
            }
            const auth = {
                accessToken: tokenResponse.access_token,
                accessExpiry: requestTime + tokenResponse.expires_in * 1000,
                refreshToken: tokenResponse.refresh_token,
                refreshExpiry: requestTime + tokenResponse.refresh_expires_in * 1000,
                membershipId: tokenResponse.membership_id,
            };
            await Store_2.default.auth.set(auth);
            return auth;
        }
        const empyHeaders = {
            'Content-Type': 'application/json',
        };
        let fetchHeadersCache;
        async function getHeaders() {
            if (fetchHeadersCache && Date.now() - fetchHeadersCache.time < 1000 * 60) // 1 minute cache
                return fetchHeadersCache.value;
            fetchHeadersCache = undefined;
            const apiKey = await getAPIKey();
            if (!apiKey)
                return empyHeaders; // partial headers when invalid
            fetchHeadersCache = {
                time: Date.now(),
                value: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey,
                },
            };
            return fetchHeadersCache.value;
        }
        Auth.getHeaders = getHeaders;
        let fetchHeadersAuthedCache;
        async function getAuthedHeaders() {
            if (fetchHeadersAuthedCache && Date.now() - fetchHeadersAuthedCache.time < 1000 * 60) // 1 minute cache
                return fetchHeadersAuthedCache.value;
            fetchHeadersAuthedCache = undefined;
            const [auth, apiKey] = await Promise.all([
                Auth.getValid(),
                Auth.getAPIKey(),
            ]);
            if (!apiKey || !auth?.accessToken)
                return {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey,
                    'Authorization': auth && `Bearer ${auth.accessToken}`,
                }; // partial headers when invalid
            fetchHeadersAuthedCache = {
                time: Date.now(),
                value: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey,
                    'Authorization': `Bearer ${auth.accessToken}`,
                },
            };
            return fetchHeadersAuthedCache.value;
        }
        Auth.getAuthedHeaders = getAuthedHeaders;
    })(Auth || (Auth = {}));
    exports.default = Auth;
});
define("model/Model", ["require", "exports", "utility/Database"], function (require, exports, Database_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    function Model(id, def) {
        let promise;
        let currentUpdateId;
        let currentIsSoft = false;
        return Object.assign(def, {
            id,
            async get() {
                const value = (await this.use()).value;
                await def.tweak?.(value);
                return value;
            },
            async use(hard) {
                if (hard && currentIsSoft) {
                    promise = undefined;
                    currentUpdateId = undefined;
                    currentIsSoft = false;
                }
                let updateId;
                return promise ??= (async () => {
                    currentUpdateId = updateId = `${Date.now().toString(36)}-${(+(performance.now() % 1).toFixed(2) * 100).toString(36)}-${Math.random().toString(36).slice(2)}`;
                    let delayCount = 0;
                    while (true) {
                        try {
                            return await tryUpdate(updateId, hard);
                        }
                        catch (err) {
                            console.error(err);
                            await sleep(Math.min(1000 * 2 ** delayCount++, 1000 * 60 * 5));
                        }
                    }
                })();
            },
        });
        async function tryUpdate(updateId, hard = false) {
            if (currentUpdateId !== updateId && promise)
                return promise;
            let version;
            let result;
            await Database_2.db.transaction('r', Database_2.db.versions, Database_2.db.data, async (db) => {
                version = await db.versions.get(id);
                const cacheExpiryTime = (version?.cacheTime ?? 0) + def.cacheDirtyTime;
                if (Date.now() < cacheExpiryTime && !hard) {
                    currentIsSoft = !hard;
                    result = await db.data.get(id).then(data => data?.data);
                }
            });
            if (currentUpdateId !== updateId && promise)
                // switch to newer update, probably a hard update now
                return promise;
            if (result !== undefined) {
                promise = undefined;
                currentUpdateId = undefined;
                return { version: version.version, value: result, updated: false };
            }
            // if we reach here, this is functionally a hard update, so no cancelling anymore.
            // technically `currentIsSoft` should already be `false`, but let's make it explicit:
            currentIsSoft = false;
            const newVersion = await def.fetch();
            if (version?.version === newVersion.version)
                result = await Database_2.db.data.get(id).then(data => data?.data);
            if (result !== undefined) {
                promise = undefined;
                currentUpdateId = undefined;
                return { version: newVersion.version, value: result, updated: false };
            }
            result = typeof newVersion.value === 'function' ? await newVersion.value() : newVersion.value;
            await Database_2.db.transaction('rw', Database_2.db.versions, Database_2.db.data, async (db) => {
                await db.versions.put({ component: id, version: newVersion.version, cacheTime: Date.now() });
                await db.data.put({ component: id, data: result });
            });
            promise = undefined;
            currentUpdateId = undefined;
            return { version: newVersion.version, value: result, updated: true };
        }
    }
    exports.default = Model;
});
define("utility/Broadcast", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Broadcast;
    (function (Broadcast) {
        function startOperation(type, related) {
            const operation = {
                id: crypto.randomUUID(),
                type,
                related,
            };
            const broadcastComplete = service.broadcast.startOperation(operation);
            return { ...operation, broadcastComplete };
        }
        Broadcast.startOperation = startOperation;
        function endOperation(operation) {
            void service.broadcast.endOperation(typeof operation === 'string' ? operation : operation.id);
        }
        Broadcast.endOperation = endOperation;
        async function operation(type, related, block) {
            if (typeof related === 'function')
                block = related, related = undefined;
            const operation = startOperation(type, related);
            const [, result] = await Promise.all([
                operation.broadcastComplete,
                block(),
            ]);
            void service.broadcast.endOperation(operation.id);
            return result;
        }
        Broadcast.operation = operation;
        function warning(category, type, related) {
            void service.broadcast.warning({ type, category, related });
        }
        Broadcast.warning = warning;
    })(Broadcast || (Broadcast = {}));
    exports.default = Broadcast;
});
define("utility/Clarity", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Clarity;
    (function (Clarity) {
        const origin = 'https://database-clarity.github.io/Live-Clarity-Database';
        async function get(url) {
            if (!url.startsWith('/'))
                url = `/${url}`;
            return self.fetch(`${origin}${url}`)
                .then(handleClarityResponse);
        }
        Clarity.get = get;
        async function handleClarityResponse(response) {
            return await (response.text())
                .then(text => {
                return JSON.parse(text);
            });
        }
    })(Clarity || (Clarity = {}));
    exports.default = Clarity;
});
define("model/ClarityManifest", ["require", "exports", "model/Model", "utility/Broadcast", "utility/Clarity"], function (require, exports, Model_1, Broadcast_1, Clarity_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Model_1 = __importDefault(Model_1);
    Broadcast_1 = __importDefault(Broadcast_1);
    Clarity_1 = __importDefault(Clarity_1);
    exports.default = (0, Model_1.default)('ClarityManifest', {
        cacheDirtyTime: 1000 * 60 * 60, // 1 hour cache time
        async fetch() {
            const manifest = await Broadcast_1.default.operation('Checking for new definitions', () => Clarity_1.default.get(`/versions.json?_=${Math.random().toString(36).slice(2)}`));
            if (typeof manifest?.descriptions !== 'number')
                throw new Error('Invalid Clarity manifest response');
            return {
                version: `${manifest.descriptions}`,
                value: manifest,
            };
        },
    });
});
define("utility/Deepsight", ["require", "exports", "utility/Env"], function (require, exports, Env_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Env_2 = __importDefault(Env_2);
    var Deepsight;
    (function (Deepsight) {
        const origin = 'https://definition.deepsight.gg';
        function get(url, skipLocal) {
            if (!url.startsWith('/'))
                url = `/${url}`;
            return fetchTryLocalThenRemote(url, skipLocal);
        }
        Deepsight.get = get;
        function fetchTryLocalThenRemote(url, skipLocal = false) {
            const promise = (async () => {
                if (Env_2.default.LOCAL_DEEPSIGHT_MANIFEST_ORIGIN && !skipLocal) {
                    const localResult = await self.fetch(`${Env_2.default.LOCAL_DEEPSIGHT_MANIFEST_ORIGIN}/definitions${url}`)
                        .then(handleDeepsightResponse)
                        .catch(() => null);
                    if (localResult !== null) {
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                        promise.isLocal = true;
                        return localResult;
                    }
                }
                return await self.fetch(`${origin}${url}`)
                    .then(handleDeepsightResponse);
            })();
            return promise;
        }
        async function handleDeepsightResponse(response) {
            return await (response.text())
                .then(text => {
                return JSON.parse(text);
            });
        }
    })(Deepsight || (Deepsight = {}));
    exports.default = Deepsight;
});
define("model/DeepsightManifest", ["require", "exports", "model/Model", "utility/Broadcast", "utility/Deepsight"], function (require, exports, Model_2, Broadcast_2, Deepsight_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Model_2 = __importDefault(Model_2);
    Broadcast_2 = __importDefault(Broadcast_2);
    Deepsight_1 = __importDefault(Deepsight_1);
    const DeepsightManifest = (0, Model_2.default)('DeepsightManifest', {
        cacheDirtyTime: 1000 * 60 * 1, // 1 minute cache time
        async fetch() {
            const operation = Broadcast_2.default.startOperation('Checking for new definitions');
            const manifestPromise = Deepsight_1.default.get(`/manifest.json?_=${Math.random().toString(36).slice(2)}`);
            const [manifest] = await Promise.all([manifestPromise, operation.broadcastComplete]);
            if (typeof manifest?.deepsight !== 'number')
                throw new Error('Invalid deepsight.gg manifest response');
            Broadcast_2.default.endOperation(operation);
            return {
                version: `${manifest.deepsight}`,
                value: { manifest, isLocal: manifestPromise.isLocal },
            };
        },
    });
    exports.default = DeepsightManifest;
});
define("utility/Bungie", ["require", "exports", "model/Auth", "utility/Log"], function (require, exports, Auth_1, Log_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Auth_1 = __importDefault(Auth_1);
    Log_2 = __importDefault(Log_2);
    var Jsonable;
    (function (Jsonable) {
        function searchParamsIfy(value) {
            if (Array.isArray(value))
                return value
                    .map(item => searchParamsIfy(item))
                    .join(',');
            if (typeof value === 'object' && value !== null)
                return Object.entries(value)
                    .map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(searchParamsIfy(val))}`)
                    .join('&');
            if (value === undefined)
                return '';
            return encodeURIComponent(String(value));
        }
        Jsonable.searchParamsIfy = searchParamsIfy;
    })(Jsonable || (Jsonable = {}));
    const mergeSearchParams = (...params) => {
        return new URLSearchParams(params
            .filter(param => typeof param !== 'string' || param.includes('?'))
            .map(param => param instanceof URLSearchParams ? param : new URLSearchParams(typeof param !== 'string'
            ? Jsonable.searchParamsIfy(param)
            : param.split('?').at(-1)))
            .flatMap(param => [...param.entries()])).toString();
    };
    var Bungie;
    (function (Bungie) {
        const origin = 'https://www.bungie.net/Platform';
        let queueId = 0;
        const queueIds = [];
        let queuePromise;
        async function queue(fn) {
            const id = ++queueId;
            queueIds.push(id);
            while (queuePromise && queueIds[0] !== id)
                await Promise.resolve(queuePromise).catch(() => { });
            const promise = queuePromise = Promise.resolve(fn());
            await promise.catch(() => { });
            queueIds.shift();
            queuePromise = undefined;
            return promise;
        }
        async function get(url, body, options) {
            return await queue(async () => {
                if (!url.startsWith('/'))
                    url = `/${url}`;
                if (body)
                    url = `${url}?${mergeSearchParams(url, body)}`;
                Log_2.default.info('GET', url);
                return self.fetch(`${origin}${url}`, {
                    ...options,
                    headers: { ...await Auth_1.default.getHeaders(), ...options?.headers },
                })
                    .then(handleBungieResponse);
            });
        }
        Bungie.get = get;
        async function getForUser(url, body) {
            return await queue(async () => {
                if (!url.startsWith('/'))
                    url = `/${url}`;
                if (body)
                    url = `${url}?${mergeSearchParams(url, body)}`;
                Log_2.default.info('GET:AUTHED', url);
                return self.fetch(`${origin}${url}`, {
                    headers: { ...await Auth_1.default.getAuthedHeaders() },
                })
                    .then(handleBungieResponse);
            });
        }
        Bungie.getForUser = getForUser;
        async function post(url, body) {
            return await queue(async () => {
                if (!url.startsWith('/'))
                    url = `/${url}`;
                Log_2.default.info('POST', url);
                return self.fetch(`${origin}${url}`, {
                    method: 'POST',
                    headers: { ...await Auth_1.default.getHeaders() },
                    body: JSON.stringify(body),
                })
                    .then(handleBungieResponse);
            });
        }
        Bungie.post = post;
        async function postForUser(url, body) {
            return await queue(async () => {
                if (!url.startsWith('/'))
                    url = `/${url}`;
                Log_2.default.info('POST:AUTHED', url);
                return self.fetch(`${origin}${url}`, {
                    method: 'POST',
                    headers: { ...await Auth_1.default.getAuthedHeaders() },
                    body: JSON.stringify(body),
                })
                    .then(handleBungieResponse);
            });
        }
        Bungie.postForUser = postForUser;
        async function handleBungieResponse(response) {
            return await (response.text())
                .then(text => {
                return JSON.parse(text);
            })
                .catch(err => ({
                Response: undefined,
                ErrorCode: -1,
                ErrorStatus: 'FetchError',
                Message: err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error',
                MessageData: {},
                ThrottleSeconds: 0,
            }))
                .then(response => {
                if (response.ErrorCode && response.ErrorCode !== 1 /* PlatformErrorCodes.Success */) {
                    const error = Object.assign(new Error(`${response.Message}`), response.MessageData);
                    error.name = response.ErrorStatus;
                    Object.assign(error, { code: response.ErrorCode });
                    Log_2.default.info(response.ErrorStatus, response.Message);
                    throw error;
                }
                return response.Response;
            });
        }
    })(Bungie || (Bungie = {}));
    exports.default = Bungie;
});
define("model/DestinyManifest", ["require", "exports", "model/Model", "utility/Broadcast", "utility/Bungie"], function (require, exports, Model_3, Broadcast_3, Bungie_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Model_3 = __importDefault(Model_3);
    Broadcast_3 = __importDefault(Broadcast_3);
    Bungie_1 = __importDefault(Bungie_1);
    exports.default = (0, Model_3.default)('DestinyManifest', {
        cacheDirtyTime: 1000 * 60 * 60, // 1 hour cache time
        async fetch() {
            const manifest = await Broadcast_3.default.operation('Checking for new definitions', () => Bungie_1.default.get('/Destiny2/Manifest/', undefined, { cache: 'reload' }));
            if (typeof manifest?.version !== 'string')
                throw new Error('Invalid Destiny manifest response');
            return {
                version: manifest.version,
                value: manifest.jsonWorldComponentContentPaths,
            };
        },
    });
});
define("model/Definitions", ["require", "exports", "model/ClarityManifest", "model/DeepsightManifest", "model/DestinyManifest", "model/Model", "utility/Broadcast", "utility/Clarity", "utility/Deepsight"], function (require, exports, ClarityManifest_1, DeepsightManifest_1, DestinyManifest_1, Model_4, Broadcast_4, Clarity_2, Deepsight_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    ClarityManifest_1 = __importDefault(ClarityManifest_1);
    DeepsightManifest_1 = __importDefault(DeepsightManifest_1);
    DestinyManifest_1 = __importDefault(DestinyManifest_1);
    Model_4 = __importDefault(Model_4);
    Broadcast_4 = __importDefault(Broadcast_4);
    Clarity_2 = __importDefault(Clarity_2);
    Deepsight_2 = __importDefault(Deepsight_2);
    const Definitions = new Proxy({}, {
        get(target, language) {
            return target[language] ??= new Proxy({}, {
                get(target, componentName) {
                    const prefix = componentName.startsWith('Destiny') ? 'destiny2'
                        : componentName.startsWith('Deepsight') ? 'deepsight'
                            : componentName.startsWith('Clarity') ? 'clarity'
                                : null;
                    if (!prefix)
                        throw new Error(`Unsupported component name: ${componentName}`);
                    const componentLanguage = prefix === 'deepsight' || prefix === 'clarity' ? 'en' : language;
                    return target[componentName] ??= (0, Model_4.default)(`${prefix}/${componentName}/${componentLanguage}`, {
                        cacheDirtyTime: 1000 * 60 * 1, // 1 minute cache time (shorter due to first getting the current version from the whole manifest)
                        async fetch() {
                            switch (prefix) {
                                case 'destiny2': {
                                    const manifest = await DestinyManifest_1.default.use();
                                    return {
                                        version: manifest.version,
                                        value: async () => {
                                            const componentURI = manifest.value[componentLanguage][componentName];
                                            return Broadcast_4.default.operation('Downloading definitions', () => fetch(`https://www.bungie.net${componentURI}`)
                                                .then(response => response.json()));
                                        },
                                    };
                                }
                                case 'deepsight': {
                                    const manifest = await DeepsightManifest_1.default.use();
                                    return {
                                        version: `${manifest.value.manifest[componentName]}`,
                                        value: async () => await Broadcast_4.default.operation('Downloading definitions', () => Deepsight_2.default.get(`/${componentName}.json`, !manifest.value.isLocal)),
                                    };
                                }
                                case 'clarity': {
                                    const manifest = await ClarityManifest_1.default.use();
                                    const filename = componentName === 'ClarityDescriptions' ? '/descriptions/clarity.json'
                                        : undefined;
                                    if (!filename)
                                        throw new Error(`Unsupported Clarity component name: ${componentName}`);
                                    return {
                                        version: manifest.version,
                                        value: async () => await Broadcast_4.default.operation('Downloading definitions', () => Clarity_2.default.get(filename)),
                                    };
                                }
                                default:
                                    throw new Error('This is impossible');
                            }
                        },
                    });
                },
            });
        },
    });
    exports.default = Definitions;
});
define("model/ProfiledModel", ["require", "exports", "model/Model"], function (require, exports, Model_5) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ProfiledModel = ProfiledModel;
    Model_5 = __importDefault(Model_5);
    function ProfiledModel(name, definition) {
        const cache = {};
        return {
            for(profile) {
                const membershipTypeAndId = !profile ? 'none' : `${profile.type}/${profile.id}`;
                return cache[membershipTypeAndId] ??= (0, Model_5.default)(`${name}:${membershipTypeAndId}`, {
                    cacheDirtyTime: definition.cacheDirtyTime,
                    fetch: () => definition.fetch(profile),
                    tweak: definition.tweak && (value => definition.tweak(value, profile)),
                });
            },
        };
    }
});
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
define("model/DestinyProfiles", ["require", "exports", "model/ProfiledModel", "utility/Broadcast", "utility/Bungie", "utility/Store"], function (require, exports, ProfiledModel_1, Broadcast_5, Bungie_2, Store_3) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Broadcast_5 = __importDefault(Broadcast_5);
    Bungie_2 = __importDefault(Bungie_2);
    Store_3 = __importDefault(Store_3);
    exports.default = (0, ProfiledModel_1.ProfiledModel)('destiny2/profile', {
        cacheDirtyTime: 1000 * 30, // 30 second cache time
        async fetch(profile) {
            const profileResponse = profile && await Broadcast_5.default.operation('Fetching Destiny profile', () => Bungie_2.default.getForUser(`/Destiny2/${profile.type}/Profile/${profile.id}/`, {
                components: [
                    100 /* DestinyComponentType.Profiles */,
                    200 /* DestinyComponentType.Characters */,
                    104 /* DestinyComponentType.ProfileProgression */,
                    206 /* DestinyComponentType.CharacterLoadouts */,
                    201 /* DestinyComponentType.CharacterInventories */,
                    205 /* DestinyComponentType.CharacterEquipment */,
                    102 /* DestinyComponentType.ProfileInventories */,
                    300 /* DestinyComponentType.ItemInstances */,
                    309 /* DestinyComponentType.ItemPlugObjectives */,
                    304 /* DestinyComponentType.ItemStats */,
                    900 /* DestinyComponentType.Records */,
                    305 /* DestinyComponentType.ItemSockets */,
                    310 /* DestinyComponentType.ItemReusablePlugs */,
                    308 /* DestinyComponentType.ItemPlugStates */,
                    302 /* DestinyComponentType.ItemPerks */,
                    202 /* DestinyComponentType.CharacterProgressions */,
                    800 /* DestinyComponentType.Collectibles */,
                    204 /* DestinyComponentType.CharacterActivities */, // displaying whether items are currently obtainable
                    1200 /* DestinyComponentType.StringVariables */,
                ],
            }));
            return {
                version: profileResponse?.responseMintedTimestamp ?? 'n/a',
                value: profileResponse,
            };
        },
        async tweak(value, profile) {
            const allOverrides = await Store_3.default.destinyProfileOverrides.get();
            const overrides = allOverrides?.[profile?.id ?? ''] ?? [];
            if (!overrides || !value)
                return;
            const profileMinted = new Date(value.responseMintedTimestamp).getTime();
            for (const override of overrides) {
                if (profileMinted > override.time)
                    continue;
                switch (override.type) {
                    case 'delete': {
                        const parent = getNestedParent(value, override.path);
                        if (parent)
                            delete parent[override.path.at(-1)];
                        break;
                    }
                    case 'set': {
                        const parent = getNestedParent(value, override.path);
                        if (parent)
                            parent[override.path.at(-1)] = override.value;
                        break;
                    }
                    case 'move': {
                        const fromParent = getNestedParent(value, override.fromPath);
                        const toParent = getNestedParent(value, override.toPath);
                        if (fromParent && toParent) {
                            toParent[override.toPath.at(-1)] = fromParent[override.fromPath.at(-1)];
                            delete fromParent[override.fromPath.at(-1)];
                        }
                        break;
                    }
                    case 'splice-where': {
                        const arrayCursor = getNestedObject(value, override.arrayPath);
                        if (Array.isArray(arrayCursor)) {
                            const index = arrayCursor.findIndex(item => meetsEveryCondition(item, override.where));
                            if (index !== -1)
                                arrayCursor.splice(index, 1);
                        }
                        break;
                    }
                    case 'move-where': {
                        const fromArrayCursor = getNestedObject(value, override.fromArrayPath);
                        const toArrayCursor = getNestedObject(value, override.toArrayPath);
                        if (Array.isArray(fromArrayCursor) && Array.isArray(toArrayCursor)) {
                            const index = fromArrayCursor.findIndex(item => meetsEveryCondition(item, override.where));
                            if (index !== -1) {
                                const [item] = fromArrayCursor.splice(index, 1);
                                toArrayCursor.push(item);
                            }
                        }
                        break;
                    }
                    case 'set-where': {
                        const arrayCursor = getNestedObject(value, override.arrayPath);
                        if (Array.isArray(arrayCursor)) {
                            const item = arrayCursor.find(item => meetsEveryCondition(item, override.where));
                            if (item) {
                                const parent = getNestedParent(item, override.modifyPath);
                                if (parent)
                                    parent[override.modifyPath.at(-1)] = override.value;
                            }
                        }
                        break;
                    }
                }
            }
            overrides.splice(0, Infinity, ...overrides.filter(override => override.time > profileMinted));
            await Store_3.default.destinyProfileOverrides.set(allOverrides);
        },
    });
    function meetsCondition(value, where) {
        if ('and' in where) {
            if (!meetsEveryCondition(value, where.and))
                return false;
            return true;
        }
        if ('or' in where) {
            if (!meetsAnyCondition(value, where.or))
                return false;
            return true;
        }
        if ('path' in where && 'value' in where) {
            if (getNestedObject(value, where.path) !== where.value)
                return false;
            return true;
        }
        where;
        return false;
    }
    function meetsEveryCondition(value, where) {
        for (const cond of where)
            if (!meetsCondition(value, cond))
                return false;
        return true;
    }
    function meetsAnyCondition(value, where) {
        for (const cond of where)
            if (meetsCondition(value, cond))
                return true;
        return false;
    }
    function getNestedObject(obj, path) {
        let cursor = obj;
        const targetPath = path;
        for (const part of targetPath) {
            if (cursor === undefined || cursor === null)
                return undefined;
            cursor = cursor[part];
        }
        return cursor;
    }
    function getNestedParent(obj, path) {
        let cursor = obj;
        const targetPath = path;
        for (let i = 0; i < targetPath.length - 1; i++) {
            if (cursor === undefined || cursor === null)
                return undefined;
            cursor = cursor[targetPath[i]];
        }
        return cursor;
    }
});
define("utility/Colour", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Colour;
    (function (Colour) {
        function fromDestiny(destiny) {
            const { red, green, blue } = destiny;
            return (red << 16) | (green << 8) | blue;
        }
        Colour.fromDestiny = fromDestiny;
    })(Colour || (Colour = {}));
    exports.default = Colour;
});
define("utility/Diff", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DiffableArray = void 0;
    const SYMBOL_DIFFABLE_INSTANCE_EQUALS = Symbol('DIFFABLE_INSTANCE_EQUALS');
    var DiffableArray;
    (function (DiffableArray) {
        function is(value) {
            return Array.isArray(value) && SYMBOL_DIFFABLE_INSTANCE_EQUALS in value && typeof value[SYMBOL_DIFFABLE_INSTANCE_EQUALS] === 'function';
        }
        DiffableArray.is = is;
        function make(array, instanceEquals) {
            const result = array;
            if (result)
                result[SYMBOL_DIFFABLE_INSTANCE_EQUALS] = instanceEquals;
            return result;
        }
        DiffableArray.make = make;
        function makeDeep(array, instanceEquals, itemApplicator) {
            const result = array;
            result[SYMBOL_DIFFABLE_INSTANCE_EQUALS] = instanceEquals;
            for (const item of result)
                itemApplicator(item);
            return result;
        }
        DiffableArray.makeDeep = makeDeep;
    })(DiffableArray || (exports.DiffableArray = DiffableArray = {}));
    var Diff;
    (function (Diff) {
        function get(from, to) {
            const diffs = [];
            const path = [];
            let pathSlice;
            calcDiffs(from, to);
            return diffs;
            function calcDiffs(from, to) {
                if (from === to)
                    return;
                if (typeof2(from) !== typeof2(to)) {
                    diffs.push({
                        type: 'write',
                        path: pathSlice ??= path.slice(),
                        value: to,
                    });
                    return;
                }
                switch (typeof2(from)) {
                    case 'array:diffable': {
                        const fromDiffable = from;
                        const toDiffable = to;
                        calcArrayDiffs(fromDiffable, toDiffable, (a, b, oldIndex) => {
                            const same = fromDiffable[SYMBOL_DIFFABLE_INSTANCE_EQUALS](a, b);
                            if (same) {
                                path.push(`${oldIndex}`);
                                pathSlice = undefined;
                                calcDiffs(a, b);
                                path.pop();
                                pathSlice = undefined;
                            }
                            return same;
                        });
                        return;
                    }
                    case 'array':
                        calcArrayDiffs(from, to);
                        return;
                    case 'object':
                        calcObjectDiffs(from, to);
                        return;
                }
                diffs.push({
                    type: 'write',
                    path: pathSlice ??= path.slice(),
                    value: to,
                });
            }
            function calcArrayDiffs(from, to, equals) {
                const operations = myersDiff(from, to, equals);
                const arrayPath = pathSlice ??= path.slice();
                for (const operation of operations)
                    operation.path = arrayPath;
                diffs.push(...operations);
            }
            function calcObjectDiffs(from, to) {
                for (const key in from) {
                    if (!(key in to)) {
                        diffs.push({
                            type: 'delete',
                            path: [...path, key],
                        });
                    }
                    else {
                        path.push(key);
                        pathSlice = undefined;
                        calcDiffs(from[key], to[key]);
                        path.pop();
                        pathSlice = undefined;
                    }
                }
                for (const key in to) {
                    if (!(key in from)) {
                        diffs.push({
                            type: 'write',
                            path: [...path, key],
                            value: to[key],
                        });
                    }
                }
            }
        }
        Diff.get = get;
        function typeof2(value) {
            if (value === null)
                return 'null';
            if (DiffableArray.is(value))
                return 'array:diffable';
            if (Array.isArray(value))
                return 'array';
            const result = typeof value;
            return result;
        }
        function myersDiff(oldArray, newArray, isEqual) {
            const oldLength = oldArray.length;
            const newLength = newArray.length;
            const maxLength = oldLength + newLength;
            const v = new Array(2 * maxLength + 1);
            const trace = [];
            v.fill(0);
            for (let d = 0; d <= maxLength; d++) {
                const vCopy = [...v];
                trace.push(vCopy);
                for (let k = -d; k <= d; k += 2) {
                    let x;
                    if (k === -d || (k !== d && v[maxLength + k - 1] < v[maxLength + k + 1]))
                        x = v[maxLength + k + 1];
                    else
                        x = v[maxLength + k - 1] + 1;
                    let y = x - k;
                    while (x < oldLength && y < newLength && (!isEqual ? oldArray[x] === newArray[y] : isEqual(oldArray[x], newArray[y], x, y))) {
                        x++;
                        y++;
                    }
                    v[maxLength + k] = x;
                    if (x >= oldLength && y >= newLength) {
                        const script = [];
                        let currentX = oldLength;
                        let currentY = newLength;
                        for (let traceD = d; traceD > 0; traceD--) {
                            const prevV = trace[traceD];
                            const currentK = currentX - currentY;
                            const forward = false
                                || currentK === -traceD
                                || (currentK !== traceD && prevV[maxLength + currentK - 1] < prevV[maxLength + currentK + 1]);
                            const prevK = forward ? currentK + 1 : currentK - 1;
                            const prevX = prevV[maxLength + prevK];
                            const prevY = prevX - prevK;
                            while (currentX > prevX && currentY > prevY) {
                                currentX--;
                                currentY--;
                            }
                            if (traceD > 0) {
                                const lastOperation = script.at(-1);
                                if (prevX === currentX) {
                                    const insertIndex = prevX;
                                    if (lastOperation?.type === 'insert' && lastOperation.position === insertIndex)
                                        lastOperation.values.unshift(newArray[currentY - 1]);
                                    else
                                        script.push({
                                            type: 'insert',
                                            position: insertIndex,
                                            values: [newArray[currentY - 1]],
                                        });
                                }
                                else {
                                    const deleteIndex = currentX - 1;
                                    if (lastOperation?.type === 'splice' && lastOperation.position === deleteIndex + 1)
                                        lastOperation.count++, lastOperation.position = deleteIndex;
                                    else
                                        script.push({
                                            type: 'splice',
                                            position: deleteIndex,
                                            count: 1,
                                        });
                                }
                            }
                            currentX = prevX;
                            currentY = prevY;
                        }
                        return script;
                    }
                }
            }
            return [];
        }
    })(Diff || (Diff = {}));
    exports.default = Diff;
});
define("model/Profiles", ["require", "exports", "model/Definitions", "utility/Broadcast", "utility/Bungie", "utility/Colour", "utility/Database", "utility/Diff", "utility/Store"], function (require, exports, Definitions_1, Broadcast_6, Bungie_3, Colour_1, Database_3, Diff_1, Store_4) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Definitions_1 = __importDefault(Definitions_1);
    Broadcast_6 = __importDefault(Broadcast_6);
    Bungie_3 = __importDefault(Bungie_3);
    Colour_1 = __importDefault(Colour_1);
    Diff_1 = __importStar(Diff_1);
    Store_4 = __importDefault(Store_4);
    var Profiles;
    (function (Profiles) {
        const version = '10';
        async function get() {
            let updated = false;
            const profiles = await Database_3.db.profiles.toArray();
            await Broadcast_6.default.operation('Updating player profiles', () => Promise.all(profiles.map(async (profile) => {
                const thisProfileUpdated = await updateProfile(profile).catch(() => false);
                updated ||= thisProfileUpdated ?? false;
            })));
            return { profiles, updated };
        }
        Profiles.get = get;
        async function searchDestinyPlayerByBungieName(displayName, displayNameCode) {
            const profile = await Database_3.db.profiles.get({ name: displayName, code: displayNameCode });
            if (profile) {
                await Broadcast_6.default.operation('Updating player profiles', () => updateProfile(profile, true));
                return profile;
            }
            return await Broadcast_6.default.operation('Searching Destiny players', () => Bungie_3.default.post('/Destiny2/SearchDestinyPlayerByBungieName/-1/', {
                displayName,
                displayNameCode,
            }).then(resolveProfile));
        }
        Profiles.searchDestinyPlayerByBungieName = searchDestinyPlayerByBungieName;
        async function getCurrentProfile(auth) {
            if (!auth)
                return undefined;
            return await Broadcast_6.default.operation('Updating your player profile', async () => {
                const profiles = await Database_3.db.profiles.toArray();
                const userMembershipData = await Bungie_3.default.getForUser('/User/GetMembershipsForCurrentUser/');
                if (!userMembershipData?.destinyMemberships?.length)
                    return undefined;
                let profile = profiles.find(profile => userMembershipData.destinyMemberships.some(membership => membership.membershipId === profile.id));
                if (profile) {
                    await updateProfile(profile, true);
                    await updateAuthProfile(auth, profile);
                    return profile;
                }
                profile = await resolveProfile(userMembershipData.destinyMemberships);
                await updateAuthProfile(auth, profile);
                return profile;
            });
        }
        Profiles.getCurrentProfile = getCurrentProfile;
        async function updateAuthProfile(auth, profile) {
            if (!profile)
                return;
            if (auth.displayName === profile.name && auth.displayNameCode === profile.code)
                return;
            auth.displayName = profile.name;
            auth.displayNameCode = profile.code;
            await Store_4.default.auth.set(auth);
        }
        async function resolveProfile(memberships) {
            const preferredMembership = !memberships[0].crossSaveOverride
                ? undefined
                : memberships.find(membership => membership.membershipType === memberships[0].crossSaveOverride);
            const membershipCheckOrder = memberships.toSorted((a, b) => +(b === preferredMembership) - +(a === preferredMembership));
            for (const card of membershipCheckOrder) {
                const destinyProfile = await getDestinyProfile(card.membershipType, card.membershipId);
                if (destinyProfile) {
                    const profile = {
                        id: card.membershipId,
                        type: card.membershipType,
                        name: card.bungieGlobalDisplayName,
                        code: card.bungieGlobalDisplayNameCode,
                        characters: [],
                        power: 0,
                        lastUpdate: new Date(0).toISOString(),
                        lastAccess: new Date().toISOString(),
                        version,
                    };
                    await updateProfile(profile, undefined, destinyProfile);
                    return profile;
                }
            }
            return undefined;
        }
        async function getDestinyProfile(membershipType, membershipId) {
            const components = [100 /* DestinyComponentType.Profiles */, 200 /* DestinyComponentType.Characters */];
            return Bungie_3.default.getForUser(`/Destiny2/${membershipType}/Profile/${membershipId}/?components=${components.join(',')}`)
                .catch(() => undefined);
        }
        async function updateProfile(profile, access, destinyProfile) {
            if (!access && profile.version === version && Date.now() - new Date(profile.lastUpdate).getTime() < 1000 * 60 * 60) // 1 hour
                return;
            let updated = false;
            if (profile.version !== version) {
                updated = true;
                profile.version = version;
            }
            const clan = await getUserClan(profile);
            if (clan !== undefined && clan?.clanInfo) {
                updated = true;
                profile.clan = !clan ? undefined : {
                    name: clan.name,
                    callsign: clan.clanInfo.clanCallsign,
                };
            }
            destinyProfile ??= await getDestinyProfile(profile.type, profile.id);
            const guardianRank = destinyProfile?.profile?.data?.currentGuardianRank;
            if (guardianRank !== undefined && profile.guardianRank?.rank !== guardianRank) {
                updated = true;
                const DestinyGuardianRankDefinition = await Definitions_1.default.en.DestinyGuardianRankDefinition.get();
                profile.guardianRank = {
                    rank: guardianRank,
                    name: DestinyGuardianRankDefinition[guardianRank]?.displayProperties.name,
                };
            }
            if (destinyProfile?.characters) {
                updated = true;
                const emblems = await Definitions_1.default.en.DeepsightEmblemDefinition.get();
                const newChars = Object.values(destinyProfile.characters.data ?? {})
                    .map((character) => ({
                    is: 'character',
                    id: character.characterId,
                    metadata: character,
                    emblem: !character.emblemHash ? undefined : {
                        hash: character.emblemHash,
                        displayProperties: emblems[character.emblemHash].displayProperties,
                        background: Colour_1.default.fromDestiny(emblems[character.emblemHash].backgroundColor),
                        secondaryIcon: emblems[character.emblemHash].secondaryIcon,
                        secondaryOverlay: emblems[character.emblemHash].secondaryOverlay,
                        secondarySpecial: emblems[character.emblemHash].secondarySpecial,
                    },
                    lastPlayed: new Date(character.dateLastPlayed).toISOString(),
                }));
                const DiffableCharacters = (characters) => Diff_1.DiffableArray.makeDeep((characters
                    .sort((a, b) => a.id.localeCompare(b.id))), (a, b) => a.id === b.id, character => {
                    Diff_1.DiffableArray.make(character.emblem?.displayProperties.iconSequences, (a, b) => !Diff_1.default.get(a, b).length);
                });
                const oldDiffChars = DiffableCharacters(profile.characters);
                const newDiffChars = DiffableCharacters(newChars);
                if (Diff_1.default.get(oldDiffChars, newDiffChars).length) {
                    profile.characters = newChars.sort((a, b) => b.lastPlayed.localeCompare(a.lastPlayed));
                    profile.classType = profile.characters[0]?.metadata.classType;
                    profile.emblem = profile.characters[0]?.emblem;
                    profile.power = profile.characters[0]?.metadata.light ?? 0;
                }
            }
            if (access)
                profile.lastAccess = new Date().toISOString();
            if (updated)
                profile.lastUpdate = new Date().toISOString();
            if (updated || access) {
                await Database_3.db.profiles.put(profile);
                return true;
            }
            return false;
        }
        async function getUserClan(profile) {
            return Bungie_3.default.get(`/GroupV2/User/${profile.type}/${profile.id}/${0 /* GroupsForMemberFilter.All */}/${1 /* GroupType.Clan */}/`)
                .then(response => response?.results?.at(0)?.group ?? null)
                .catch(() => undefined);
        }
    })(Profiles || (Profiles = {}));
    exports.default = Profiles;
});
define("action/ItemTransfer", ["require", "exports", "model/Auth", "model/Definitions", "model/Profiles", "utility/Broadcast", "utility/Bungie", "utility/Store"], function (require, exports, Auth_2, Definitions_2, Profiles_1, Broadcast_7, Bungie_4, Store_5) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.transferItem = transferItem;
    exports.pullFromPostmaster = pullFromPostmaster;
    Auth_2 = __importDefault(Auth_2);
    Definitions_2 = __importDefault(Definitions_2);
    Profiles_1 = __importDefault(Profiles_1);
    Broadcast_7 = __importDefault(Broadcast_7);
    Bungie_4 = __importDefault(Bungie_4);
    Store_5 = __importDefault(Store_5);
    function or(...conditions) {
        return { or: conditions };
    }
    function and(...conditions) {
        return { and: conditions };
    }
    async function transferItem(profile, body) {
        await Bungie_4.default.postForUser('/Destiny2/Actions/Items/TransferItem/', body);
        const profileOverrides = await Store_5.default.destinyProfileOverrides.get() ?? {};
        const overrides = profileOverrides[profile.id] ??= [];
        const itemMatcher = or({ path: ['itemInstanceId'], value: body.itemId }, and({ path: ['itemInstanceId'], value: undefined }, { path: ['itemHash'], value: body.itemReferenceHash }, { path: ['quantity'], value: body.stackSize }));
        if (body.transferToVault) {
            overrides.push({
                type: 'move-where',
                fromArrayPath: ['characterInventories', 'data', body.characterId, 'items'],
                toArrayPath: ['profileInventory', 'data', 'items'],
                where: [itemMatcher],
                time: Date.now(),
            });
        }
        else {
            overrides.push({
                type: 'move-where',
                fromArrayPath: ['profileInventory', 'data', 'items'],
                toArrayPath: ['characterInventories', 'data', body.characterId, 'items'],
                where: [itemMatcher],
                time: Date.now(),
            });
        }
        await Store_5.default.destinyProfileOverrides.set(profileOverrides);
    }
    async function pullFromPostmaster(profile, body) {
        const itemDef = await Definitions_2.default.en.DestinyInventoryItemDefinition.get().then(DestinyInventoryItemDefinition => DestinyInventoryItemDefinition[body.itemReferenceHash]);
        if (!itemDef.inventory?.bucketTypeHash) {
            Broadcast_7.default.warning('user', 'Unable to pull item from postmaster: Unknown item');
            return;
        }
        await Bungie_4.default.postForUser('/Destiny2/Actions/Items/PullFromPostmaster/', body);
        const profileOverrides = await Store_5.default.destinyProfileOverrides.get() ?? {};
        const overrides = profileOverrides[profile.id] ??= [];
        const itemMatcher = or({ path: ['itemInstanceId'], value: body.itemId }, and({ path: ['itemInstanceId'], value: undefined }, { path: ['itemHash'], value: body.itemReferenceHash }, { path: ['quantity'], value: body.stackSize }));
        overrides.push({
            type: 'set-where',
            arrayPath: ['characterInventories', 'data', body.characterId, 'items'],
            where: [itemMatcher],
            modifyPath: ['bucketHash'],
            value: itemDef.inventory.bucketTypeHash,
            time: Date.now(),
        });
        await Store_5.default.destinyProfileOverrides.set(profileOverrides);
    }
    var ItemTransfer;
    (function (ItemTransfer) {
        async function vaultItem(item) {
            const auth = await Auth_2.default.getValid();
            const profile = await Profiles_1.default.getCurrentProfile(auth);
            if (!profile) {
                Broadcast_7.default.warning('user', 'Unable to transfer item: Not authenticated');
                return [];
            }
            const instanceId = item.instanceId ?? '0';
            if (!item.characterId) {
                Broadcast_7.default.warning('user', 'Unable to transfer item: Character required');
                return [];
            }
            if (item.isLostItem)
                await pullFromPostmaster(profile, {
                    membershipType: profile.type,
                    itemId: instanceId,
                    itemReferenceHash: item.itemHash,
                    stackSize: item.stackSize ?? 1,
                    characterId: item.characterId,
                });
            await transferItem(profile, {
                membershipType: profile.type,
                itemId: instanceId,
                itemReferenceHash: item.itemHash,
                stackSize: item.stackSize ?? 1,
                characterId: item.characterId,
                transferToVault: true,
            });
            return [
                { item, to: 'vault' },
            ];
        }
        ItemTransfer.vaultItem = vaultItem;
        async function moveItemToCharacter(characterId, item) {
            const auth = await Auth_2.default.getValid();
            const profile = await Profiles_1.default.getCurrentProfile(auth);
            if (!profile) {
                Broadcast_7.default.warning('user', 'Unable to transfer item: Not authenticated');
                return [];
            }
            const instanceId = item.instanceId ?? '0';
            let needsVaultTransfer = true;
            if (item.isLostItem) {
                if (!item.characterId) {
                    Broadcast_7.default.warning('user', 'Unable to transfer item: Character required');
                    return [];
                }
                needsVaultTransfer = false;
                await pullFromPostmaster(profile, {
                    membershipType: profile.type,
                    itemId: instanceId,
                    itemReferenceHash: item.itemHash,
                    stackSize: item.stackSize ?? 1,
                    characterId: item.characterId,
                });
            }
            if (item.characterId && item.characterId !== characterId) {
                needsVaultTransfer = true;
                await transferItem(profile, {
                    membershipType: profile.type,
                    itemId: instanceId,
                    itemReferenceHash: item.itemHash,
                    stackSize: item.stackSize ?? 1,
                    characterId: item.characterId,
                    transferToVault: true,
                });
            }
            if (needsVaultTransfer)
                await transferItem(profile, {
                    membershipType: profile.type,
                    itemId: instanceId,
                    itemReferenceHash: item.itemHash,
                    stackSize: item.stackSize ?? 1,
                    characterId: characterId,
                    transferToVault: false,
                });
            return [
                { item, to: 'character', newCharacterId: characterId },
            ];
        }
        ItemTransfer.moveItemToCharacter = moveItemToCharacter;
    })(ItemTransfer || (ItemTransfer = {}));
    exports.default = ItemTransfer;
});
define("model/CombinedManifestVersion", ["require", "exports", "model/ClarityManifest", "model/DeepsightManifest", "model/DestinyManifest", "model/Model"], function (require, exports, ClarityManifest_2, DeepsightManifest_2, DestinyManifest_2, Model_6) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getVersions = getVersions;
    ClarityManifest_2 = __importDefault(ClarityManifest_2);
    DeepsightManifest_2 = __importDefault(DeepsightManifest_2);
    DestinyManifest_2 = __importDefault(DestinyManifest_2);
    Model_6 = __importDefault(Model_6);
    async function getVersions(hard) {
        const [destiny, deepsight, clarity] = await Promise.all([
            DestinyManifest_2.default.use(hard),
            DeepsightManifest_2.default.use(hard),
            ClarityManifest_2.default.use(hard),
        ]);
        if (hard)
            // trigger a hard update of CombinedManifestVersion, which will be a soft update of its dependencies
            void CombinedManifestVersion.use(hard).catch(() => { });
        return {
            combined: `destiny:${destiny.version} deepsight:${deepsight.version} clarity:${clarity.version}`,
            destiny: destiny.version,
            deepsight: deepsight.version,
            clarity: clarity.version,
            updated: destiny.updated || deepsight.updated || clarity.updated,
        };
    }
    const CombinedManifestVersion = (0, Model_6.default)('CombinedManifestVersion', {
        cacheDirtyTime: 1000 * 60 * 1, // 1 minute cache
        async fetch() {
            const versions = await getVersions();
            const version = versions.combined;
            return {
                version,
                value: version,
            };
        },
    });
    exports.default = CombinedManifestVersion;
});
define("model/Categorisation", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Categorisation;
    (function (Categorisation) {
        Categorisation.IsMasterwork = matcher('Masterwork/*');
        Categorisation.IsIntrinsic = matcher('Intrinsic/*');
        Categorisation.IsEnhanced = matcher('*Enhanced');
        Categorisation.IsEmpty = matcher('*Empty');
        Categorisation.IsDefault = matcher('*Default');
        Categorisation.IsShaderOrnament = matcher('Cosmetic/Shader', 'Cosmetic/Ornament');
        function matcher(...expressions) {
            const positiveExpressions = expressions.filter(expr => expr[0] !== '!');
            const negativeExpressions = expressions.filter(expr => expr[0] === '!').map(expr => expr.slice(1));
            return matcher;
            function matcher(categorised) {
                const categorisation = typeof categorised === 'string' ? categorised
                    : !categorised ? undefined
                        : 'fullName' in categorised ? categorised.fullName
                            : categorised?.type;
                if (!categorisation)
                    return false;
                if (positiveExpressions.length && !matchesExpressions(categorisation, positiveExpressions))
                    return false;
                if (negativeExpressions.length && matchesExpressions(categorisation, negativeExpressions))
                    return false;
                return true;
            }
            function matchesExpressions(categorisation, expressions) {
                for (const expression of expressions) {
                    if (expression === categorisation)
                        return true;
                    if (expression.startsWith('*'))
                        if (categorisation.endsWith(expression.slice(1)))
                            return true;
                        else
                            continue;
                    if (expression.endsWith('*'))
                        if (categorisation.startsWith(expression.slice(0, -1)))
                            return true;
                        else
                            continue;
                    if (expression.includes('*')) {
                        const [start, end] = expression.split('*');
                        if (categorisation.startsWith(start) && categorisation.endsWith(end))
                            return true;
                        else
                            continue;
                    }
                }
                return false;
            }
        }
        Categorisation.matcher = matcher;
    })(Categorisation || (Categorisation = {}));
    exports.default = Categorisation;
});
define("utility/Define", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function Define(proto, key, implementation) {
        try {
            Object.defineProperty(proto, key, {
                configurable: true,
                writable: true,
                value: implementation,
            });
        }
        catch { }
    }
    (function (Define) {
        function all(protos, key, implementation) {
            for (const proto of protos) {
                Define(proto, key, implementation);
            }
        }
        Define.all = all;
        function magic(obj, key, implementation) {
            try {
                Object.defineProperty(obj, key, {
                    configurable: true,
                    ...implementation,
                });
            }
            catch { }
        }
        Define.magic = magic;
        function set(obj, key, value) {
            try {
                Object.defineProperty(obj, key, {
                    configurable: true,
                    writable: true,
                    value,
                });
            }
            catch { }
            return value;
        }
        Define.set = set;
    })(Define || (Define = {}));
    exports.default = Define;
});
define("utility/Arrays", ["require", "exports", "utility/Define"], function (require, exports, Define_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.NonNullish = NonNullish;
    exports.Truthy = Truthy;
    Define_1 = __importDefault(Define_1);
    function NonNullish(value) {
        return value !== null && value !== undefined;
    }
    function Truthy(value) {
        return !!value;
    }
    var Arrays;
    (function (Arrays) {
        function applyPrototypes() {
            Define_1.default.set(Array.prototype, 'collect', function (collector, ...args) {
                return collector(this, ...args);
            });
            Define_1.default.set(Array.prototype, 'groupBy', function (keyGetter, resultMapper) {
                const map = new Map();
                for (let i = 0; i < this.length; i++) {
                    const item = this[i];
                    const key = keyGetter(item, i, this);
                    let group = map.get(key);
                    if (!group) {
                        group = [];
                        map.set(key, group);
                    }
                    group.push(item);
                }
                if (resultMapper)
                    for (const [key, group] of map)
                        map.set(key, resultMapper(group));
                return map;
            });
            Define_1.default.set(Array.prototype, 'toObject', function (mapper) {
                const obj = {};
                if (mapper)
                    for (let i = 0; i < this.length; i++) {
                        const item = this[i];
                        const [key, value] = mapper(item, i, this);
                        obj[key] = value;
                    }
                else
                    for (const [key, value] of this)
                        obj[key] = value;
                return obj;
            });
            (0, Define_1.default)(Array.prototype, 'distinct', function (mapper) {
                const result = [];
                const encountered = mapper ? [] : result;
                for (const value of this) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    const encounterValue = mapper ? mapper(value) : value;
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    if (encountered.includes(encounterValue))
                        continue;
                    if (mapper)
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                        encountered.push(encounterValue);
                    result.push(value);
                }
                return result;
            });
        }
        Arrays.applyPrototypes = applyPrototypes;
    })(Arrays || (Arrays = {}));
    exports.default = Arrays;
});
define("utility/Objects", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.mutable = mutable;
    function mutable(obj) {
        return obj;
    }
    var Objects;
    (function (Objects) {
        function type() {
            return {
                stripUndefined(obj) {
                    for (const key in obj) {
                        if (obj[key] === undefined) {
                            delete obj[key];
                        }
                    }
                    return obj;
                },
            };
        }
        Objects.type = type;
    })(Objects || (Objects = {}));
    exports.default = Objects;
});
define("model/Items", ["require", "exports", "model/Categorisation", "model/Definitions", "utility/Arrays", "utility/Broadcast", "utility/Log", "utility/Objects"], function (require, exports, Categorisation_1, Definitions_3, Arrays_1, Broadcast_8, Log_3, Objects_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ITEMS_VERSION = void 0;
    Categorisation_1 = __importDefault(Categorisation_1);
    Definitions_3 = __importDefault(Definitions_3);
    Broadcast_8 = __importDefault(Broadcast_8);
    Log_3 = __importDefault(Log_3);
    exports.ITEMS_VERSION = '29';
    const STATS_ARMOUR = new Set([
        392767087 /* StatHashes.Health */,
        4244567218 /* StatHashes.Melee4244567218 */,
        1735777505 /* StatHashes.Grenade */,
        144602215 /* StatHashes.Super */,
        1943323491 /* StatHashes.Class1943323491 */,
        2996146975 /* StatHashes.Weapons */,
    ]);
    var Items;
    (function (Items) {
        class ItemProvider {
            #config;
            constructor(config, provider) {
                this.#config = config;
                Object.assign(this, provider);
            }
            item(hash) {
                if (!hash)
                    return undefined;
                const def = this.#config.DestinyInventoryItemDefinition[hash];
                if (!def)
                    return undefined;
                this.#config.item(hash, def);
                return def;
            }
            plug(hash) {
                if (!hash)
                    return undefined;
                return this.#config.plug(hash);
            }
        }
        Items.ItemProvider = ItemProvider;
        async function provider(profile, type) {
            const [
            // ClarityDescriptions,
            DeepsightDropTableDefinition, DeepsightFormattedClarityDescriptions, DeepsightItemDamageTypesDefinition, DeepsightItemSourceDefinition, DeepsightItemSourceListDefinition, DeepsightMomentDefinition, DeepsightPlugCategorisation, DeepsightSocketCategorisation, DeepsightSocketExtendedDefinition, DeepsightStats, DeepsightTierTypeDefinition, DeepsightWeaponFoundryDefinition, DestinyDamageTypeDefinition, DestinyEquipableItemSetDefinition, DestinyEventCardDefinition, DestinyInventoryItemDefinition, DestinyPlugSetDefinition, DestinyPresentationNodeDefinition, DestinySandboxPerkDefinition, DestinySocketCategoryDefinition, DestinyStatDefinition, DestinyStatGroupDefinition,] = await Promise.all([
                // Definitions.en.ClarityDescriptions.get(),
                Definitions_3.default.en.DeepsightDropTableDefinition.get(),
                Definitions_3.default.en.DeepsightFormattedClarityDescriptions.get(),
                Definitions_3.default.en.DeepsightItemDamageTypesDefinition.get(),
                Definitions_3.default.en.DeepsightItemSourceDefinition.get(),
                Definitions_3.default.en.DeepsightItemSourceListDefinition.get(),
                Definitions_3.default.en.DeepsightMomentDefinition.get(),
                Definitions_3.default.en.DeepsightPlugCategorisation.get(),
                Definitions_3.default.en.DeepsightSocketCategorisation.get(),
                Definitions_3.default.en.DeepsightSocketExtendedDefinition.get(),
                Definitions_3.default.en.DeepsightStats.get(),
                Definitions_3.default.en.DeepsightTierTypeDefinition.get(),
                Definitions_3.default.en.DeepsightWeaponFoundryDefinition.get(),
                Definitions_3.default.en.DestinyDamageTypeDefinition.get(),
                Definitions_3.default.en.DestinyEquipableItemSetDefinition.get(),
                Definitions_3.default.en.DestinyEventCardDefinition.get(),
                Definitions_3.default.en.DestinyInventoryItemDefinition.get(),
                Definitions_3.default.en.DestinyPlugSetDefinition.get(),
                Definitions_3.default.en.DestinyPresentationNodeDefinition.get(),
                Definitions_3.default.en.DestinySandboxPerkDefinition.get(),
                Definitions_3.default.en.DestinySocketCategoryDefinition.get(),
                Definitions_3.default.en.DestinyStatDefinition.get(),
                Definitions_3.default.en.DestinyStatGroupDefinition.get(),
            ]);
            const perks = {};
            const dropTableItems = Object.values(DeepsightDropTableDefinition)
                .map(table => [table, [
                    ...Object.keys(table.dropTable ?? {}),
                    ...Object.keys(table.master?.dropTable ?? {}),
                    ...(table.encounters ?? [])
                        .flatMap(encounter => Object.keys(encounter.dropTable ?? {})),
                ].map(item => +item)]);
            const moments = Object.values(DeepsightMomentDefinition);
            const items = {};
            function item(hash, def) {
                const sockets = def.sockets?.socketEntries.map((entryDef, i) => socket(hash, i, entryDef)) ?? [];
                const item = {
                    is: 'item',
                    hash,
                    displayProperties: def.displayProperties,
                    momentHash: (_
                        ?? moments.find(moment => moment.itemHashes?.includes(hash))?.hash
                        ?? moments.find(moment => [moment.iconWatermark, ...moment.subsumeIconWatermarks ?? []].includes(def.iconWatermark))?.hash),
                    featured: def.isFeaturedItem,
                    type: def.itemTypeDisplayName,
                    rarity: def.inventory?.tierTypeHash ?? 3340296461 /* ItemTierTypeHashes.Common */,
                    classType: def.classType,
                    damageTypeHashes: DeepsightItemDamageTypesDefinition[hash]?.damageTypes ?? def.damageTypeHashes,
                    ammoType: def.equippingBlock?.ammoType,
                    sockets,
                    statGroupHash: def.stats?.statGroupHash,
                    stats: stats(def, undefined, sockets),
                    itemSetHash: itemSetHash(def),
                    flavorText: def.flavorText,
                    sources: [
                        ...DeepsightItemSourceListDefinition[hash]?.sources.map((id) => ({
                            type: 'defined',
                            id,
                            eventState: !DeepsightItemSourceDefinition[id]?.event ? undefined
                                : DeepsightItemSourceDefinition[id]?.event === DeepsightStats.activeEvent ? 'active'
                                    : new Date(DestinyEventCardDefinition[DeepsightItemSourceDefinition[id]?.event]?.endTime ?? 0).getTime() > Date.now() ? 'upcoming'
                                        : 'unknown',
                        })) ?? [],
                        ...dropTableItems.filter(([, items]) => items.includes(hash)).map(([table]) => ({ type: 'table', id: table.hash })),
                    ],
                    previewImage: def.screenshot,
                    foundryHash: Object.values(DeepsightWeaponFoundryDefinition).find(foundry => foundry.overlay === def.secondaryIcon)?.hash,
                    categoryHashes: [
                        ...def.itemCategoryHashes,
                        (!def.itemCategoryHashes?.includes(34 /* ItemCategoryHashes.Engrams */) && def.uiItemDisplayStyle === 'ui_display_style_engram'
                            && 34 /* ItemCategoryHashes.Engrams */),
                    ].filter(Arrays_1.Truthy),
                    bucketHash: def.inventory?.bucketTypeHash,
                    maxStackSize: def.inventory?.maxStackSize,
                };
                if (!item.momentHash && def.iconWatermark && !def.plug) {
                    Log_3.default.warn(`${def.displayProperties.name} (${def.hash}) has watermark but no moment. https://new.deepsight.gg/data/DestinyInventoryItemDefinition/${def.hash}`);
                    Broadcast_8.default.warning('conduit', 'Item has watermark but no moment', [item]);
                }
                if (def.plug)
                    plug(hash);
                items[hash] = item;
                return hash;
            }
            function itemSetHash(def) {
                const hash = def.equippingBlock?.equipableItemSetHash;
                if (!hash)
                    return undefined;
                const setDef = DestinyEquipableItemSetDefinition[hash];
                for (const perk of setDef?.setPerks ?? [])
                    perks[perk.sandboxPerkHash] = DestinySandboxPerkDefinition[perk.sandboxPerkHash];
                return hash;
            }
            ////////////////////////////////////
            //#region Plugs
            function socket(itemHash, socketIndex, entryDef) {
                const categorisationFullName = DeepsightSocketCategorisation[itemHash]?.categorisation[socketIndex]?.fullName ?? 'None';
                if (!entryDef.plugSources)
                    (0, Objects_1.mutable)(entryDef).plugSources = 2 /* SocketPlugSources.ReusablePlugItems */;
                const plugHashes = Categorisation_1.default.IsShaderOrnament(categorisationFullName) ? []
                    : Array.from(new Set([
                        ...entryDef.singleInitialItemHash ? [entryDef.singleInitialItemHash] : [],
                        ...DeepsightSocketExtendedDefinition[itemHash]?.sockets[socketIndex]?.rewardPlugItems.map(plug => plug.plugItemHash) ?? [],
                        ...!(entryDef.plugSources & 2 /* SocketPlugSources.ReusablePlugItems */) ? []
                            : [
                                ...entryDef.reusablePlugItems.map(plug => plug.plugItemHash),
                                ...DestinyPlugSetDefinition[entryDef.reusablePlugSetHash]?.reusablePlugItems.map(plug => plug.plugItemHash) ?? [],
                                ...DestinyPlugSetDefinition[entryDef.randomizedPlugSetHash]?.reusablePlugItems.map(plug => plug.plugItemHash) ?? [],
                            ],
                    ]));
                return {
                    type: categorisationFullName,
                    defaultPlugHash: entryDef.singleInitialItemHash,
                    plugs: plugHashes.map(plug).filter(plug => plug !== undefined).map(plug => plug.hash),
                };
            }
            const plugs = {};
            function plug(hash) {
                if (hash in plugs)
                    return plugs[hash];
                const def = DestinyInventoryItemDefinition[hash];
                if (!def.plug)
                    return plugs[hash] = undefined;
                const categorisation = DeepsightPlugCategorisation[hash];
                const perkHashes = def.perks?.map(perk => perk.perkHash) ?? [];
                for (const perkHash of perkHashes)
                    perks[perkHash] = DestinySandboxPerkDefinition[perkHash];
                return plugs[hash] = {
                    is: 'plug',
                    hash,
                    displayProperties: def.displayProperties,
                    type: categorisation?.fullName ?? 'None',
                    enhanced: Categorisation_1.default.IsEnhanced(categorisation?.fullName) ?? false,
                    clarity: DeepsightFormattedClarityDescriptions[hash],
                    perks: perkHashes,
                    stats: stats(def),
                    categoryHash: def.plug.plugCategoryHash,
                };
            }
            function socketedPlug(socket) {
                return plugs[socket.defaultPlugHash];
            }
            function socketedPlugDef(socket) {
                const plug = socketedPlug(socket);
                return plug ? DestinyInventoryItemDefinition[plug.hash] : undefined;
            }
            // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
            function plugCat(hash, category) {
                if (!hash)
                    return undefined;
                const categorisation = DeepsightPlugCategorisation[hash];
                if (!categorisation || (category !== undefined && categorisation.categoryName !== category))
                    return undefined;
                return categorisation;
            }
            //#endregion
            ////////////////////////////////////
            ////////////////////////////////////
            //#region Stats
            const HasMasterworkStats = Categorisation_1.default.matcher('Masterwork/*', 'Intrinsic/FrameEnhanced');
            const NotMasterworkNotIntrinsic = Categorisation_1.default.matcher('!Intrinsic/*', '!Masterwork/*');
            const ArmorMod = Categorisation_1.default.matcher('Mod/Armor');
            function stats(def, ref, sockets = []) {
                if (!def.stats) {
                    const cat = plugCat(def.hash);
                    return Object.fromEntries(def.investmentStats?.map(stat => [
                        stat.statTypeHash,
                        {
                            hash: stat.statTypeHash,
                            value: stat.value,
                            intrinsic: 0,
                            roll: 0,
                            mod: !ArmorMod(cat?.fullName) ? 0 : stat.value,
                            masterwork: 0,
                            subclass: 0,
                            charge: !ArmorMod(cat) ? 0
                                : (cat.armourChargeStats
                                    ?.find(({ statTypeHash }) => statTypeHash === stat.statTypeHash)
                                    ?.value
                                    ?? 0),
                        },
                    ]) ?? []);
                }
                const statGroupDefinition = DestinyStatGroupDefinition[def.stats?.statGroupHash ?? NaN];
                const intrinsicStats = def.investmentStats;
                const statRolls = sockets.filter(Categorisation_1.default.IsIntrinsic)
                    .flatMap(socket => socketedPlugDef(socket)?.investmentStats ?? []);
                const instanceId = ref?.itemInstanceId;
                const stats = profile?.itemComponents?.stats.data?.[instanceId]?.stats ?? def.stats.stats;
                if (stats)
                    for (const random of statRolls)
                        if (random && !random.isConditionallyActive)
                            stats[random.statTypeHash] ??= { statHash: random.statTypeHash, value: random.value };
                for (const stat of statGroupDefinition?.scaledStats ?? [])
                    if (!(stat.statHash in stats) && !STATS_ARMOUR.has(stat.statHash))
                        stats[stat.statHash] = { statHash: stat.statHash, value: 0 };
                const masterworkStats = type === 'collections' ? []
                    : sockets.filter(HasMasterworkStats).flatMap(socket => socketedPlugDef(socket)?.investmentStats ?? []);
                const modStats = type === 'collections' ? []
                    : sockets.filter(NotMasterworkNotIntrinsic).flatMap(socket => socketedPlugDef(socket)?.investmentStats ?? []);
                const chargeStats = type === 'collections' ? []
                    : sockets.filter(ArmorMod).flatMap(socket => plugCat(socket.defaultPlugHash, 'Mod')?.armourChargeStats ?? []);
                const result = {};
                if (stats)
                    for (const [hashString, { value }] of Object.entries(stats)) {
                        const hash = +hashString;
                        const statDefinition = DestinyStatDefinition[hash];
                        if (!statDefinition) {
                            console.warn('Unknown stat', hash, 'value', value);
                            continue;
                        }
                        const display = statGroupDefinition?.scaledStats.find(stat => stat.statHash === hash);
                        if (!display)
                            continue;
                        const stat = result[hash] = {
                            hash,
                            value,
                            max: hash === 2961396640 /* StatHashes.ChargeTime */ && def.itemSubType === 11 /* DestinyItemSubType.FusionRifle */ ? 1000 : display?.maximumValue ?? 100,
                            displayAsNumeric: display?.displayAsNumeric || undefined,
                            intrinsic: 0,
                            roll: 0,
                            mod: 0,
                            masterwork: 0,
                            subclass: !def.itemCategoryHashes?.includes(50 /* ItemCategoryHashes.Subclasses */) ? 0 : value,
                            charge: 0,
                        };
                        function interpolate(value) {
                            if (!display?.displayInterpolation.length)
                                return value;
                            const start = display.displayInterpolation.findLast(stat => stat.value <= value) ?? display.displayInterpolation[0];
                            const end = display.displayInterpolation.find(stat => stat.value > value) ?? display.displayInterpolation[display.displayInterpolation.length - 1];
                            if (start === end)
                                return start.weight;
                            const t = (value - start.value) / (end.value - start.value);
                            return bankersRound(start.weight + t * (end.weight - start.weight));
                        }
                        for (const intrinsic of intrinsicStats)
                            if (intrinsic?.statTypeHash === hash && !intrinsic.isConditionallyActive)
                                stat.intrinsic += intrinsic.value;
                        for (const random of statRolls)
                            if (hash === random?.statTypeHash && !random.isConditionallyActive)
                                stat.roll += random.value;
                        for (const masterwork of masterworkStats)
                            if (hash === masterwork.statTypeHash && !masterwork.isConditionallyActive)
                                stat.masterwork += masterwork.value;
                        for (const mod of modStats)
                            if (hash === mod?.statTypeHash && !mod.isConditionallyActive)
                                stat.mod += mod.value;
                        let chargeCount = 0;
                        for (const mod of chargeStats)
                            if (hash === mod?.statTypeHash)
                                stat.charge = typeof mod.value === 'number' ? mod.value : mod.value[chargeCount++];
                        const { intrinsic, roll, masterwork, mod } = stat;
                        stat.intrinsic = interpolate(intrinsic + roll);
                        stat.roll = interpolate(roll);
                        stat.mod = interpolate(intrinsic + roll + mod) - stat.intrinsic;
                        stat.masterwork = interpolate(intrinsic + roll + masterwork) - stat.intrinsic;
                    }
                return result;
            }
            //#endregion
            ////////////////////////////////////
            return new ItemProvider({
                DestinyInventoryItemDefinition,
                item,
                plug,
            }, {
                items,
                plugs: plugs,
                perks,
                ammoTypes: {
                    [1 /* DestinyAmmunitionType.Primary */]: {
                        hash: 1 /* DestinyAmmunitionType.Primary */,
                        displayProperties: DestinyPresentationNodeDefinition[1731162900 /* PresentationNodeHashes.Primary1731162900 */].displayProperties,
                    },
                    [2 /* DestinyAmmunitionType.Special */]: {
                        hash: 2 /* DestinyAmmunitionType.Special */,
                        displayProperties: DestinyPresentationNodeDefinition[638914517 /* PresentationNodeHashes.Special_Scope1 */].displayProperties,
                    },
                    [3 /* DestinyAmmunitionType.Heavy */]: {
                        hash: 3 /* DestinyAmmunitionType.Heavy */,
                        displayProperties: DestinyPresentationNodeDefinition[3253265639 /* PresentationNodeHashes.Heavy3253265639 */].displayProperties,
                    },
                },
                rarities: DeepsightTierTypeDefinition,
                damageTypes: DestinyDamageTypeDefinition,
                stats: DestinyStatDefinition,
                statGroups: DestinyStatGroupDefinition,
                itemSets: DestinyEquipableItemSetDefinition,
                sources: DeepsightItemSourceDefinition,
                dropTables: DeepsightDropTableDefinition,
                socketCategories: DestinySocketCategoryDefinition,
                foundries: DeepsightWeaponFoundryDefinition,
            });
        }
        Items.provider = provider;
        /**
         * Note: This implementation matches DIM's to ensure consistency between apps.
         * See: https://github.com/DestinyItemManager/DIM/blob/83ec236416fae879c09f4aa93be7d3be4843510d/src/app/inventory/store/stats.ts#L582-L585
         * Also see: https://github.com/Bungie-net/api/issues/1029#issuecomment-531849137
         */
        function bankersRound(x) {
            const r = Math.round(x);
            return (x > 0 ? x : -x) % 1 === 0.5 ? (0 === r % 2 ? r : r - 1) : r;
        }
        Items.bankersRound = bankersRound;
    })(Items || (Items = {}));
    exports.default = Items;
});
define("model/Collections", ["require", "exports", "model/CombinedManifestVersion", "model/Definitions", "model/DestinyProfiles", "model/Items", "model/ProfiledModel", "utility/Broadcast"], function (require, exports, CombinedManifestVersion_1, Definitions_4, DestinyProfiles_1, Items_1, ProfiledModel_2, Broadcast_9) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    CombinedManifestVersion_1 = __importDefault(CombinedManifestVersion_1);
    Definitions_4 = __importDefault(Definitions_4);
    DestinyProfiles_1 = __importDefault(DestinyProfiles_1);
    Items_1 = __importStar(Items_1);
    Broadcast_9 = __importDefault(Broadcast_9);
    const version = `29.${Items_1.ITEMS_VERSION}`;
    function buckets() {
        return {
            [1498876634 /* InventoryBucketHashes.KineticWeapons */]: { items: [] },
            [2465295065 /* InventoryBucketHashes.EnergyWeapons */]: { items: [] },
            [953998645 /* InventoryBucketHashes.PowerWeapons */]: { items: [] },
            [3448274439 /* InventoryBucketHashes.Helmet */]: { items: [] },
            [3551918588 /* InventoryBucketHashes.Gauntlets */]: { items: [] },
            [14239492 /* InventoryBucketHashes.ChestArmor */]: { items: [] },
            [20886954 /* InventoryBucketHashes.LegArmor */]: { items: [] },
            [1585787867 /* InventoryBucketHashes.ClassArmor */]: { items: [] },
        };
    }
    exports.default = (0, ProfiledModel_2.ProfiledModel)('Collections', {
        cacheDirtyTime: 1000 * 60 * 1, // 1 minute cache time
        async fetch(profile) {
            const data = await DestinyProfiles_1.default.for(profile).get();
            return {
                version: `${version}/${await CombinedManifestVersion_1.default.get()}/${data?.responseMintedTimestamp ?? 'n/a'}`,
                value: async () => {
                    return await Broadcast_9.default.operation('Resolving collections', async () => {
                        const [DeepsightCollectionsDefinition, DeepsightMomentDefinition,] = await Promise.all([
                            Definitions_4.default.en.DeepsightCollectionsDefinition.get(),
                            Definitions_4.default.en.DeepsightMomentDefinition.get(),
                        ]);
                        const provider = await Items_1.default.provider(data, 'collections');
                        return {
                            ...{ version },
                            moments: (Object.values(DeepsightMomentDefinition)
                                .map((moment) => ({
                                moment,
                                buckets: Object.assign(buckets(), Object.entries(DeepsightCollectionsDefinition[moment.hash]?.buckets || {})
                                    .map(([bucketHash, itemHashes]) => [bucketHash, {
                                        items: itemHashes.map(hash => provider.item(hash)?.hash).filter(item => item !== undefined),
                                    }])
                                    .collect(Object.fromEntries)),
                            }))
                                .sort((a, b) => b.moment.hash - a.moment.hash)),
                            ...provider,
                        };
                    });
                },
            };
        },
    });
});
define("model/DefinitionsComponentNames", ["require", "exports", "model/DeepsightManifest", "model/DestinyManifest", "model/Model"], function (require, exports, DeepsightManifest_3, DestinyManifest_3, Model_7) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    DeepsightManifest_3 = __importDefault(DeepsightManifest_3);
    DestinyManifest_3 = __importDefault(DestinyManifest_3);
    Model_7 = __importDefault(Model_7);
    exports.default = (0, Model_7.default)('DefinitionsComponentNames', {
        cacheDirtyTime: 1000 * 60 * 1, // 1 minute cache
        async fetch() {
            const [destiny, deepsight,
            // clarity,
            ] = await Promise.all([
                DestinyManifest_3.default.use(),
                DeepsightManifest_3.default.use(),
                // ClarityManifest.use(),
            ]);
            const version = `destiny:${destiny.version} deepsight:${deepsight.version} clarity:${ /* clarity.version */'N/A'}`;
            return {
                version,
                value: [
                    ...Object.keys(destiny.value.en),
                    ...(Object.keys(deepsight.value.manifest)
                        .filter((name) => name.startsWith('Deepsight'))),
                    'ClarityDescriptions',
                ],
            };
        },
    });
});
define("model/Inventory", ["require", "exports", "model/Definitions", "model/DestinyProfiles", "model/Items", "model/ProfiledModel", "utility/Broadcast", "utility/Colour"], function (require, exports, Definitions_5, DestinyProfiles_2, Items_2, ProfiledModel_3, Broadcast_10, Colour_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Definitions_5 = __importDefault(Definitions_5);
    DestinyProfiles_2 = __importDefault(DestinyProfiles_2);
    Items_2 = __importStar(Items_2);
    Broadcast_10 = __importDefault(Broadcast_10);
    Colour_2 = __importDefault(Colour_2);
    const version = `8.${Items_2.ITEMS_VERSION}`;
    exports.default = (0, ProfiledModel_3.ProfiledModel)('Inventory', {
        cacheDirtyTime: 1000 * 10, // 10 second cache time
        async fetch(profile) {
            const data = await DestinyProfiles_2.default.for(profile).get();
            return {
                version: `${version}/${data?.responseMintedTimestamp ?? 'n/a'}`,
                value: async () => {
                    if (!data)
                        return undefined;
                    return await Broadcast_10.default.operation('Resolving inventory', async () => {
                        const [DestinyClassDefinition, DestinyInventoryBucketDefinition, DeepsightEmblemDefinition, 
                        // DeepsightSocketCategorisation,
                        DestinySocketTypeDefinition,] = await Promise.all([
                            Definitions_5.default.en.DestinyClassDefinition.get(),
                            Definitions_5.default.en.DestinyInventoryBucketDefinition.get(),
                            Definitions_5.default.en.DeepsightEmblemDefinition.get(),
                            // Definitions.en.DeepsightSocketCategorisation.get(),
                            Definitions_5.default.en.DestinySocketTypeDefinition.get(),
                        ]);
                        const characterPlugSets = {};
                        const profilePlugSets = {};
                        const socketTypes = {};
                        const useCharacterPlugSet = (character, plugSetHash) => {
                            characterPlugSets[character] ??= {};
                            characterPlugSets[character][plugSetHash] ??= data.characterPlugSets?.data?.[character]?.plugs?.[plugSetHash] ?? [];
                            return plugSetHash;
                        };
                        const useProfilePlugSet = (plugSetHash) => {
                            profilePlugSets[plugSetHash] ??= data.profilePlugSets?.data?.plugs?.[plugSetHash] ?? [];
                            return plugSetHash;
                        };
                        const useSocketType = (socketTypeHash) => {
                            socketTypes[socketTypeHash] ??= DestinySocketTypeDefinition[socketTypeHash];
                            return socketTypeHash;
                        };
                        const provider = await Items_2.default.provider(data, 'instance');
                        const characters = Object.values(data.characters?.data ?? {});
                        const ItemInstance = (item, characterId) => {
                            const itemInstance = data.itemComponents?.instances?.data?.[item.itemInstanceId];
                            const itemSockets = data.itemComponents?.sockets.data?.[item.itemInstanceId];
                            const def = provider.item(item.itemHash);
                            const plugs = data.itemComponents?.reusablePlugs.data?.[item.itemInstanceId]?.plugs;
                            return {
                                is: 'item-instance',
                                id: item.itemInstanceId,
                                itemHash: item.itemHash,
                                bucketHash: item.bucketHash,
                                tier: itemInstance?.gearTier,
                                quantity: item.quantity,
                                state: item.state,
                                sockets: def?.sockets?.socketEntries.map((socket, i) => {
                                    const plugDef = provider.item(itemSockets?.sockets?.[i]?.plugHash);
                                    provider.plug(plugDef?.hash);
                                    return {
                                        plugHash: plugDef?.plug?.isDummyPlug ? undefined : plugDef?.hash,
                                        availableReusablePlugs: plugs?.[i],
                                        availableCharacterPlugSet: socket.plugSources & 8 /* SocketPlugSources.CharacterPlugSet */ ? useCharacterPlugSet(characterId, socket.reusablePlugSetHash) : undefined,
                                        availableProfilePlugSet: socket.plugSources & 4 /* SocketPlugSources.ProfilePlugSet */ ? useProfilePlugSet(socket.reusablePlugSetHash) : undefined,
                                        availableInventoryPlugsSocketType: socket.plugSources & 1 /* SocketPlugSources.InventorySourced */ ? useSocketType(socket.socketTypeHash) : undefined,
                                    };
                                    // availablePlugs: ([
                                    // 	plugs?.[i],
                                    // 	socket.plugSources & SocketPlugSources.CharacterPlugSet && characterPlugSets?.[socket.reusablePlugSetHash!],
                                    // 	socket.plugSources & SocketPlugSources.ProfilePlugSet && profilePlugSets?.[socket.reusablePlugSetHash!],
                                    // 	socket.plugSources & SocketPlugSources.ReusablePlugItems && socket.reusablePlugItems,
                                    // 	socket.plugSources & SocketPlugSources.InventorySourced && DestinySocketTypeDefinition[socket.socketTypeHash]?.plugWhitelist && (data.profileInventory?.data?.items
                                    // 		.filter(plug => {
                                    // 			if (plug.bucketHash !== InventoryBucketHashes.Modifications)
                                    // 				return false
                                    // 			const socketPlugWhitelist = DestinySocketTypeDefinition[socket.socketTypeHash].plugWhitelist
                                    // 			const plugDef = provider.item(plug.itemHash)
                                    // 			return !!plugDef?.plug
                                    // 				&& socketPlugWhitelist.some(wh => wh.categoryHash === plugDef.plug?.plugCategoryHash)
                                    // 		})
                                    // 		.map((plug): DestinyItemSocketEntryPlugItemDefinition => ({ plugItemHash: plug.itemHash }))
                                    // 	),
                                    // ]
                                    // 	.filter(Truthy)
                                    // 	.flat()
                                    // 	.distinct(i => i.plugItemHash)
                                    // ),
                                    // }
                                }),
                            };
                        };
                        return {
                            ...{ version },
                            ...provider,
                            characters: characters.toObject(character => [character.characterId, {
                                    is: 'character',
                                    id: character.characterId,
                                    metadata: character,
                                    emblem: !character.emblemHash ? undefined : {
                                        hash: character.emblemHash,
                                        displayProperties: DeepsightEmblemDefinition[character.emblemHash].displayProperties,
                                        background: Colour_2.default.fromDestiny(DeepsightEmblemDefinition[character.emblemHash].backgroundColor),
                                        secondaryIcon: DeepsightEmblemDefinition[character.emblemHash].secondaryIcon,
                                        secondaryOverlay: DeepsightEmblemDefinition[character.emblemHash].secondaryOverlay,
                                        secondarySpecial: DeepsightEmblemDefinition[character.emblemHash].secondarySpecial,
                                    },
                                    equippedItems: ((data.characterEquipment?.data?.[character.characterId]?.items ?? [])
                                        .map(item => ItemInstance(item))),
                                    items: ((data.characterInventories?.data?.[character.characterId]?.items ?? [])
                                        .map(item => ItemInstance(item))),
                                    plugSets: characterPlugSets[character.characterId],
                                }]),
                            profileItems: data.profileInventory?.data?.items?.map(item => ItemInstance(item)) ?? [],
                            profilePlugSets,
                            socketTypes,
                            classes: DestinyClassDefinition,
                            buckets: DestinyInventoryBucketDefinition,
                        };
                    });
                },
            };
        },
    });
});
define("utility/FilterHelper", ["require", "exports", "jsonpath-plus"], function (require, exports, jsonpath_plus_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function array(value) {
        return Array.isArray(value) ? value : [value];
    }
    var FilterHelper;
    (function (FilterHelper) {
        function* filter(defs, search) {
            if (!search.nameContainsOrHashIs && !search.deepContains && !search.jsonPathExpression && !search.evalExpression)
                throw new Error('At least one filter criterion must be specified');
            const nameRegex = !search.nameContainsOrHashIs ? undefined
                : array(search.nameContainsOrHashIs)
                    .map(name => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'));
            const predicate = search.evalExpression && eval(search.evalExpression);
            if (predicate && typeof predicate !== 'function')
                throw new Error('evalExpression did not evaluate to a predicate function');
            for (const key in defs) {
                const def = defs[key];
                if (typeof def !== 'object' || def === null)
                    continue;
                let hashMatch = false;
                if (nameRegex) {
                    let nameMatch = false;
                    const name = def.displayProperties?.name;
                    if (array(search.nameContainsOrHashIs).includes(`${def.hash}`))
                        hashMatch = true;
                    else if (name && nameRegex.every(regex => regex.test(name)))
                        nameMatch = true;
                    if (!nameMatch && !hashMatch)
                        continue;
                }
                if (search.deepContains)
                    if (array(search.deepContains).some(contains => !deepContains(def, contains)))
                        continue;
                if (search.jsonPathExpression)
                    if (array(search.jsonPathExpression).some(expr => !(0, jsonpath_plus_1.JSONPath)({ path: expr, json: [def], resultType: 'value', wrap: true }).length))
                        continue;
                if (predicate && !predicate(def))
                    continue;
                yield [key, def];
                if (hashMatch)
                    // there's only ever one def with a given hash
                    return;
            }
        }
        FilterHelper.filter = filter;
        function deepContains(value, search) {
            if (typeof value === 'string')
                return value.toLowerCase().includes(search.toLowerCase());
            if (typeof value === 'number')
                return `${value}` === search;
            if (typeof value !== 'object' || value === null)
                return false;
            if (Array.isArray(value))
                return value.some(item => deepContains(item, search));
            const obj = value;
            for (const key in obj)
                if (deepContains(obj[key], search))
                    return true;
            return false;
        }
    })(FilterHelper || (FilterHelper = {}));
    exports.default = FilterHelper;
});
define("utility/Service", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SKIP_CLIENT = void 0;
    // const origins = new Map<string, string>()
    exports.SKIP_CLIENT = Symbol('SKIP_CLIENT');
    const service = Object.assign(self, {
        broadcast: new Proxy({}, {
            get: (target, type) => {
                return async (data, options) => {
                    if (typeof type !== 'string' || !type)
                        throw new Error('Invalid broadcast type');
                    for (const client of await service.clients.matchAll({ includeUncontrolled: true, type: 'window' })) {
                        void (async () => {
                            if (typeof data === 'function') {
                                const origin = await getOrigin(client);
                                if (!origin)
                                    return;
                                const clientData = await data(origin);
                                if (clientData === exports.SKIP_CLIENT)
                                    return;
                                client.postMessage({ id: 'global', type, data: clientData }, options);
                            }
                            else
                                client.postMessage({ id: 'global', type, data }, options);
                        })().catch(() => { });
                    }
                };
            },
        }),
    });
    const awaitingOrigins = new Map();
    async function getOrigin(client) {
        client.postMessage({ id: 'global', type: '_getOrigin' });
        return new Promise(resolve => {
            const timeout = self.setTimeout(() => resolve(undefined), 500);
            awaitingOrigins.set(client.id, origin => {
                resolve(origin);
                awaitingOrigins.delete(client.id);
                clearTimeout(timeout);
            });
        });
    }
    function Service(definition) {
        const realService = service;
        service.onInstall = event => definition.onInstall(realService, event);
        service.onActivate = event => definition.onActivate(realService, event);
        service.onCall = async (event) => {
            if (typeof event.data !== 'object' || !('type' in event.data))
                throw new Error('Unsupported message type');
            const { id, type, origin, data, frame } = event.data;
            if (id === 'global' && type === 'resolve:_getOrigin') {
                if (Array.isArray(data) && typeof data[0] === 'string')
                    awaitingOrigins.get(event.source.id)?.(data[0]);
                return;
            }
            Object.defineProperty(event, 'origin', { get() { return origin ?? 'bad.origin'; }, configurable: true });
            // const clientId = (event.source as WindowClient).id
            // if (!frame || !origins.has(clientId))
            // 	origins.set(clientId, origin ?? 'bad.origin')
            try {
                const fn = definition.onCall[type];
                if (!fn)
                    throw new Error(`The function '${type}' does not exist`);
                const params = data === undefined ? [] : !Array.isArray(data) ? [data] : data;
                const result = await Promise.resolve(definition.onCall[type](event, ...params));
                event.source?.postMessage({ id, type: `resolve:${type}`, origin, data: result, frame });
            }
            catch (err) {
                event.source?.postMessage({ id, type: `reject:${type}`, origin, data: err, frame });
            }
        };
        service.setRegistered();
        definition.onRegistered?.(realService);
        return realService;
    }
    exports.default = Service;
});
define("Conduit", ["require", "exports", "action/ItemTransfer", "model/Auth", "model/Collections", "model/CombinedManifestVersion", "model/Definitions", "model/DefinitionsComponentNames", "model/Inventory", "model/Profiles", "utility/Database", "utility/Env", "utility/FilterHelper", "utility/Service", "utility/Store"], function (require, exports, ItemTransfer_1, Auth_3, Collections_1, CombinedManifestVersion_2, Definitions_6, DefinitionsComponentNames_1, Inventory_1, Profiles_2, Database_4, Env_3, FilterHelper_1, Service_1, Store_6) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    ItemTransfer_1 = __importDefault(ItemTransfer_1);
    Auth_3 = __importDefault(Auth_3);
    Collections_1 = __importDefault(Collections_1);
    Definitions_6 = __importDefault(Definitions_6);
    DefinitionsComponentNames_1 = __importDefault(DefinitionsComponentNames_1);
    Inventory_1 = __importDefault(Inventory_1);
    Profiles_2 = __importDefault(Profiles_2);
    Env_3 = __importDefault(Env_3);
    FilterHelper_1 = __importDefault(FilterHelper_1);
    Service_1 = __importStar(Service_1);
    Store_6 = __importStar(Store_6);
    if (!Env_3.default.BUNGIE_API_KEY)
        throw new Error('BUNGIE_API_KEY is not set');
    const _ = undefined;
    class ConduitPrivateFunctionError extends Error {
        constructor() {
            super('This is an internal action that can only be performed by the conduit iframe');
        }
    }
    class ConduitFunctionRequiresTrustedOriginError extends Error {
        constructor() {
            super('This action can only be performed by a trusted origin');
        }
    }
    const service = (0, Service_1.default)({
        async onInstall(service, event) {
        },
        async onActivate(service, event) {
            console.log(await Definitions_6.default.en.DestinySeasonDefinition.get());
        },
        onRegistered(service) {
            void service.broadcast.ready();
            (0, Store_6.onUpdateStore)(key => {
                if (key === 'auth' || key === 'origins' || key === 'customApp' || key === 'destinyProfileOverrides')
                    return;
                const expectedKeyType = key;
                expectedKeyType;
                void service.broadcast._updateSettings();
            });
        },
        onCall: {
            ////////////////////////////////////
            //#region Profiles
            getProfiles: event => getProfiles(event),
            updateProfiles: () => updateProfiles(),
            async getProfile(event, displayName, displayNameCode) {
                const profile = await Profiles_2.default.searchDestinyPlayerByBungieName(displayName, displayNameCode);
                if (!profile || await Auth_3.default.getOriginAccess(event.origin))
                    return profile;
                return { ...profile, authed: undefined };
            },
            async bumpProfile(event, displayName, displayNameCode) {
                await Profiles_2.default.searchDestinyPlayerByBungieName(displayName, displayNameCode);
            },
            //#endregion
            ////////////////////////////////////
            async getCollections(event, displayName, displayNameCode) {
                const profile = _
                    ?? (!displayName || !displayNameCode ? undefined : await this.getProfile(event, displayName, displayNameCode))
                    ?? await Profiles_2.default.getCurrentProfile(undefined);
                return await Collections_1.default.for(profile).get();
            },
            async getInventory(event, displayName, displayNameCode) {
                const profile = await this.getProfile(event, displayName, displayNameCode);
                const inventory = profile && await Inventory_1.default.for(profile).get();
                // Broadcast.warning('conduit', 'Item has watermark but no moment', [inventory?.profileItems[0]!])
                return inventory;
            },
            async vaultItem(event, item) {
                return ItemTransfer_1.default.vaultItem(item);
            },
            async moveItemToCharacter(event, characterId, item) {
                return ItemTransfer_1.default.moveItemToCharacter(characterId, item);
            },
            async getComponentNames() {
                return await DefinitionsComponentNames_1.default.get();
            },
            getState: event => getState(event),
            checkUpdate: event => getState(event, true),
            ////////////////////////////////////
            //#region Private
            ////////////////////////////////////
            //#region Settings
            async _getSetting(event, key) {
                if (event.origin !== self.origin)
                    throw new ConduitPrivateFunctionError();
                return await Store_6.default[key].get();
            },
            async _setSetting(event, key, value) {
                if (event.origin !== self.origin)
                    throw new ConduitPrivateFunctionError();
                await Store_6.default[key].set(value);
            },
            async _resetSetting(event, key) {
                if (event.origin !== self.origin)
                    throw new ConduitPrivateFunctionError();
                await Store_6.default[key].delete();
            },
            //#endregion
            ////////////////////////////////////
            setOrigin(event) { },
            async _getAuthState(event) {
                if (event.origin !== self.origin)
                    throw new ConduitPrivateFunctionError();
                return await Auth_3.default.getAuthState();
            },
            async _setCustomApp(event, app) {
                if (event.origin !== self.origin)
                    throw new ConduitPrivateFunctionError();
                if (app)
                    await Store_6.default.customApp.set(app);
                else
                    await Store_6.default.customApp.delete();
                await Store_6.default.auth.delete(); // must re-auth when changing app
            },
            async _authenticate(event, code) {
                if (event.origin !== self.origin)
                    throw new ConduitPrivateFunctionError();
                const authed = !!await Auth_3.default.complete(code);
                if (authed)
                    await updateProfiles();
                return authed;
            },
            async _grantAccess(event, origin, appName) {
                if (event.origin !== self.origin)
                    throw new ConduitPrivateFunctionError();
                const granted = await Auth_3.default.grantAccess(origin, appName);
                if (granted) {
                    await updateProfiles(origin);
                }
            },
            async _denyAccess(event, origin) {
                if (event.origin !== self.origin)
                    throw new ConduitPrivateFunctionError();
                return await Auth_3.default.denyAccess(origin);
            },
            ////////////////////////////////////
            //#region Defs
            async _getDefinition(event, language, component, hash) {
                const defs = await Definitions_6.default[language][component].get();
                return defs[hash];
            },
            async _getDefinitionsComponent(event, language, component, filter) {
                if (filter?.evalExpression && !await Auth_3.default.isOriginTrusted(event.origin))
                    throw new ConduitFunctionRequiresTrustedOriginError();
                // filter.evalExpression = undefined
                const defs = await Definitions_6.default[language][component].get();
                if (!filter || (!filter.nameContainsOrHashIs && !filter.deepContains && !filter.jsonPathExpression && !filter.evalExpression))
                    return defs;
                return Object.fromEntries(FilterHelper_1.default.filter(defs, filter));
            },
            ////////////////////////////////////
            //#region Paginated Defs
            async _getDefinitionsComponentPage(event, language, component, pageSize, page, filter) {
                if (page < 0 || pageSize <= 0)
                    return {
                        definitions: {},
                        page,
                        pageSize,
                        totalPages: 0,
                        totalDefinitions: 0,
                    };
                if (filter?.evalExpression && !await Auth_3.default.isOriginTrusted(event.origin))
                    throw new ConduitFunctionRequiresTrustedOriginError();
                // filter.evalExpression = undefined
                let defs = await Definitions_6.default[language][component].get();
                let filtered = false;
                if (filter && (filter.nameContainsOrHashIs || filter.deepContains || filter.jsonPathExpression || filter.evalExpression)) {
                    filtered = true;
                    defs = Object.fromEntries(FilterHelper_1.default.filter(defs, filter).drop(page * pageSize).take(pageSize + 1));
                }
                const keys = Object.keys(defs);
                const totalPages = (filtered ? page : 0) + Math.ceil(keys.length / pageSize);
                if (totalPages === 1)
                    return {
                        definitions: defs,
                        page: 0,
                        pageSize,
                        totalPages,
                        totalDefinitions: keys.length,
                    };
                if (page >= totalPages)
                    return {
                        definitions: {},
                        page,
                        pageSize,
                        totalPages,
                        totalDefinitions: keys.length,
                    };
                const pageDefs = Object.fromEntries(keys
                    .slice(filtered ? 0 : page * pageSize, filtered ? -1 : (page + 1) * pageSize)
                    .map(key => [key, defs[key]]));
                return {
                    definitions: pageDefs,
                    page,
                    pageSize,
                    totalPages,
                    totalDefinitions: keys.length,
                };
            },
            //#endregion
            ////////////////////////////////////
            ////////////////////////////////////
            //#region Links
            async _getDefinitionLinks(event, language, component, hash) {
                const defs = await Definitions_6.default[language][component].get();
                const def = defs[hash];
                if (!def)
                    return undefined;
                const { components, enums } = await Definitions_6.default.en.DeepsightLinksDefinition.get();
                const linksDef = components[component];
                if (!linksDef)
                    return undefined;
                let augmentations;
                let variants;
                const links = linksDef.links;
                let usedEnums;
                let definitions;
                let defsToGrab;
                for (const link of linksDef.links ?? []) {
                    if ('enum' in link) {
                        usedEnums ??= {};
                        usedEnums[link.enum] ??= enums[link.enum];
                    }
                    else {
                        const hashes = followLinkPath(def, link.path.split('.'));
                        if (!hashes.length)
                            continue;
                        defsToGrab ??= new Map();
                        let set = defsToGrab.get(link.component);
                        if (!set) {
                            set = new Set();
                            defsToGrab.set(link.component, set);
                        }
                        for (const hash of hashes)
                            set.add(hash);
                    }
                }
                await Promise.all([
                    ...(linksDef.augmentations ?? [])
                        .map(async (augmentationComponent) => {
                        const defs = await Definitions_6.default[language][augmentationComponent].get();
                        const def = defs?.[hash];
                        if (!def)
                            return;
                        augmentations ??= {};
                        augmentations[augmentationComponent] = def;
                    }),
                    ...(defsToGrab?.entries().toArray() ?? [])
                        .map(async ([component, hashes]) => {
                        const defs = await Definitions_6.default[language][component].get();
                        for (const hash of hashes) {
                            const def = defs[hash];
                            if (!def)
                                continue;
                            definitions ??= {};
                            definitions[component] ??= {};
                            definitions[component][hash] = def;
                        }
                    }),
                    component !== 'DestinyInventoryItemDefinition' ? undefined : (async () => {
                        const DeepsightVariantDefinition = await Definitions_6.default[language].DeepsightVariantDefinition.get();
                        const groupIndex = DeepsightVariantDefinition.variantGroupLookupTable[hash];
                        if (groupIndex === undefined)
                            return;
                        variants = DeepsightVariantDefinition.groups[groupIndex];
                        await Promise.all(variants.map(async (variantEntry) => {
                            const defs = await Definitions_6.default[language].DestinyInventoryItemDefinition.get();
                            definitions ??= {};
                            definitions.DestinyInventoryItemDefinition ??= {};
                            definitions.DestinyInventoryItemDefinition[variantEntry.hash] = defs[variantEntry.hash];
                        }));
                    })(),
                ]);
                return {
                    augmentations,
                    variants,
                    links,
                    enums: usedEnums,
                    definitions,
                };
            },
            async _getDefinitionWithLinks(event, language, component, hash) {
                const [def, links] = await Promise.all([
                    this._getDefinition(event, language, component, hash),
                    this._getDefinitionLinks(event, language, component, hash),
                ]);
                if (!def)
                    return undefined;
                return { definition: def, links };
            },
            //#endregion
            ////////////////////////////////////
            ////////////////////////////////////
            //#region References
            async _getDefinitionsReferencingPage(event, language, component, hash, pageSize, page) {
                const { components } = await Definitions_6.default.en.DeepsightLinksDefinition.get();
                const componentsReferencing = Object.entries(components).filter(([_, linksDef]) => linksDef.links?.some(link => !('enum' in link) && link.component === component));
                const result = [];
                await Promise.all(componentsReferencing.map(async ([referencingComponent, linksDef]) => {
                    const linksReferencing = linksDef.links.filter((link) => !('enum' in link) && link.component === component);
                    const defs = await Definitions_6.default[language][referencingComponent].get();
                    for (const key of Object.keys(defs)) {
                        const def = defs[key];
                        if (!def)
                            continue;
                        for (const link of linksReferencing) {
                            const hashes = followLinkPath(def, link.path.split('.'));
                            if (hashes.some(defHash => `${defHash}` === `${hash}`)) {
                                result.push([referencingComponent, key, def]);
                                break; // next def
                            }
                        }
                    }
                }));
                return {
                    page,
                    pageSize,
                    totalPages: Math.ceil(result.length / pageSize),
                    totalReferences: result.length,
                    references: (result
                        .slice(page * pageSize, (page + 1) * pageSize)
                        .groupBy(([component]) => component, entries => entries.toObject(([, key, def]) => [key, def]))
                        .entries()
                        .toArray()
                        .toObject()),
                };
            },
            //#endregion
            ////////////////////////////////////
            //#endregion
            ////////////////////////////////////
            //#endregion
            ////////////////////////////////////
        },
    });
    Object.assign(self, { service });
    function followLinkPath(obj, path) {
        if (!path.length && (typeof obj === 'number' || typeof obj === 'string'))
            return [obj];
        if (!obj || typeof obj !== 'object')
            return [];
        const key = path.shift();
        if (!key)
            return [];
        if (key === '[]') {
            if (!Array.isArray(obj))
                return [];
            if (!path.length)
                return obj.filter(item => typeof item === 'number' || typeof item === 'string');
            return obj.flatMap((item) => followLinkPath(item, path.slice()));
        }
        if (key === '{}') {
            if (!path.length)
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                return Object.keys(obj);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            return Object.values(obj).flatMap(value => followLinkPath(value, path.slice()));
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return followLinkPath(obj[key], path);
    }
    async function getState(event, hard) {
        const [version, profiles] = await Promise.all([
            (0, CombinedManifestVersion_2.getVersions)(hard),
            getProfiles(event),
        ]);
        return {
            version,
            authed: profiles.some(profile => profile.authed),
            profiles: profiles.length,
        };
    }
    async function getProfiles(event) {
        void updateProfiles();
        const profiles = (await Database_4.db.profiles.toArray())
            .sort((a, b) => +!!b.authed - +!!a.authed);
        return getProfilesForOrigin(profiles, event.origin);
    }
    async function updateProfiles(forceOriginUpdate) {
        let [{ profiles, updated }, auth] = await Promise.all([
            Profiles_2.default.get(),
            Auth_3.default.getValid(),
        ]);
        profiles.sort((a, b) => new Date(b.lastAccess).getTime() - new Date(a.lastAccess).getTime());
        if (!auth)
            return;
        let profile = profiles.find(profile => profile.name === auth.displayName && profile.code === auth.displayNameCode);
        if (!profile) {
            profile = await Profiles_2.default.getCurrentProfile(auth);
            if (profile) {
                updated = true;
                const existingProfileIndex = profiles.findIndex(p => p.id === profile.id);
                if (existingProfileIndex === -1)
                    // authed a completely new profile
                    profiles.push(profile);
                else
                    // authed an existing profile with a new name/code
                    profiles[existingProfileIndex] = profile;
            }
        }
        if (profile && !profile.authed) {
            profile.authed = true;
            updated = true;
        }
        if (updated)
            void Database_4.db.profiles.bulkPut(profiles);
        if (updated || forceOriginUpdate)
            void service.broadcast.profilesUpdated(async (origin) => {
                if (forceOriginUpdate && forceOriginUpdate !== origin)
                    return Service_1.SKIP_CLIENT;
                return getProfilesForOrigin(profiles, origin);
            });
    }
    async function getProfilesForOrigin(profiles, origin) {
        const grantedAccess = await Auth_3.default.getOriginAccess(origin);
        if (grantedAccess)
            return profiles;
        return profiles.map(profile => ({
            ...profile,
            authed: undefined,
        }));
    }
});
define("Init", ["require", "exports", "utility/Arrays", "utility/Env"], function (require, exports, Arrays_2, Env_4) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = default_1;
    Arrays_2 = __importDefault(Arrays_2);
    Env_4 = __importDefault(Env_4);
    async function default_1() {
        Arrays_2.default.applyPrototypes();
        await Env_4.default['init']();
        Object.assign(self, { _: undefined });
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../Conduit');
    }
});
define("model/ItemLocations", ["require", "exports", "model/DestinyProfiles", "model/ProfiledModel"], function (require, exports, DestinyProfiles_3, ProfiledModel_4) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    DestinyProfiles_3 = __importDefault(DestinyProfiles_3);
    const ItemLocations = (0, ProfiledModel_4.ProfiledModel)('ItemLocations', {
        cacheDirtyTime: 1000 * 10, // 10 second cache time
        async fetch(profile) {
            const destinyProfile = await DestinyProfiles_3.default.for(profile).get();
            return {
                version: `1.${destinyProfile?.responseMintedTimestamp ?? 'n/a'}`,
                value: {
                    base: {
                        characterEquipment: Object.entries(destinyProfile?.characterEquipment?.data ?? {})
                            .toObject(([characterId, inventory]) => [
                            characterId,
                            inventory.items,
                        ]),
                        characterInventories: Object.entries(destinyProfile?.characterInventories?.data ?? {})
                            .toObject(([characterId, inventory]) => [
                            characterId,
                            inventory.items,
                        ]),
                        profile: (destinyProfile?.profileInventory?.data?.items ?? []),
                    },
                    overrides: [],
                },
            };
        },
    });
    exports.default = ItemLocations;
});
/// <reference lib="webworker" />
/**
 * @typedef {Object} Service
 * @property {function(): void} setRegistered
 * @property {function(ExtendableEvent): Promise<unknown>} onInstall
 * @property {function(ExtendableEvent): Promise<unknown>} onActivate
 * @property {function(ExtendableMessageEvent): Promise<unknown>} onCall
 */
const serviceWorkerSelf = /** @type {ServiceWorkerGlobalScope & Service} */ (self);
const registrationPromise = new Promise(resolve => serviceWorkerSelf.setRegistered = resolve);
serviceWorkerSelf.addEventListener('install', event => {
    event.waitUntil((async () => {
        await registrationPromise;
        await serviceWorkerSelf.onInstall?.(event);
    })());
    void serviceWorkerSelf.skipWaiting();
});
serviceWorkerSelf.addEventListener('activate', event => {
    event.waitUntil((async () => {
        await serviceWorkerSelf.onActivate?.(event);
        await serviceWorkerSelf.clients.claim();
    })());
});
serviceWorkerSelf.addEventListener('message', event => {
    event.waitUntil((async () => {
        await serviceWorkerSelf.onCall?.(event);
    })());
});
// eslint-disable-next-line @typescript-eslint/no-unsafe-call, no-undef, @typescript-eslint/no-unsafe-member-access
getModule('Init').default();
