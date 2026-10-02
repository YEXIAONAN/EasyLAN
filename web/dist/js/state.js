// Small observable values shared by transport and preferences. No render runtime.
export function ref(initial) {
  let value = initial;
  const listeners = new Set();
  return {
    get value() { return value; },
    set value(next) {
      if (Object.is(value, next)) return;
      value = next;
      for (const listener of listeners) listener(next);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
