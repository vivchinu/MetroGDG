// IndexedDB persistence for imported manuals. Everything stays on the device.

const DB_NAME = 'metro-fix-assist';
const DB_VERSION = 1;
let dbPromise;

function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('manuals')) db.createObjectStore('manuals', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('pdfs')) db.createObjectStore('pdfs', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(store, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const result = fn(t.objectStore(store));
    t.oncomplete = () => resolve(result?.result ?? result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const listManuals = () => tx('manuals', 'readonly', (s) => s.getAll());
export const saveManual = (manual) => tx('manuals', 'readwrite', (s) => s.put(manual));
export const savePdf = (id, blob) => tx('pdfs', 'readwrite', (s) => s.put({ id, blob }));
export const getPdf = async (id) => (await tx('pdfs', 'readonly', (s) => s.get(id)))?.blob;

export async function deleteManual(id) {
  await tx('manuals', 'readwrite', (s) => s.delete(id));
  await tx('pdfs', 'readwrite', (s) => s.delete(id));
}

// Ask the browser not to evict our data under storage pressure.
export async function requestPersistence() {
  try { return await navigator.storage?.persist?.(); } catch { return false; }
}

export async function storageEstimate() {
  try { return await navigator.storage?.estimate?.(); } catch { return null; }
}
