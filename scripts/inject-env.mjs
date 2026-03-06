import fs from 'fs';
import path from 'path';

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '';

// 我們只注入 API Key，Client ID 既然已經寫在代碼裡就先不變動（除非環境變數有提供覆蓋）
const config = {
  apiKey: apiKey,
  clientId: process.env.DYNAMIC_SHEET_GOOGLE_CLIENT_ID || ''
};

const content = `window.__ENV_CONFIG__ = ${JSON.stringify(config, null, 2)};`;

// 確保路徑存在並寫入檔案到根目錄（供所有工具讀取）
const targetFile = path.join(process.cwd(), 'env-config.js');
fs.writeFileSync(targetFile, content);

console.log(`[Build] Generated env-config.js with API Key: ${apiKey ? 'PRESENT' : 'MISSING'}`);
