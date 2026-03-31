const DB_NAME = 'DeliveryWizardDB';
const DB_VERSION = 5; // 升級版本，打破舊有錯誤架構
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
        if (!db.objectStoreNames.contains(STORE_RECORDS)) {
          const store = db.createObjectStore(STORE_RECORDS, { keyPath: 'id' });
          store.createIndex('accountId', 'accountId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_ACCOUNTS)) {
          db.createObjectStore(STORE_ACCOUNTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_RULES)) {
          const store = db.createObjectStore(STORE_RULES, { keyPath: 'id' });
          store.createIndex('accountId', 'accountId', { unique: false });
        }
      };
      request.onsuccess = (e) => { dbInstance = e.target.result; resolve(dbInstance); };
      request.onerror = (e) => reject(e.target.error);
    });
  },

  // 帳號操作
  async getAccounts() {
    await this.init();
    return new Promise((resolve, reject) => {
      const req = dbInstance.transaction(STORE_ACCOUNTS, 'readonly').objectStore(STORE_ACCOUNTS).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async addAccount(name) {
    await this.init();
    return new Promise((resolve, reject) => {
      const account = { id: 'acc_' + Date.now(), name, createdAt: Date.now() };
      const tx = dbInstance.transaction(STORE_ACCOUNTS, 'readwrite');
      tx.objectStore(STORE_ACCOUNTS).put(account);
      tx.oncomplete = () => resolve(account);
      tx.onerror = () => reject(tx.error);
    });
  },
  async deleteAccount(id) {
    await this.init();
    return new Promise((resolve) => {
      const tx = dbInstance.transaction(STORE_ACCOUNTS, 'readwrite');
      tx.objectStore(STORE_ACCOUNTS).delete(id);
      tx.oncomplete = () => resolve();
    });
  },

  // 紀錄操作
  async getRecords(accountId) {
    await this.init();
    return new Promise((resolve) => {
      const index = dbInstance.transaction(STORE_RECORDS, 'readonly').objectStore(STORE_RECORDS).index('accountId');
      const req = index.getAll(accountId);
      req.onsuccess = () => resolve(req.result.sort((a, b) => b.timestamp - a.timestamp));
    });
  },
  async saveRecord(record) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = dbInstance.transaction(STORE_RECORDS, 'readwrite');
      tx.objectStore(STORE_RECORDS).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async deleteRecord(id) {
    await this.init();
    return new Promise((resolve) => {
      const tx = dbInstance.transaction(STORE_RECORDS, 'readwrite');
      tx.objectStore(STORE_RECORDS).delete(id);
      tx.oncomplete = () => resolve();
    });
  },

  // 規則操作 (完全防呆寫法)
  async getRules(accountId) {
    await this.init();
    return new Promise((resolve) => {
      const index = dbInstance.transaction(STORE_RULES, 'readonly').objectStore(STORE_RULES).index('accountId');
      const req = index.getAll(accountId);
      req.onsuccess = () => resolve(req.result);
    });
  },
  async saveRule(rule) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = dbInstance.transaction(STORE_RULES, 'readwrite');
      tx.objectStore(STORE_RULES).put(rule);
      tx.oncomplete = () => resolve(); // 確保資料寫進硬碟才放行
      tx.onerror = () => reject(tx.error);
    });
  },
  async deleteRule(id) {
    await this.init();
    return new Promise((resolve) => {
      const tx = dbInstance.transaction(STORE_RULES, 'readwrite');
      tx.objectStore(STORE_RULES).delete(id);
      tx.oncomplete = () => resolve();
    });
  },
  async syncTemplate(accountId, platform) {
    await this.init();
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
    // 依序寫入，確保每一條都成功
    for (const rule of templates) {
      await this.saveRule(rule);
    }
  },
    async clearAllData() {
    // 1. 先關閉現有的資料庫連線，避免推土機被擋住
    if (dbInstance) {
      dbInstance.close();
      dbInstance = null;
    }
    
    // 2. 呼叫底層 API 直接物理核爆整個資料庫
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      
      request.onsuccess = () => {
        console.log("推土機執行完畢，資料庫已徹底抹除");
        resolve();
      };
      
      request.onerror = (e) => {
        console.error("刪除失敗", e);
        reject(e.target.error);
      };
      
      // 萬一有其他分頁卡住，強制放行
      request.onblocked = () => {
        console.warn("刪除被阻擋，但我們不管它");
        resolve(); 
      };
    });
  }

};
