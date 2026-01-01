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
define("Relic", ["require", "exports", "Conduit", "kitsui"], function (require, exports, Conduit_1, kitsui_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Conduit_1 = __importDefault(Conduit_1);
    let resolveConduit;
    const connected = new Promise(resolve => resolveConduit = resolve);
    exports.default = Object.assign((0, kitsui_1.State)(undefined), {
        connected,
        async init() {
            const conduit = await (0, Conduit_1.default)({
                service: location.origin,
            });
            this.asMutable?.setValue(conduit);
            resolveConduit(conduit);
        },
    });
});
define("component/core/ActionRow", ["require", "exports", "kitsui"], function (require, exports, kitsui_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = (0, kitsui_2.Component)(component => component.style('action-row'));
});
define("component/core/Button", ["require", "exports", "kitsui"], function (require, exports, kitsui_3) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const Button = (0, kitsui_3.Component)('button', (component) => {
        const button = component.style('button');
        const buttonText = (0, kitsui_3.Component)().style('button-text').appendTo(button);
        button.extendJIT('text', button => buttonText.text.rehost(button));
        const disabledReasons = (0, kitsui_3.State)(new Set());
        const disabled = disabledReasons.mapManual(reasons => !!reasons.size);
        const unsubscribeStates = new Map();
        const unsubscribeReasons = new Map();
        return button
            .style.bind(disabled, 'button--disabled')
            .style.bind(button.hoveredOrHasFocused, 'button--hover')
            .attributes.bind(disabled, 'disabled')
            .attributes.bind(disabled, 'aria-disabled', 'true')
            .extend(button => ({
            disabled,
            setDisabled(disabled, reason) {
                unsubscribeReasons.get(reason)?.();
                unsubscribeReasons.delete(reason);
                if (disabled)
                    disabledReasons.value.add(reason);
                else
                    disabledReasons.value.delete(reason);
                disabledReasons.emit();
                return button;
            },
            bindDisabled(state, reason) {
                unsubscribeReasons.get(reason)?.();
                unsubscribeReasons.delete(reason);
                const unsubscribe = state.use(button, value => {
                    if (value)
                        disabledReasons.value.add(reason);
                    else
                        disabledReasons.value.delete(reason);
                    disabledReasons.emit();
                });
                const map = unsubscribeStates.get(state) ?? new Map();
                unsubscribeStates.set(state, map);
                map.set(unsubscribe, reason);
                return button;
            },
            unbindDisabled(state) {
                const map = unsubscribeStates.get(state);
                if (map)
                    for (const [unsubscribe, reason] of map) {
                        unsubscribe();
                        unsubscribeReasons.delete(reason);
                    }
                unsubscribeStates.delete(state);
                return button;
            },
        }));
    });
    exports.default = Button;
});
define("component/core/Card", ["require", "exports", "kitsui"], function (require, exports, kitsui_4) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const Card = (0, kitsui_4.Component)((component) => {
        return component.style('card')
            .extend(card => ({
            header: undefined,
            headerText: undefined,
        }))
            .extendJIT('header', card => (0, kitsui_4.Component)()
            .style('card-header')
            .tweak(header => {
            const text = (0, kitsui_4.Component)().style('card-header-text').appendTo(header);
            header.extendJIT('text', header => text.text.rehost(header));
        })
            .prependTo(card))
            .extendJIT('headerText', card => card.header.text.rehost(card));
    });
    exports.default = Card;
});
define("component/core/Footer", ["require", "exports", "kitsui"], function (require, exports, kitsui_5) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = (0, kitsui_5.Component)(component => component.style('footer'));
});
define("component/core/Paragraph", ["require", "exports", "kitsui"], function (require, exports, kitsui_6) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = (0, kitsui_6.Component)(component => {
        return component.style('paragraph');
    });
});
define("component/core/Loading", ["require", "exports", "component/core/Paragraph", "kitsui"], function (require, exports, Paragraph_1, kitsui_7) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Paragraph_1 = __importDefault(Paragraph_1);
    const Loading = (0, kitsui_7.Component)((component) => {
        const storage = (0, kitsui_7.Component)().setOwner(component);
        const spinner = (0, kitsui_7.Component)().style('loading-spinner')
            .append(...[1, 2, 3, 4].map(i => (0, kitsui_7.Component)().style('loading-spinner-dot', `loading-spinner-dot-${i}`)));
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        const interval = setInterval(async () => {
            for (const dot of spinner.getChildren())
                dot.style('loading-spinner-dot--no-animate');
            await new Promise(resolve => setTimeout(resolve, 10));
            for (const dot of spinner.getChildren())
                dot.style.remove('loading-spinner-dot--no-animate');
        }, 2000);
        const progress = (0, kitsui_7.Component)().style('loading-progress');
        const message = (0, Paragraph_1.default)().style('loading-message');
        const errorIcon = (0, kitsui_7.Component)().style('loading-error-icon');
        const error = (0, Paragraph_1.default)().style('loading-error');
        let owner;
        let refresh;
        return component.style('loading')
            .extend(loading => ({
            refresh() {
                refresh?.();
                return this;
            },
            set(state, initialiser) {
                owner?.remove();
                owner = kitsui_7.State.Owner.create();
                if (typeof state === 'function')
                    state = kitsui_7.State.Async(owner, state);
                refresh = state.refresh;
                loading.style.bind(state.settled, 'loading--loaded');
                progress
                    .style.bind(state.progress.map(owner, progress => progress?.progress === null), 'loading-progress--unknown')
                    .style.bindVariable('progress', state.progress.map(owner, progress => progress?.progress ?? 1));
                message.text.bind(state.progress.map(owner, progress => progress?.details));
                error.text.bind(state.error.map(owner, error => error?.message ?? (quilt => quilt['shared/errored']())));
                state.state.use(owner, state => {
                    storage.append(spinner, progress, message, errorIcon, error);
                    loading.removeContents();
                    if (!state.settled) {
                        loading.append(spinner, progress, message);
                        return;
                    }
                    if (state.error) {
                        loading.append(errorIcon, error);
                        return;
                    }
                    initialiser(loading, state.value);
                });
                return loading;
            },
        }))
            .onRemoveManual(() => {
            clearInterval(interval);
            owner?.remove();
            owner = undefined;
            refresh = undefined;
        });
    });
    exports.default = Loading;
});
define("component/core/Lore", ["require", "exports", "component/core/Paragraph", "kitsui"], function (require, exports, Paragraph_2, kitsui_8) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Paragraph_2 = __importDefault(Paragraph_2);
    exports.default = (0, kitsui_8.Component)(component => component.and(Paragraph_2.default).style('lore'));
});
define("utility/Time", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Time;
    (function (Time) {
        function floor(interval) {
            return Math.floor(Date.now() / interval) * interval;
        }
        Time.floor = floor;
        Time.frame = seconds(1) / 144;
        function ms(ms) { return ms; }
        Time.ms = ms;
        function seconds(seconds) { return seconds * 1000; }
        Time.seconds = seconds;
        function minutes(minutes) { return minutes * 1000 * 60; }
        Time.minutes = minutes;
        function hours(hours) { return hours * 1000 * 60 * 60; }
        Time.hours = hours;
        function days(days) { return days * 1000 * 60 * 60 * 24; }
        Time.days = days;
        function weeks(weeks) { return weeks * 1000 * 60 * 60 * 24 * 7; }
        Time.weeks = weeks;
        function months(months) { return Math.floor(months * 1000 * 60 * 60 * 24 * (365.2422 / 12)); }
        Time.months = months;
        function years(years) { return Math.floor(years * 1000 * 60 * 60 * 24 * 365.2422); }
        Time.years = years;
        function decades(decades) { return Math.floor(decades * 1000 * 60 * 60 * 24 * 365.2422 * 10); }
        Time.decades = decades;
        function centuries(centuries) { return Math.floor(centuries * 1000 * 60 * 60 * 24 * 365.2422 * 10 * 10); }
        Time.centuries = centuries;
        function millenia(millenia) { return Math.floor(millenia * 1000 * 60 * 60 * 24 * 365.2422 * 10 * 10 * 10); }
        Time.millenia = millenia;
        function relative(unixTimeMs, options = {}) {
            let ms = unixTimeMs - Date.now();
            const locale = navigator.language || 'en-NZ';
            if (!locale.startsWith('en'))
                return relativeIntl(ms, locale, options);
            if (Math.abs(ms) < seconds(1))
                return 'now';
            const ago = ms < 0;
            if (ago)
                ms = Math.abs(ms);
            let limit = options.components ?? Infinity;
            let value = ms;
            let result = !ago && options.label !== false ? 'in ' : '';
            value = Math.floor(ms / years(1));
            ms -= value * years(1);
            if (value && limit-- > 0)
                result += `${value} year${value === 1 ? '' : 's'}${limit > 0 ? ', ' : ''}`;
            value = Math.floor(ms / months(1));
            ms -= value * months(1);
            if (value && limit-- > 0)
                result += `${value} month${value === 1 ? '' : 's'}${limit > 0 ? ', ' : ''}`;
            value = Math.floor(ms / weeks(1));
            ms -= value * weeks(1);
            if (value && limit-- > 0)
                result += `${value} week${value === 1 ? '' : 's'}${limit > 0 ? ', ' : ''}`;
            value = Math.floor(ms / days(1));
            ms -= value * days(1);
            if (value && limit-- > 0)
                result += `${value} day${value === 1 ? '' : 's'}${limit > 0 ? ', ' : ''}`;
            value = Math.floor(ms / hours(1));
            ms -= value * hours(1);
            if (value && limit-- > 0)
                result += `${value} hour${value === 1 ? '' : 's'}${limit > 0 ? ', ' : ''}`;
            value = Math.floor(ms / minutes(1));
            ms -= value * minutes(1);
            if (value && limit-- > 0)
                result += `${value} minute${value === 1 ? '' : 's'}${limit > 0 ? ', ' : ''}`;
            value = Math.floor(ms / seconds(1));
            if (value && limit-- > 0 && (!options.secondsExclusive || !result.includes(',')))
                result += `${value} second${value === 1 ? '' : 's'}`;
            if (result.endsWith(', '))
                result = result.slice(0, -2);
            return `${result}${ago && options.label !== false ? ' ago' : ''}`;
        }
        Time.relative = relative;
        function relativeIntl(ms, locale, options) {
            const rtf = new Intl.RelativeTimeFormat(locale, options);
            let value = ms;
            value = Math.trunc(ms / years(1));
            if (value)
                return rtf.format(value, 'year');
            value = Math.trunc(ms / months(1));
            if (value)
                return rtf.format(value, 'month');
            value = Math.trunc(ms / weeks(1));
            if (value)
                return rtf.format(value, 'week');
            value = Math.trunc(ms / days(1));
            if (value)
                return rtf.format(value, 'day');
            value = Math.trunc(ms / hours(1));
            if (value)
                return rtf.format(value, 'hour');
            value = Math.trunc(ms / minutes(1));
            if (value)
                return rtf.format(value, 'minute');
            value = Math.trunc(ms / seconds(1));
            return rtf.format(value, 'second');
        }
        function absolute(ms, options = { dateStyle: 'full', timeStyle: 'medium' }) {
            const locale = navigator.language || 'en-NZ';
            const rtf = new Intl.DateTimeFormat(locale, options);
            return rtf.format(ms);
        }
        Time.absolute = absolute;
    })(Time || (Time = {}));
    Object.assign(window, { Time });
    exports.default = Time;
});
define("component/AuthCard", ["require", "exports", "component/core/ActionRow", "component/core/Button", "component/core/Card", "component/core/Footer", "component/core/Loading", "component/core/Lore", "component/core/Paragraph", "kitsui", "Relic", "utility/Time"], function (require, exports, ActionRow_1, Button_1, Card_1, Footer_1, Loading_1, Lore_1, Paragraph_3, kitsui_9, Relic_1, Time_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    ActionRow_1 = __importDefault(ActionRow_1);
    Button_1 = __importDefault(Button_1);
    Card_1 = __importDefault(Card_1);
    Footer_1 = __importDefault(Footer_1);
    Loading_1 = __importDefault(Loading_1);
    Lore_1 = __importDefault(Lore_1);
    Paragraph_3 = __importDefault(Paragraph_3);
    Relic_1 = __importDefault(Relic_1);
    Time_1 = __importDefault(Time_1);
    exports.default = (0, kitsui_9.Component)((component, target) => {
        const card = component.and(Card_1.default);
        card.header.text.set(quilt => quilt['auth-card/title']());
        (0, Loading_1.default)().appendTo(card).set(async (signal, setProgress) => {
            setProgress(null, quilt => quilt['auth-card/loading']());
            const conduit = await Relic_1.default.connected;
            // await sleep(100000)
            const bungieCode = localStorage.getItem('bungieCode');
            if (bungieCode) {
                localStorage.removeItem('bungieCode');
                await conduit._authenticate(bungieCode);
            }
            const authState = await conduit._getAuthState();
            const grant = authState.accessGrants.find((grant) => grant.origin === target.origin);
            target.appName = grant?.appName ?? target.appName;
            if (authState.authenticated && grant && window.opener)
                window.close();
            return {
                conduit,
                authed: authState.authenticated,
                target,
                grant,
                bungieAuthURL: authState.bungieAuthURL,
            };
        }, (slot, state) => {
            const { conduit, bungieAuthURL } = state;
            const appName = state.target.appName ?? state.target.origin;
            if (state.authed && state.grant) {
                (0, Lore_1.default)()
                    .text.set(quilt => quilt['auth-card/description/granted'](appName))
                    .appendTo(slot);
                (0, Paragraph_3.default)()
                    .text.set(quilt => quilt['shared/granted-since'](Time_1.default.relative(state.grant.authTimestamp)))
                    .appendTo(slot);
                const actions = (0, ActionRow_1.default)().appendTo(slot);
                (0, Button_1.default)()
                    .text.set(quilt => quilt['auth-card/action/revoke-access']())
                    .event.subscribe('click', async () => {
                    await conduit._denyAccess(state.target.origin);
                    location.href = location.origin;
                })
                    .appendTo(actions);
                return;
            }
            (0, Lore_1.default)()
                .text.set(quilt => quilt['auth-card/description/request'](appName))
                .appendTo(slot);
            if (!state.authed) {
                localStorage.setItem('bungieAuthState', location.href);
                (0, Footer_1.default)()
                    .append((0, kitsui_9.Component)('a')
                    .and(Button_1.default)
                    .attributes.set('href', `${bungieAuthURL}&state=${btoa(location.href).replaceAll('/', '.').replaceAll('=', '_').replaceAll('+', '-')}`)
                    .attributes.set('target', window.opener ? '_self' : '_blank')
                    .text.set(quilt => quilt['auth-card/action/auth-bungie']())
                    .event.subscribe('click', event => {
                    if (window.opener)
                        return;
                    const width = 600;
                    const height = 800;
                    const left = (window.innerWidth - width) / 2 + window.screenLeft;
                    const top = (window.innerHeight - height) / 2 + window.screenTop;
                    const popup = window.open(`${bungieAuthURL}&state=popup`, '_blank', `width=${width},height=${height},left=${left},top=${top}`);
                    if (!popup)
                        throw new Error('Failed to open auth popup');
                    event.preventDefault();
                    const interval = setInterval(() => {
                        if (popup?.closed) {
                            slot.refresh();
                            clearInterval(interval);
                        }
                    }, 100);
                }))
                    .appendTo(slot);
                return;
            }
            const grantActions = (0, ActionRow_1.default)().appendTo(slot);
            (0, Button_1.default)()
                .text.set(quilt => quilt['auth-card/action/cancel']())
                .event.subscribe('click', async () => {
                await conduit._denyAccess(target.origin);
                if (window.opener)
                    window.close();
                else
                    location.href = location.origin;
            })
                .appendTo(grantActions);
            (0, Button_1.default)()
                .text.set(quilt => quilt['auth-card/action/grant']())
                .event.subscribe('click', async () => {
                await conduit._grantAccess(target.origin, target.appName);
                if (window.opener)
                    window.close();
                else
                    slot.refresh();
            })
                .appendTo(grantActions);
        });
        return card;
    });
});
define("component/core/Checkbox", ["require", "exports", "kitsui"], function (require, exports, kitsui_10) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const Checkbox = (0, kitsui_10.Component)('label', (component) => {
        const label = (0, kitsui_10.Component)().style('checkbox-label');
        const checked = (0, kitsui_10.State)(false);
        const input = (0, kitsui_10.Component)('input')
            .style('checkbox-input')
            .attributes.set('type', 'checkbox')
            .event.subscribe('change', event => checked.value = event.host.element.checked);
        return component.style('checkbox')
            .append(input)
            .append((0, kitsui_10.Component)()
            .style('checkbox-icon')
            .style.bind(checked, 'checkbox-icon--checked')
            .append((0, kitsui_10.Component)()
            .style('checkbox-icon-active-border')
            .style.bind(component.hoveredOrHasFocused, 'checkbox-icon-active-border--focus')
            .style.bind(component.active, 'checkbox-icon-active-border--active')
            .style.bind(checked, 'checkbox-icon-active-border--checked'))
            .append((0, kitsui_10.Component)()
            .style('checkbox-icon-check')
            .style.bind(checked, 'checkbox-icon-check--checked')
            .style.bind(component.active, 'checkbox-icon-check--active')))
            .append(label)
            .extend(checkbox => ({
            checked,
            label,
            setChecked(value) {
                checked.value = value;
                input.element.checked = value;
                return checkbox;
            },
        }));
    });
    exports.default = Checkbox;
});
define("component/core/Details", ["require", "exports", "kitsui"], function (require, exports, kitsui_11) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = (0, kitsui_11.Component)('details', (component) => {
        const summary = (0, kitsui_11.Component)('summary').style('details-summary');
        const content = (0, kitsui_11.Component)().style('details-content');
        return component.replaceElement('details')
            .style('details')
            .append(summary, content)
            .extend(details => ({
            summary,
            summaryText: undefined,
            content,
        }))
            .extendJIT('summaryText', details => details.summary.text.rehost(details));
    });
});
define("component/core/FormRow", ["require", "exports", "kitsui"], function (require, exports, kitsui_12) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const FormRow = (0, kitsui_12.Component)('label', (component) => {
        const label = (0, kitsui_12.Component)().style('form-row-label');
        return component.replaceElement('label')
            .style('form-row')
            .append(label)
            .extend(row => ({
            label,
            labelText: undefined,
        }))
            .extendJIT('labelText', row => row.label.text.rehost(row));
    });
    exports.default = FormRow;
});
define("component/core/TextInput", ["require", "exports", "kitsui", "kitsui/utility/Applicator"], function (require, exports, kitsui_13, Applicator_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Applicator_1 = __importDefault(Applicator_1);
    const TextInput = (0, kitsui_13.Component)('input', (component) => {
        let defaultValue = '';
        const state = (0, kitsui_13.State)(defaultValue);
        const input = component.replaceElement('input')
            .attributes.set('type', 'text')
            .style('text-input');
        input.event.subscribe('input', () => state.value = input.element.value);
        return input.extend(input => ({
            state,
            setValue(value) {
                state.value = input.element.value = value ?? '';
                return input;
            },
            default: (0, Applicator_1.default)(input, (newDefaultValue = '') => {
                if (newDefaultValue === defaultValue)
                    return;
                if (input.element.value === defaultValue)
                    state.value = input.element.value = newDefaultValue;
                defaultValue = newDefaultValue;
            }),
            reset() {
                state.value = input.element.value = defaultValue;
                return input;
            },
        }));
    });
    exports.default = TextInput;
});
define("component/MainCards", ["require", "exports", "component/core/ActionRow", "component/core/Button", "component/core/Card", "component/core/Checkbox", "component/core/Details", "component/core/FormRow", "component/core/Loading", "component/core/Lore", "component/core/Paragraph", "component/core/TextInput", "kitsui", "Relic", "utility/Time"], function (require, exports, ActionRow_2, Button_2, Card_2, Checkbox_1, Details_1, FormRow_1, Loading_2, Lore_2, Paragraph_4, TextInput_1, kitsui_14, Relic_2, Time_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    ActionRow_2 = __importDefault(ActionRow_2);
    Button_2 = __importDefault(Button_2);
    Card_2 = __importDefault(Card_2);
    Checkbox_1 = __importDefault(Checkbox_1);
    Details_1 = __importDefault(Details_1);
    FormRow_1 = __importDefault(FormRow_1);
    Loading_2 = __importDefault(Loading_2);
    Lore_2 = __importDefault(Lore_2);
    Paragraph_4 = __importDefault(Paragraph_4);
    TextInput_1 = __importDefault(TextInput_1);
    Relic_2 = __importDefault(Relic_2);
    Time_2 = __importDefault(Time_2);
    exports.default = (0, kitsui_14.Component)(component => {
        component.style('main-cards');
        (0, Card_2.default)()
            .headerText.set(quilt => quilt['main/about-card/title']())
            .append((0, Lore_2.default)().text.set(quilt => quilt['main/about-card/description']()))
            .appendTo(component);
        ////////////////////////////////////
        //#region Grants
        (0, Card_2.default)().appendTo(component).tweak(card => {
            card.headerText.set(quilt => quilt['main/grants-card/title']());
            (0, Loading_2.default)().appendTo(card).set(async (signal, setProgress) => {
                setProgress(null, quilt => quilt['main/grants-card/loading']());
                const conduit = await Relic_2.default.connected;
                // await sleep(100000)
                const bungieCode = localStorage.getItem('bungieCode');
                if (bungieCode) {
                    localStorage.removeItem('bungieCode');
                    await conduit._authenticate(bungieCode);
                }
                const authState = await conduit._getAuthState();
                return {
                    conduit,
                    grants: authState.accessGrants,
                };
            }, (slot, { conduit, grants }) => {
                if (!grants.length) {
                    (0, Lore_2.default)()
                        .text.set(quilt => quilt['main/grants-card/description/none']())
                        .appendTo(card);
                    return;
                }
                (0, Lore_2.default)()
                    .text.set(quilt => quilt['main/grants-card/description/grants']())
                    .appendTo(card);
                for (const grant of grants)
                    (0, kitsui_14.Component)('a')
                        .attributes.set('href', `${location.origin}${location.pathname}?auth=${encodeURIComponent(grant.origin)}`)
                        .style('grant')
                        .append((0, kitsui_14.Component)().style('grant-name').text.set(quilt => quilt['main/grants-card/grant-name'](grant.origin, grant.appName)))
                        .append((0, Lore_2.default)().style('grant-time').text.set(quilt => quilt['shared/granted-since'](Time_2.default.relative(grant.authTimestamp))))
                        .appendTo(card);
            });
        });
        //#endregion
        ////////////////////////////////////
        ////////////////////////////////////
        //#region Advanced
        (0, Card_2.default)().appendTo(component).tweak(card => {
            card.header.text.set(quilt => quilt['main/advanced-card/title']());
            (0, Lore_2.default)()
                .text.set(quilt => quilt['main/advanced-card/description']())
                .appendTo(card);
            (0, Details_1.default)()
                .summaryText.set(quilt => quilt['main/advanced-card/custom-app/title']())
                .append((0, Loading_2.default)().appendTo(card).set(async (signal, setProgress) => {
                setProgress(null, quilt => quilt['main/advanced-card/custom-app/loading']());
                const conduit = await Relic_2.default.connected;
                const authState = await conduit._getAuthState();
                return {
                    conduit,
                    customApp: authState.customApp,
                };
            }, (slot, { conduit, customApp }) => {
                (0, Paragraph_4.default)()
                    .text.set(quilt => quilt['main/advanced-card/custom-app/description']())
                    .appendTo(slot);
                const apiKeyInput = (0, TextInput_1.default)().setValue(customApp?.apiKey);
                (0, FormRow_1.default)()
                    .labelText.set(quilt => quilt['main/advanced-card/custom-app/api-key/label']())
                    .append(apiKeyInput)
                    .appendTo(slot);
                const clientIdInput = (0, TextInput_1.default)().setValue(customApp?.clientId);
                (0, FormRow_1.default)()
                    .labelText.set(quilt => quilt['main/advanced-card/custom-app/client-id/label']())
                    .append(clientIdInput)
                    .appendTo(slot);
                const clientSecretInput = (0, TextInput_1.default)().setValue(customApp?.clientSecret);
                (0, FormRow_1.default)()
                    .labelText.set(quilt => quilt['main/advanced-card/custom-app/client-secret/label']())
                    .append(clientSecretInput)
                    .appendTo(slot);
                const actions = (0, ActionRow_2.default)().appendTo(slot);
                (0, Button_2.default)()
                    .setDisabled(!customApp, 'no custom app set')
                    .text.set(quilt => quilt['main/advanced-card/shared-form/action/clear']())
                    .event.subscribe('click', async () => {
                    await conduit._setCustomApp();
                    location.reload();
                })
                    .appendTo(actions);
                (0, Button_2.default)()
                    .tweak(button => button.bindDisabled(kitsui_14.State.Every(button, apiKeyInput.state, clientIdInput.state, clientSecretInput.state).falsy, 'missing input'))
                    .text.set(quilt => quilt['main/advanced-card/shared-form/action/save']())
                    .event.subscribe('click', async () => {
                    await conduit._setCustomApp({
                        apiKey: apiKeyInput.state.value,
                        clientId: clientIdInput.state.value,
                        clientSecret: clientSecretInput.state.value,
                    });
                    location.reload();
                })
                    .appendTo(actions);
            }))
                .appendTo(card);
            (0, Details_1.default)()
                .summaryText.set(quilt => quilt['main/advanced-card/settings/title']())
                .append((0, Loading_2.default)().appendTo(card).set(async (signal, setProgress) => {
                setProgress(null, quilt => quilt['main/advanced-card/settings/loading']());
                const conduit = await Relic_2.default.connected;
                const verboseLogging = await conduit._getSetting('verboseLogging');
                return {
                    conduit,
                    verboseLogging,
                };
            }, (slot, { conduit, verboseLogging }) => {
                const verboseLoggingCheckbox = (0, Checkbox_1.default)()
                    .tweak(checkbox => checkbox.label.text.set(quilt => quilt['main/advanced-card/settings/verbose-logging/label']()))
                    .setChecked(!!verboseLogging)
                    .appendTo(slot);
                const actions = (0, ActionRow_2.default)().appendTo(slot);
                (0, Button_2.default)()
                    .text.set(quilt => quilt['main/advanced-card/shared-form/action/save']())
                    .event.subscribe('click', async () => {
                    await Promise.all([
                        conduit._setSetting('verboseLogging', verboseLoggingCheckbox.checked.value ? true : undefined),
                    ]);
                })
                    .appendTo(actions);
            }))
                .appendTo(card);
        });
        //#endregion
        ////////////////////////////////////
        return component;
    });
});
define("component/WordmarkLogo", ["require", "exports", "kitsui"], function (require, exports, kitsui_15) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = (0, kitsui_15.Component)(component => {
        return component.style('wordmark-logo')
            .append((0, kitsui_15.Component)('img')
            .style('wordmark-logo-icon')
            .attributes.set('src', './static/logo.png'))
            .append((0, kitsui_15.Component)('img')
            .style('wordmark-logo-wordmark')
            .attributes.set('src', './static/wordmark.png'))
            .append((0, kitsui_15.Component)()
            .style('wordmark-logo-text')
            .text.set('Conduit'));
    });
});
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
define("utility/Script", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Script;
    (function (Script) {
        function allowModuleRedefinition(...paths) {
            for (const path of paths)
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                window.allowRedefine(path);
        }
        Script.allowModuleRedefinition = allowModuleRedefinition;
        async function reload(path) {
            document.querySelector(`script[src^="${path}"]`)?.remove();
            const script = document.createElement('script');
            script.src = `${path}?${Date.now()}`;
            return new Promise((resolve, reject) => {
                script.onload = () => resolve();
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        Script.reload = reload;
    })(Script || (Script = {}));
    exports.default = Script;
});
define("utility/Style", ["require", "exports", "kitsui/utility/StyleManipulator", "style", "utility/Script"], function (require, exports, StyleManipulator_1, style_1, Script_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    style_1 = __importDefault(style_1);
    Script_1 = __importDefault(Script_1);
    StyleManipulator_1.style.value = style_1.default;
    var Style;
    (function (Style) {
        async function reload() {
            reloadStylesheet('./style/index.css');
            Script_1.default.allowModuleRedefinition('style');
            await Script_1.default.reload(`./style/index.js`);
            StyleManipulator_1.style.value = await new Promise((resolve_1, reject_1) => { require(['style'], resolve_1, reject_1); }).then(__importStar).then(module => module.default);
        }
        Style.reload = reload;
        async function reloadStylesheet(path) {
            const oldStyle = document.querySelector(`link[rel=stylesheet][href^="${path}"]`);
            const style = document.createElement('link');
            style.rel = 'stylesheet';
            style.href = `${path}?${Date.now()}`;
            return new Promise((resolve, reject) => {
                style.onload = () => resolve();
                style.onerror = reject;
                document.head.appendChild(style);
            }).finally(() => oldStyle?.remove());
        }
    })(Style || (Style = {}));
    exports.default = Style;
});
define("utility/DevServer", ["require", "exports", "utility/Env", "utility/Style"], function (require, exports, Env_1, Style_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Env_1 = __importDefault(Env_1);
    Style_1 = __importDefault(Style_1);
    var DevServer;
    (function (DevServer) {
        function listen() {
            if (Env_1.default.ENVIRONMENT !== 'dev')
                return;
            const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${wsProtocol}//${location.host}`;
            const socket = new WebSocket(wsUrl);
            socket.addEventListener('message', event => {
                try {
                    if (typeof event.data !== 'string')
                        throw new Error('Unsupported message data');
                    const message = JSON.parse(event.data);
                    const { type } = typeof message === 'object' && message !== null ? message : {};
                    switch (type) {
                        case 'notify:css':
                            void Style_1.default.reload();
                            break;
                    }
                }
                catch {
                    console.warn('Unsupported devserver message:', event.data);
                }
            });
        }
        DevServer.listen = listen;
    })(DevServer || (DevServer = {}));
    exports.default = DevServer;
});
define("utility/Text", ["require", "exports", "kitsui", "kitsui/utility/StringApplicator", "lang"], function (require, exports, kitsui_16, StringApplicator_1, lang_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    lang_1 = __importStar(lang_1);
    var Text;
    (function (Text) {
        function init() {
            StringApplicator_1.StringApplicatorSource.register('weave', {
                match(source) {
                    return typeof source === 'function';
                },
                toNodes(source) {
                    return renderWeave(source(lang_1.default));
                },
                toString(source) {
                    return source(lang_1.default).toString();
                },
            });
        }
        Text.init = init;
        function isWeave(weave) {
            return Object.keys(weave).includes('toString');
        }
        Text.isWeave = isWeave;
        function renderWeave(weave) {
            return weave.content.map(renderWeft);
        }
        Text.renderWeave = renderWeave;
        function renderWeft(weft) {
            if (isPlaintextWeft(weft))
                return document.createTextNode(weft.content);
            const tag = weft.tag?.toLowerCase();
            let element = !tag ? undefined : createTagElement(tag);
            element ??= document.createElement('span');
            if (Array.isArray(weft.content))
                element.append(...weft.content.map(renderWeft));
            else if (typeof weft.content === 'object' && weft.content) {
                if (!lang_1.WeavingArg.isRenderable(weft.content)) {
                    if (isWeave(weft.content))
                        element.append(...renderWeave(weft.content));
                    else
                        element.append(renderWeft(weft.content));
                }
                else if (kitsui_16.Component.is(weft.content))
                    element.append(weft.content.element);
                else if (weft.content instanceof Node)
                    element.append(weft.content);
                else
                    console.warn('Unrenderable weave content:', weft.content);
            }
            else {
                const value = `${weft.content ?? ''}`;
                const texts = value.split('\n');
                for (let i = 0; i < texts.length; i++) {
                    if (i > 0)
                        element.append((0, kitsui_16.Component)('br').element, (0, kitsui_16.Component)().style('break').element);
                    element.append(document.createTextNode(texts[i]));
                }
            }
            return element;
        }
        function isPlaintextWeft(weft) {
            return true
                && typeof weft.content === 'string'
                && !weft.content.includes('\n')
                && !weft.tag;
        }
        function createTagElement(tag) {
            tag = tag.toLowerCase();
            if (tag.startsWith('link(')) {
                let href = tag.slice(5, -1);
                // const link = href.startsWith('/')
                // 	? Link(href as RoutePath)
                // 	: ExternalLink(href)
                if (!href.startsWith('/') && !href.startsWith('.'))
                    href = `https://${href}`;
                return (0, kitsui_16.Component)('a')
                    .attributes.set('href', href)
                    .element;
            }
            // if (tag.startsWith('.')) {
            // 	const className = tag.slice(1)
            // 	if (className in style.value)
            // 		return Component()
            // 			.style(className as keyof typeof style.value)
            // 			.element
            // }
            // if (tag.startsWith('icon.')) {
            // 	const className = `button-icon-${tag.slice(5)}`
            // 	if (className in style.value)
            // 		return Component()
            // 			.style('button-icon', className as keyof typeof style.value, 'button-icon--inline')
            // 			.element
            // }
            switch (tag) {
                case 'b': return document.createElement('strong');
                case 'i': return document.createElement('em');
                case 'u': return document.createElement('u');
                case 's': return document.createElement('s');
                case 'code': return (0, kitsui_16.Component)('code').style('code').element;
                // case 'sm': return Component('small')
                // 	.style('small')
                // 	.element
            }
        }
        Text.createTagElement = createTagElement;
    })(Text || (Text = {}));
    exports.default = Text;
});
define("index", ["require", "exports", "component/AuthCard", "component/MainCards", "component/WordmarkLogo", "kitsui", "kitsui/utility/ActiveListener", "kitsui/utility/FocusListener", "kitsui/utility/HoverListener", "kitsui/utility/Mouse", "kitsui/utility/Viewport", "Relic", "utility/DevServer", "utility/Env", "utility/Text"], function (require, exports, AuthCard_1, MainCards_1, WordmarkLogo_1, kitsui_17, ActiveListener_1, FocusListener_1, HoverListener_1, Mouse_1, Viewport_1, Relic_3, DevServer_1, Env_2, Text_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = default_1;
    AuthCard_1 = __importDefault(AuthCard_1);
    MainCards_1 = __importDefault(MainCards_1);
    WordmarkLogo_1 = __importDefault(WordmarkLogo_1);
    ActiveListener_1 = __importDefault(ActiveListener_1);
    FocusListener_1 = __importDefault(FocusListener_1);
    HoverListener_1 = __importDefault(HoverListener_1);
    Mouse_1 = __importDefault(Mouse_1);
    Viewport_1 = __importDefault(Viewport_1);
    Relic_3 = __importDefault(Relic_3);
    DevServer_1 = __importDefault(DevServer_1);
    Env_2 = __importDefault(Env_2);
    Text_1 = __importDefault(Text_1);
    async function default_1() {
        void Relic_3.default.init();
        kitsui_17.Component.allowBuilding();
        Text_1.default.init();
        kitsui_17.Component.getBody().style('body');
        (0, kitsui_17.Component)('a')
            .and(WordmarkLogo_1.default)
            .attributes.set('href', location.origin)
            .appendTo(document.body);
        await Env_2.default['init']();
        DevServer_1.default.listen();
        HoverListener_1.default.listen();
        ActiveListener_1.default.listen();
        FocusListener_1.default.listen();
        Mouse_1.default.listen();
        Viewport_1.default.listen();
        const params = new URLSearchParams(location.search);
        const authOrigin = params.get('auth');
        const appName = !authOrigin ? undefined : params.get('app') ?? authOrigin;
        if (authOrigin)
            (0, AuthCard_1.default)({ origin: authOrigin, appName }).appendTo(document.body);
        else
            (0, MainCards_1.default)().appendTo(document.body);
    }
});
define("component/core/Checklist", ["require", "exports", "kitsui"], function (require, exports, kitsui_18) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const Checklist = (0, kitsui_18.Component)('ol', (component) => {
        return component.style('checklist')
            .extend(checklist => ({
            add(initialiser) {
                ChecklistItem()
                    .tweak(initialiser)
                    .appendTo(checklist)
                    .tweak(item => item.marker.text.set(`${checklist.element.children.length}.`));
                return checklist;
            },
        }));
    });
    const ChecklistItem = (0, kitsui_18.Component)('li', (component) => {
        const checked = (0, kitsui_18.State)(false);
        const marker = (0, kitsui_18.Component)().style('checklist-item-marker');
        const content = (0, kitsui_18.Component)().style('checklist-item-content');
        const checkIcon = (0, kitsui_18.Component)()
            .style('checklist-item-check-icon')
            .style.bind(checked, 'checklist-item-check-icon--checked');
        return component.style('checklist-item')
            .append(marker, content, checkIcon)
            .extend(item => ({
            marker,
            content,
            checkIcon,
            checked,
        }));
    });
    exports.default = Checklist;
});
define("utility/Async", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.sleep = sleep;
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
});
