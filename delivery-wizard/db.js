/* db.js (更新版) */
const DB_VERSION = 3; // 升級版本
const STORE_RULES = 'rules';

const db = {
  // ... 原有的 init(), getAccounts(), getRecords() 等 ...
  
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
        if (!db.objectStoreNames.contains(STORE_ACCOUNTS)) db.createObjectStore(STORE_ACCOUNTS, { keyPath: 'id' });
        // 新增規則 Store
        if (!db.objectStoreNames.contains(STORE_RULES)) {
          const store = db.createObjectStore(STORE_RULES, { keyPath: 'id' });
          store.createIndex('accountId', 'accountId', { unique: false });
        }
      };
      request.onsuccess = (e) => { dbInstance = e.target.result; resolve(dbInstance); };
      request.onerror = (e) => reject(e.target.error);
    });
  },

  // 規則相關操作
  async getRules(accountId) {
    await this.init();
    return new Promise((resolve) => {
      const tx = dbInstance.transaction(STORE_RULES, 'readonly');
      const store = tx.objectStore(STORE_RULES);
      const index = store.index('accountId');
      const req = index.getAll(accountId);
      req.onsuccess = () => resolve(req.result);
    });
  },

  async saveRule(rule) {
    const tx = dbInstance.transaction(STORE_RULES, 'readwrite');
    await tx.objectStore(STORE_RULES).put(rule);
  },

  async deleteRule(id) {
    const tx = dbInstance.transaction(STORE_RULES, 'readwrite');
    await tx.objectStore(STORE_RULES).delete(id);
  },

  // 範本同步
  async syncTemplate(accountId, platform) {
    let templates = [];
    if (platform === 'foodpanda') {
      templates = [
        { id: `fp_13_${accountId}`, accountId, platform: 'foodpanda', name: '熊貓(一~三)', activeDays: [1,2,3], tiers: [{t:30, b:100}, {t:50, b:250}] },
        { id: `fp_46_${accountId}`, accountId, platform: 'foodpanda', name: '熊貓(四~六)', activeDays: [4,5,6], tiers: [{t:30, b:100}, {t:50, b:250}] },
        { id: `fp_0_${accountId}`, accountId, platform: 'foodpanda', name: '熊貓週日', activeDays: [0], tiers: [{t:15, b:75}, {t:24, b:150}, {t:35, b:350}, {t:45, b:500}] }
      ];
    } else {
      templates = [{ id: `ue_week_${accountId}`, accountId, platform: 'ubereats', name: 'UE每週任務', activeDays: [1,2,3,4,5,6,0], tiers: [{t:20, b:150}, {t:40, b:400}] }];
    }
    for (const rule of templates) { await this.saveRule(rule); }
  }
};
