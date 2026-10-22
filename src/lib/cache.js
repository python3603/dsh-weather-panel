/**
 * Minimal TTL cache over a synchronous storage (localStorage, or an in-memory
 * stand-in when storage is unavailable).
 *
 * The panel paints cached values immediately and only revalidates when they
 * are stale, which is what keeps reopening the panel cheap and keeps the
 * network quiet while the user switches sessions.
 */

export function createTtlCache(storage, prefix, now) {
  const clock = typeof now === 'function' ? now : () => Date.now();
  const namespace = typeof prefix === 'string' && prefix ? prefix : 'dshw:';

  function storageKey(key) {
    return `${namespace}${key}`;
  }

  function readRaw(key) {
    try {
      return storage.getItem(storageKey(key));
    } catch (error) {
      return null;
    }
  }

  function isExpired(entry) {
    return typeof entry.expiresAt === 'number' && entry.expiresAt <= clock();
  }

  return {
    /**
     * @returns {*} the stored value, or `undefined` when absent / expired / corrupt
     */
    get(key) {
      const raw = readRaw(key);
      if (!raw) return undefined;
      let entry;
      try {
        entry = JSON.parse(raw);
      } catch (error) {
        return undefined;
      }
      if (!entry || typeof entry !== 'object' || !('value' in entry)) return undefined;
      if (isExpired(entry)) {
        this.delete(key);
        return undefined;
      }
      return entry.value;
    },

    /**
     * @param {string} key
     * @param {*} value JSON-serializable value
     * @param {number} ttlMs lifetime in milliseconds
     * @returns {boolean} whether the write happened
     */
    set(key, value, ttlMs) {
      const lifetime = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : 0;
      const entry = { value, savedAt: clock(), expiresAt: clock() + lifetime };
      try {
        storage.setItem(storageKey(key), JSON.stringify(entry));
        return true;
      } catch (error) {
        return false;
      }
    },

    /** Timestamp of the stored value, or `null` when nothing is stored. */
    savedAt(key) {
      const raw = readRaw(key);
      if (!raw) return null;
      try {
        const entry = JSON.parse(raw);
        return entry && typeof entry.savedAt === 'number' ? entry.savedAt : null;
      } catch (error) {
        return null;
      }
    },

    delete(key) {
      try {
        storage.removeItem(storageKey(key));
      } catch (error) {
        /* storage may be full or blocked; dropping is best-effort */
      }
    }
  };
}

/**
 * Storage that degrades to memory instead of throwing.
 *
 * `localStorage` throws in private modes and when the quota is full; the panel
 * must keep working in both cases, so every access is guarded.
 */
export function createSafeStorage(probeKey) {
  const memory = new Map();
  let persistent = false;
  try {
    const probe = probeKey || 'dshw:probe';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    persistent = true;
  } catch (error) {
    persistent = false;
  }
  return {
    persistent,
    getItem(key) {
      if (!persistent) return memory.has(key) ? memory.get(key) : null;
      try {
        return window.localStorage.getItem(key);
      } catch (error) {
        return memory.has(key) ? memory.get(key) : null;
      }
    },
    setItem(key, value) {
      memory.set(key, value);
      if (!persistent) return;
      try {
        window.localStorage.setItem(key, value);
      } catch (error) {
        /* keep the in-memory copy only */
      }
    },
    removeItem(key) {
      memory.delete(key);
      if (!persistent) return;
      try {
        window.localStorage.removeItem(key);
      } catch (error) {
        /* ignore */
      }
    }
  };
}
