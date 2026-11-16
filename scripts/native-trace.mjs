// Test-only. Install with page.addInitScript(installNativeTrace) BEFORE navigation.
// The function is self-contained so Playwright can serialize it into the page.
export function installNativeTrace() {
  const root = globalThis;
  const original = root.LanguageModel;
  const events = [];
  root.__nativeTrace = events;
  let sequence = 0;
  const base = performance.now();
  const emit = (event, detail = {}) => events.push({
    atMs: Math.round(performance.now() - base), event, ...detail,
  });
  if (!original) {
    emit('installation_failed', { reason: 'missing_native_api' });
    return;
  }
  const errorName = error => [
    'AbortError', 'InvalidStateError', 'NotSupportedError', 'QuotaExceededError',
    'OperationError', 'NotAllowedError', 'TypeError', 'SyntaxError',
  ].includes(error?.name) ? error.name : 'OtherError';
  const descriptor = (object, key) => {
    let target = object;
    while (target) {
      const found = Object.getOwnPropertyDescriptor(target, key);
      if (found) return {
        own: target === object,
        configurable: !!found.configurable,
        writable: 'writable' in found ? !!found.writable : null,
        getter: !!found.get,
      };
      target = Object.getPrototypeOf(target);
    }
    return null;
  };
  const traceCall = async (kind, id, call) => {
    const start = performance.now();
    emit(`${kind}_start`, { id });
    try {
      const value = await call();
      emit(`${kind}_end`, { id, outcome: 'completed', durationMs: Math.round(performance.now() - start) });
      return value;
    } catch (error) {
      emit(`${kind}_end`, { id, outcome: 'error', errorName: errorName(error), durationMs: Math.round(performance.now() - start) });
      throw error;
    }
  };
  const sessions = new WeakMap();
  const wrapSession = (session, id) => {
    if (sessions.has(session)) return sessions.get(session);
    emit('session_wrapped', { id, promptDescriptor: descriptor(session, 'prompt') });
    const methods = new Map();
    // A separate empty target avoids Proxy invariants for native readonly own
    // properties. Every getter/method uses the real session as its receiver.
    const proxy = new Proxy(Object.create(Object.getPrototypeOf(session)), {
      get(_target, key) {
        if (methods.has(key)) return methods.get(key);
        const value = Reflect.get(session, key, session);
        if (typeof value !== 'function') return value;
        let method;
        if (key === 'prompt') {
          method = (...args) => traceCall('prompt', id, () => Reflect.apply(value, session, args));
        } else if (key === 'destroy') {
          method = (...args) => {
            emit('destroy_called', { id });
            return Reflect.apply(value, session, args);
          };
        } else method = value.bind(session);
        methods.set(key, method);
        return method;
      },
    });
    sessions.set(session, proxy);
    return proxy;
  };
  const create = (...args) => {
    const id = ++sequence;
    const signal = args[0]?.signal;
    emit('create_signal', { id, present: !!signal, aborted: !!signal?.aborted });
    // Keep the listener after resolution: cleanup aborts after prompt completion
    // are diagnostically distinct from a timeout while prompt remains pending.
    signal?.addEventListener('abort', () => emit('signal_aborted', { id }), { once: true });
    return traceCall('create', id, () => Reflect.apply(original.create, original, args))
      .then(session => wrapSession(session, id));
  };
  const availability = (...args) => traceCall('availability', ++sequence, () => Reflect.apply(original.availability, original, args));
  // Firebase only reads availability/create from this provider. No instance or
  // readonly native member is mutated, and native constructor access remains bound.
  const provider = new Proxy(Object.create(Object.getPrototypeOf(original)), {
    get(_target, key) {
      if (key === 'create') return create;
      if (key === 'availability') return availability;
      const value = Reflect.get(original, key, original);
      return typeof value === 'function' ? value.bind(original) : value;
    },
  });
  const originalDescriptor = Object.getOwnPropertyDescriptor(root, 'LanguageModel');
  try {
    if (!originalDescriptor || originalDescriptor.configurable) {
      Object.defineProperty(root, 'LanguageModel', { configurable: true, enumerable: originalDescriptor?.enumerable ?? true, writable: true, value: provider });
    } else if ('writable' in originalDescriptor && originalDescriptor.writable) {
      root.LanguageModel = provider;
    } else throw new Error('Cannot replace native provider');
    if (root.LanguageModel !== provider) throw new Error('Provider replacement was ignored');
  } catch {
    emit('installation_failed', { reason: 'provider_readonly' });
    return;
  }
  const visibility = () => emit('visibility', { state: root.document?.visibilityState ?? 'unknown' });
  root.document?.addEventListener('visibilitychange', visibility);
  visibility();
  emit('installed', { createDescriptor: descriptor(original, 'create') });
  root.__stopNativeTrace = () => {
    root.document?.removeEventListener('visibilitychange', visibility);
    if (root.LanguageModel === provider) {
      if (originalDescriptor) Object.defineProperty(root, 'LanguageModel', originalDescriptor);
      else delete root.LanguageModel;
    }
    emit('uninstalled');
  };
}
