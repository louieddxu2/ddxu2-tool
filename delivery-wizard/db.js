/* db.js - 負責資料庫與資料結構 */
const DB_NAME = 'DeliveryWizardDB';
const DB_VERSION = 2; // 升級版本以支援帳號表
const STORE_RECORDS = 'records';
const STORE_ACCOUNTS = 'accounts';

let dbInstance = null;

const db = {
  async init() {
    if (dbInstance) return dbInstance;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_RECORDS)) {
          const store = db.createObjectStore(STORE_RECORDS, { keyPath: 'id' });
          store.createIndex('accountId', 'accountId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_ACCOUNTS)) {
          db.createObjectStore(STORE_ACCOUNTS, { keyPath: 'id' });
        }
      };
      request.onsuccess = (e) => { dbInstance = e.target.result; resolve(dbInstance); };
      request.onerror = (e) => reject(e.target.error);
    });
  },

  // 帳號操作
  async getAccounts() {
    await this.init();
    return new Promise((resolve) => {
      const tx = dbInstance.transaction(STORE_ACCOUNTS, 'readonly');
      const req = tx.objectStore(STORE_ACCOUNTS).getAll();
      req.onsuccess = () => resolve(req.result);
    });
  },

  async addAccount(name) {
    const account = { id: 'acc_' + Date.now(), name, createdAt: Date.now() };
    const tx = dbInstance.transaction(STORE_ACCOUNTS, 'readwrite');
    await tx.objectStore(STORE_ACCOUNTS).put(account);
    return account;
  },

  async deleteAccount(id) {
    // 這裡暫時只刪除帳號，不連動刪除紀錄 (保險起見)
    const tx = dbInstance.transaction(STORE_ACCOUNTS, 'readwrite');
    await tx.objectStore(STORE_ACCOUNTS).delete(id);
  },

  // 紀錄操作 (自動過濾當前帳號)
  async getRecords(accountId) {
    await this.init();
    return new Promise((resolve) => {
      const tx = dbInstance.transaction(STORE_RECORDS, 'readonly');
      const store = tx.objectStore(STORE_RECORDS);
      const index = store.index('accountId');
      const req = index.getAll(accountId);
      req.onsuccess = () => resolve(req.result.sort((a,b) => b.timestamp - a.timestamp));
    });
  },

  async saveRecord(record) {
    const tx = dbInstance.transaction(STORE_RECORDS, 'readwrite');
    await tx.objectStore(STORE_RECORDS).put(record);
  },

  async deleteRecord(id) {
    const tx = dbInstance.transaction(STORE_RECORDS, 'readwrite');
    await tx.objectStore(STORE_RECORDS).delete(id);
  },

  async clearAllData() {
    const tx1 = dbInstance.transaction(STORE_RECORDS, 'readwrite');
    tx1.objectStore(STORE_RECORDS).clear();
    const tx2 = dbInstance.transaction(STORE_ACCOUNTS, 'readwrite');
    tx2.objectStore(STORE_ACCOUNTS).clear();
  }
};
