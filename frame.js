"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const VERBOSE_LOGGING = { value: false };
const ifVerbose = (value) => VERBOSE_LOGGING.value ? [value] : [];
const printIfVerbose = () => VERBOSE_LOGGING.value ? ' %o' : '';
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
const log = (...args) => console[VERBOSE_LOGGING.value ? 'info' : 'debug'](...args);
const REQUEST_TIMEOUT = 1000 * 60 * 2;
const SERVICE_READY_RESEND_DELAY = 1000 * 5;
const maxVal = parseInt('z'.repeat(11), 36);
const colourFromId = (id) => `color: oklch(70% 80% ${((parseInt(id || '0', 36) / maxVal) * 360) % 360}deg);`;
const parentWindow = window.parent;
if (!parentWindow)
    throw new Error('This page must be loaded in an iframe');
let origin;
function serialiseError(err) {
    if (err instanceof Error)
        return {
            __conduitError: true,
            name: err.name,
            message: err.message,
            stack: err.stack,
            cause: serialiseCause(err.cause),
        };
    return {
        __conduitError: true,
        message: 'Promise rejected',
        cause: serialiseCause(err),
    };
}
function serialiseCause(cause) {
    if (cause === undefined || cause === null)
        return cause;
    switch (typeof cause) {
        case 'string':
        case 'number':
        case 'boolean':
            return cause;
        case 'bigint':
        case 'symbol':
            return String(cause);
        case 'function':
            return cause.name ? `[Function ${cause.name}]` : '[Function]';
        case 'object':
            if (cause instanceof Error)
                return {
                    __conduitError: true,
                    name: cause.name,
                    message: cause.message,
                    stack: cause.stack,
                    cause: serialiseCause(cause.cause),
                };
            try {
                structuredClone(cause);
                return cause;
            }
            catch {
                return Object.prototype.toString.call(cause);
            }
    }
}
function toError(data) {
    if (data instanceof Error)
        return data;
    if (data && typeof data === 'object' && '__conduitError' in data) {
        const serialized = data;
        const err = new Error(serialized.message, { cause: serialized.cause });
        err.name = serialized.name ?? err.name;
        err.stack = serialized.stack;
        return err;
    }
    return new Error('Promise message rejected', { cause: data });
}
function timeoutError(label, timeout) {
    return new Error(`${label} timed out after ${timeout}ms`);
}
void (async () => {
    const unresolvedCalls = new Map();
    const completedCalls = [];
    const frameInstanceId = Math.random().toString(36).slice(2, 7);
    let serviceReadyResendTimeout;
    const registration = await navigator.serviceWorker.register('./index.js', {
        scope: '/__conduit_worker__/',
    });
    let service;
    let pendingServiceUpdate;
    let serviceUpdateResendPending = false;
    registration.addEventListener('updatefound', () => {
        serviceUpdateResendPending = true;
        pendingServiceUpdate = trackServiceWorker(registration.installing, 'updatefound');
    });
    service = await waitForActivation(registration.active ?? registration.waiting ?? registration.installing);
    const startupServiceUpdate = registration.waiting ?? registration.installing;
    if (startupServiceUpdate) {
        serviceUpdateResendPending = true;
        void trackServiceWorker(startupServiceUpdate, 'startup');
    }
    const MAIN_FORMAT = 'color: #58946c;';
    const PUNCT_FORMAT = 'color: #888;';
    const SERVICE_FORMAT = 'color: #58946c;';
    const FRAME_FORMAT = 'color: #8651db;';
    const HOST_FORMAT = 'color: #537cc9;';
    const MESSAGE_FORMAT = 'color: #4ef0bc;';
    // const WARN_FORMAT = 'color: #ee942e;'
    const ERROR_FORMAT = 'color: #d9534f;';
    navigator.serviceWorker.addEventListener('message', event => {
        const sourceService = event.source instanceof ServiceWorker ? event.source : undefined;
        const { id, type, data, frame } = event.data;
        ////////////////////////////////////
        // #region Internal SW > Frame
        let used = false;
        for (let i = 0; i < messageListeners.length; i++) {
            const listener = messageListeners[i];
            if (listener.type === type && listener.id === id) {
                log(`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/ %cFrame %c\u2B9C Service %c/ %c${type}${printIfVerbose()}`, PUNCT_FORMAT, MAIN_FORMAT, PUNCT_FORMAT, FRAME_FORMAT, SERVICE_FORMAT, PUNCT_FORMAT, MESSAGE_FORMAT, ...ifVerbose(data));
                listener.callback(data);
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
        // check if this is an internal message that should not be forwarded to parent
        if (used || frame)
            return;
        // #endregion
        ////////////////////////////////////
        if (id !== 'global' && !unresolvedCalls.has(id)) {
            if (completedCalls.includes(id))
                // duplicate response, probably service worker updated. ignore it
                return;
            log(`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/ %c${id.padEnd(11, ' ')} %cNo Target %c\u2B9C Service %c/ %c${type}${printIfVerbose()}`, ERROR_FORMAT, MAIN_FORMAT, PUNCT_FORMAT, colourFromId(id), ERROR_FORMAT, SERVICE_FORMAT, PUNCT_FORMAT, MESSAGE_FORMAT, ...ifVerbose(data));
            return;
        }
        if (id === 'global' && type === 'ready') {
            if (sourceService)
                adoptService(sourceService);
            scheduleServiceReadyRecovery();
            return;
        }
        if (id === 'global' && type === '_getOrigin') {
            if (origin)
                (sourceService ?? service)?.postMessage({ id: 'global', type: 'resolve:_getOrigin', data: [origin] });
            return;
        }
        if (id === 'global' && type === '_updateSettings') {
            void updateSettings();
            return;
        }
        completeCall(id);
        // forward messages from the service worker to the parent window
        if (id !== 'global' || (type !== 'startOperation' && type !== 'endOperation' && type !== 'warning'))
            log(`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/ %c${id.padEnd(11, ' ')} %cHost %c\u2B9C Service %c/ %c${type}${printIfVerbose()}`, PUNCT_FORMAT, MAIN_FORMAT, PUNCT_FORMAT, colourFromId(id), HOST_FORMAT, SERVICE_FORMAT, PUNCT_FORMAT, MESSAGE_FORMAT, ...ifVerbose(data));
        completedCalls.push(id);
        if (completedCalls.length > 100)
            completedCalls.shift();
        parentWindow.postMessage(event.data, '*');
    });
    window.addEventListener('message', event => {
        if (event.source !== parentWindow)
            return;
        origin = event.origin;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (typeof event.data !== 'object' || typeof event.data.type !== 'string') {
            log(`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/ %cHost %c\u2B9E Service %c/ %cUnsupported message${printIfVerbose()}`, PUNCT_FORMAT, MAIN_FORMAT, PUNCT_FORMAT, HOST_FORMAT, SERVICE_FORMAT, PUNCT_FORMAT, ERROR_FORMAT, ...ifVerbose(event.data));
            return;
        }
        const message = { ...event.data };
        delete message.frame;
        // special messages that the iframe will handle
        const frameFunctionType = message.type.slice(1);
        const frameFunction = message.type.startsWith('_') ? functions[frameFunctionType] : undefined;
        if (frameFunction) {
            log(`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/ %cHost \u2B9E %cFrame %c/ %c${message.type.slice(1)}${printIfVerbose()}`, PUNCT_FORMAT, MAIN_FORMAT, PUNCT_FORMAT, HOST_FORMAT, FRAME_FORMAT, PUNCT_FORMAT, MESSAGE_FORMAT, ...ifVerbose(message.data));
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            void Promise.resolve(frameFunction(event, ...Array.isArray(message.data) ? message.data : [])).then(result => {
                reply({ type: `resolve:${message.type}`, id: message.id, data: result });
            }, err => {
                reply({ type: `reject:${message.type}`, id: message.id, data: serialiseError(err) });
            });
            function reply(message) {
                log(`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/ %cHost %c\u2B9C Frame %c/ %c${message.type.replace(':_', ':')}${printIfVerbose()}`, PUNCT_FORMAT, MAIN_FORMAT, PUNCT_FORMAT, HOST_FORMAT, FRAME_FORMAT, PUNCT_FORMAT, MESSAGE_FORMAT, ...ifVerbose(message.data));
                const source = event.source;
                source?.postMessage(message, '*');
            }
            return;
        }
        message.origin = event.origin;
        // forward messages from the parent window to the service worker
        log(`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/ %c${message.id.padEnd(11, ' ')} %cHost \u2B9E %cService %c/ %c${message.type}`, PUNCT_FORMAT, MAIN_FORMAT, PUNCT_FORMAT, colourFromId(message.id), HOST_FORMAT, SERVICE_FORMAT, PUNCT_FORMAT, MESSAGE_FORMAT, 
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return
        ...(Array.isArray(message.data) ? message.data : [message.data]).map(arg => typeof arg === 'object' && !VERBOSE_LOGGING.value ? '[Object]' : arg));
        trackCall(message);
    });
    const functions = {
        async update() {
            await updateServiceWorker('manual update');
        },
        async needsAuth(event) {
            const authState = await conduit._getAuthState();
            return !(authState.authenticated && authState.accessGrants.some(grant => grant.origin === event.origin));
        },
    };
    const conduit = new Proxy({}, {
        get(target, fname) {
            if (fname === 'then')
                return undefined;
            return (...params) => callPromiseFunction(fname, ...params);
        },
    });
    const messageListeners = [];
    function addListener(id, type, callback, once = false) {
        const expiry = !once ? undefined : Date.now() + 1000 * 60 * 2; // 2 minute expiry for once listeners
        const listener = {
            id,
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
    function removeListeners(id) {
        for (let i = 0; i < messageListeners.length; i++) {
            if (messageListeners[i].id !== id)
                continue;
            messageListeners.splice(i, 1);
            i--;
        }
    }
    function addPromiseListener(type) {
        const id = Math.random().toString(36).slice(2);
        let timeout;
        let settled = false;
        function settle(callback, value) {
            if (settled)
                return;
            settled = true;
            if (timeout)
                clearTimeout(timeout);
            callback(value);
        }
        return {
            id,
            promise: new Promise((resolve, reject) => {
                timeout = setTimeout(() => {
                    settled = true;
                    removeListeners(id);
                    completeCall(id);
                    reject(timeoutError(`Conduit frame request '${type}' (${id})`, REQUEST_TIMEOUT));
                }, REQUEST_TIMEOUT);
                addListener(id, `resolve:${type}`, data => {
                    settle(resolve, data);
                    removeListener(id);
                }, true);
                addListener(id, `reject:${type}`, data => {
                    settle(reject, toError(data));
                    removeListener(id);
                }, true);
            }),
        };
    }
    function callPromiseFunction(type, ...params) {
        const { id, promise } = addPromiseListener(type);
        log(`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/ %cFrame \u2B9E %cService %c/ %c${type}`, PUNCT_FORMAT, MAIN_FORMAT, PUNCT_FORMAT, FRAME_FORMAT, SERVICE_FORMAT, PUNCT_FORMAT, MESSAGE_FORMAT, 
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        ...params);
        const message = { type, id, data: params, origin: self.origin, frame: true };
        trackCall(message);
        return promise;
    }
    const retryOnReadyTypes = new Set([
        'setOrigin',
        'getProfiles',
        'getProfile',
        'getCollections',
        'getInventory',
        'getInventoryCached',
        'getPgcrs',
        'getComponentNames',
        'getState',
        'checkUpdate',
    ]);
    function canRetryOnServiceReady(type) {
        return type.startsWith('_get') || retryOnReadyTypes.has(type);
    }
    function trackCall(message) {
        const record = {
            message,
            created: Date.now(),
            lastSent: 0,
            retryOnServiceReady: canRetryOnServiceReady(message.type),
        };
        if (!message.frame) {
            record.timeout = setTimeout(() => {
                completeCall(message.id);
                const err = timeoutError(`Conduit service request '${message.type}' (${message.id})`, REQUEST_TIMEOUT);
                log(`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/ %c${message.id.padEnd(11, ' ')} %cHost %c\u2B9C Service %c/ %creject:${message.type}`, PUNCT_FORMAT, MAIN_FORMAT, PUNCT_FORMAT, colourFromId(message.id), HOST_FORMAT, SERVICE_FORMAT, PUNCT_FORMAT, ERROR_FORMAT, err);
                parentWindow.postMessage({ id: message.id, type: `reject:${message.type}`, data: serialiseError(err) }, '*');
            }, REQUEST_TIMEOUT);
        }
        unresolvedCalls.set(message.id, record);
        postToService(record);
    }
    function completeCall(id) {
        const record = unresolvedCalls.get(id);
        if (record?.timeout)
            clearTimeout(record.timeout);
        unresolvedCalls.delete(id);
    }
    function postToService(record) {
        record.lastSent = Date.now();
        try {
            service?.postMessage(record.message);
        }
        catch (err) {
            log(`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/ %c${record.message.id.padEnd(11, ' ')} %cFrame %c/ %cService postMessage failed`, ERROR_FORMAT, MAIN_FORMAT, PUNCT_FORMAT, colourFromId(record.message.id), FRAME_FORMAT, PUNCT_FORMAT, ERROR_FORMAT, err);
        }
    }
    function scheduleServiceReadyRecovery() {
        if (!unresolvedCalls.size)
            return;
        const readyAt = Date.now();
        log(`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/`, PUNCT_FORMAT, MAIN_FORMAT, PUNCT_FORMAT, `Frame ${frameInstanceId}. Service ready with ${unresolvedCalls.size} unresolved messages`);
        if (serviceReadyResendTimeout)
            clearTimeout(serviceReadyResendTimeout);
        serviceReadyResendTimeout = setTimeout(() => {
            serviceReadyResendTimeout = undefined;
            resend('ready', record => record.retryOnServiceReady
                && record.created <= readyAt
                && Date.now() - record.lastSent >= SERVICE_READY_RESEND_DELAY, 'Service ready recovery');
        }, SERVICE_READY_RESEND_DELAY);
    }
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        setService(registration.active, 'controllerchange');
    });
    async function updateServiceWorker(fallbackReason) {
        pendingServiceUpdate = undefined;
        await registration.update();
        const nextService = registration.installing ?? registration.waiting;
        const pendingUpdate = pendingServiceUpdate;
        if (pendingUpdate)
            await pendingUpdate;
        else if (nextService) {
            serviceUpdateResendPending = true;
            await trackServiceWorker(nextService, fallbackReason);
        }
    }
    function waitForActivation(worker) {
        if (!worker)
            return Promise.resolve(undefined);
        const trackedWorker = worker;
        if (trackedWorker.state === 'activated')
            return Promise.resolve(trackedWorker);
        if (trackedWorker.state === 'redundant')
            return Promise.resolve(undefined);
        return new Promise(resolve => {
            trackedWorker.addEventListener('statechange', onStateChange);
            function onStateChange() {
                if (trackedWorker.state !== 'activated' && trackedWorker.state !== 'redundant')
                    return;
                trackedWorker.removeEventListener('statechange', onStateChange);
                resolve(trackedWorker.state === 'activated' ? trackedWorker : undefined);
            }
        });
    }
    async function trackServiceWorker(worker, reason) {
        const nextService = await waitForActivation(worker);
        if (!nextService) {
            serviceUpdateResendPending = false;
            return undefined;
        }
        setService(nextService, reason);
        return nextService;
    }
    function adoptService(nextService) {
        if (!nextService || service === nextService)
            return false;
        service = nextService;
        return true;
    }
    function setService(nextService, reason = 'unknown') {
        if (!adoptService(nextService))
            return;
        if (!serviceUpdateResendPending)
            return;
        serviceUpdateResendPending = false;
        resend(reason);
    }
    function resend(reason = 'unknown', predicate, label = 'Service updated') {
        const records = Array.from(unresolvedCalls.values())
            .filter(record => !predicate || predicate(record));
        if (!records.length)
            return;
        log(`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/`, PUNCT_FORMAT, MAIN_FORMAT, PUNCT_FORMAT, `Frame ${frameInstanceId}. ${label} (${reason}). Resending ${records.length} unresolved messages`);
        for (const record of records)
            postToService(record);
    }
    async function retryStartupTask(label, task) {
        const attempts = 3;
        for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
                await withTimeout(task(), 2000);
                return;
            }
            catch (err) {
                if (attempt === attempts) {
                    console.warn(`Conduit frame startup ${label} failed:`, err);
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, 250 * attempt));
            }
        }
    }
    function withTimeout(promise, timeout) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => reject(new Error(`Timed out after ${timeout}ms`)), timeout);
            promise.then(value => {
                clearTimeout(timeoutId);
                resolve(value);
            }, err => {
                clearTimeout(timeoutId);
                reject(err instanceof Error ? err : new Error('Promise rejected', { cause: err }));
            });
        });
    }
    async function updateSettings() {
        const verboseLogging = await conduit._getSetting('verboseLogging');
        if (VERBOSE_LOGGING.value !== !!verboseLogging) {
            console.info(`%c${new Date().toTimeString().slice(0, 8)} %cconduit.deepsight.gg %c/ %cFrame %c/`, PUNCT_FORMAT, MAIN_FORMAT, PUNCT_FORMAT, FRAME_FORMAT, PUNCT_FORMAT, `${verboseLogging ? 'Enabled' : 'Disabled'} verbose logging`);
        }
        VERBOSE_LOGGING.value = !!verboseLogging;
    }
    parentWindow.postMessage({ type: '_active' }, '*');
    void retryStartupTask('settings update', updateSettings);
    void updateServiceWorker('startup update').catch(err => console.warn('Conduit service worker startup update failed:', err));
})();
