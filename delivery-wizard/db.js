/* db.js */
const DB_NAME = 'DeliveryWizardDB';
const DB_VERSION = 4; // 強制升級版本以確保規則資料表建立
const STORE_RECORDS = 'records';
const STORE_ACCOUNTS = 'accounts';
const STORE_RULES = 'rules';

let dbInstance = null;

const db = {
  async init() {
    if (dbInstance) return dbInstance;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        // 建立紀錄表
        if (!db.objectStoreNames.contains(STORE_RECORDS)) {
          const store = db.createObjectStore(STORE_RECORDS, { keyPath: 'id' });
          store.createIndex('accountId', 'accountId', { unique: false });
        }
        // 建立帳號表
        if (!db.objectStoreNames.contains(STORE_ACCOUNTS)) {
          db.createObjectStore(STORE_ACCOUNTS, { keyPath: 'id' });
        }
        // 建立規則表 (核心修復)
        if (!db.objectStoreNames.contains(STORE_RULES)) {
          const store = db.createObjectStore(STORE_RULES, { keyPath: 'id' });
          store.createIndex('accountId', 'accountId', { unique: false });
        }
      };
      request.onsuccess = (e) => { dbInstance = e.target.result; resolve(dbInstance); };
      request.onerror = (e) => { console.error("DB Error:", e.target.error); reject(e.target.error); };
    });
  },

  async getAccounts() {
    await this.init();
    return new Promise(resolve => {
      const req = dbInstance.transaction(STORE_ACCOUNTS, 'readonly').objectStore(STORE_ACCOUNTS).getAll();
      req.onsuccess = () => resolve(req.result);
    });
  },
  async addAccount(name) {
    await this.init();
    const account = { id: 'acc_' + Date.now(), name, createdAt: Date.now() };
    await dbInstance.transaction(STORE_ACCOUNTS, 'readwrite').objectStore(STORE_ACCOUNTS).put(account);
    return account;
  },
  async deleteAccount(id) {
    await this.init();
    await dbInstance.transaction(STORE_ACCOUNTS, 'readwrite').objectStore(STORE_ACCOUNTS).delete(id);
  },

  async getRecords(accountId) {
    await this.init();
    return new Promise(resolve => {
      const index = dbInstance.transaction(STORE_RECORDS, 'readonly').objectStore(STORE_RECORDS).index('accountId');
      const req = index.getAll(accountId);
      req.onsuccess = () => resolve(req.result.sort((a,b) => b.timestamp - a.timestamp));
    });
  },
  async saveRecord(record) {
    await this.init();
    await dbInstance.transaction(STORE_RECORDS, 'readwrite').objectStore(STORE_RECORDS).put(record);
  },
  async deleteRecord(id) {
    await this.init();
    await dbInstance.transaction(STORE_RECORDS, 'readwrite').objectStore(STORE_RECORDS).delete(id);
  },

  async getRules(accountId) {
    await this.init();
    return new Promise(resolve => {
      const index = dbInstance.transaction(STORE_RULES, 'readonly').objectStore(STORE_RULES).index('accountId');
      const req = index.getAll(accountId);
      req.onsuccess = () => resolve(req.result);
    });
  },
  async saveRule(rule) {
    await this.init(); // 修復：儲存前必須初始化
    return new Promise((resolve, reject) => {
      const tx = dbInstance.transaction(STORE_RULES, 'readwrite');
      const store = tx.objectStore(STORE_RULES);
      const req = store.put(rule);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
  async deleteRule(id) {
    await this.init();
    await dbInstance.transaction(STORE_RULES, 'readwrite').objectStore(STORE_RULES).delete(id);
  },
  async syncTemplate(accountId, platform) {
    await this.init(); // 修復：同步前必須初始化
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
    for (const rule of templates) await this.saveRule(rule);
  },
  async clearAllData() {
    await this.init();
    await dbInstance.transaction(STORE_RECORDS, 'readwrite').objectStore(STORE_RECORDS).clear();
    await dbInstance.transaction(STORE_RULES, 'readwrite').objectStore(STORE_RULES).clear();
    await dbInstance.transaction(STORE_ACCOUNTS, 'readwrite').objectStore(STORE_ACCOUNTS).clear();
  }
};
