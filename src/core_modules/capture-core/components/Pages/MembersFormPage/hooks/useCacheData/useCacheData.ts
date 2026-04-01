interface TableName {
    tableName: 'programs' | 'optionGroups' | 'programRules' | 'programRuleVariables' | 'organisationUnitGroups';
}

type Table = TableName['tableName'];

const DB_NAME = 'kudufly-db';
const DB_VERSION = 2;

const OBJECT_STORES: Table[] = [
    'programs',
    'optionGroups',
    'programRules',
    'programRuleVariables',
    'organisationUnitGroups',
];

const openDB = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        for (const storeName of OBJECT_STORES) {
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: 'id' });
            }
        }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});

export const useCacheData = () => {
    const initializeDB = async (): Promise<void> => {
        const db = await openDB();
        db.close();
    };

    const saveDataToDB = async (data: any, tableName: Table): Promise<void> => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(tableName, 'readwrite');
            const store = tx.objectStore(tableName);
            store.put(data);

            tx.oncomplete = () => {
                db.close();
                resolve();
            };
            tx.onerror = () => {
                db.close();
                reject(tx.error);
            };
        });
    };

    const getDataFromDB = async <T = any>(tableName: Table, id: string): Promise<T | null> => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(tableName, 'readonly');
            const store = tx.objectStore(tableName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result ?? null);
            request.onerror = () => reject(request.error);
            tx.oncomplete = () => db.close();
        });
    };

    return { initializeDB, saveDataToDB, getDataFromDB };
};
