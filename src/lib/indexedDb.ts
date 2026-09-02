/**
 * indexedDb.ts
 * Reusable, generic IndexedDB wrapper.
 *
 * Usage:
 *   import { getRecord, putRecord, deleteRecord, getAllRecords, clearStore } from '@/lib/indexedDb';
 *
 *   await putRecord('companySettings', 'main', { companyName: 'Acme' });
 *   const settings = await getRecord<CompanySettings>('companySettings', 'main');
 */

const DB_NAME = 'edafter';
const DB_VERSION = 3;

/** Add new store names here as the app grows. */
const STORE_NAMES = ['companySettings', 'templates', 'documents'] as const;
export type StoreName = (typeof STORE_NAMES)[number];

/* ---------- singleton connection ---------- */

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORE_NAMES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name);
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

/* ---------- generic CRUD ---------- */

/** Read a single record by key. Returns `undefined` when not found. */
export async function getRecord<T>(store: StoreName, key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

/** Insert or update a record. */
export async function putRecord<T>(store: StoreName, key: string, value: T): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Delete a single record by key. */
export async function deleteRecord(store: StoreName, key: string): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Return every record in a store as an array. */
export async function getAllRecords<T>(store: StoreName): Promise<T[]> {
  const db = await openDb();
  return new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

/** Remove every record from a store. */
export async function clearStore(store: StoreName): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
