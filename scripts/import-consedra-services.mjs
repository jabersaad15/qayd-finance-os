import fs from 'node:fs/promises';
import mysql from 'mysql2/promise';

const sourcePath = '/home/ubuntu/consedra-finance-os/tmp/service-items-raw.txt';
const tenantId = 1;
const companyId = 1;
const advisory = 'خدمة حسب الطلب — يحدد السعر عند إعداد عرض السعر أو الفاتورة.';

const normalize = (value) => value
  .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const raw = await fs.readFile(sourcePath, 'utf8');
const names = [...new Set(raw.split('\n').map(normalize).filter(Boolean))];
const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  await connection.beginTransaction();
  const [revenueAccounts] = await connection.execute(
    `SELECT id FROM accounts WHERE tenantId = ? AND companyId = ? AND accountType = 'revenue' AND isActive = 1 ORDER BY id LIMIT 1`,
    [tenantId, companyId],
  );
  const revenueAccountId = revenueAccounts[0]?.id ?? null;
  for (let index = 0; index < names.length; index += 1) {
    const sku = `CONS-SVC-${String(index + 1).padStart(3, '0')}`;
    await connection.execute(
      `INSERT INTO productsServices (tenantId, companyId, kind, sku, nameAr, description, unit, unitPrice, revenueAccountId, isActive)
       VALUES (?, ?, 'service', ?, ?, ?, 'خدمة', '0.000000', ?, 1)
       ON DUPLICATE KEY UPDATE nameAr = VALUES(nameAr), description = VALUES(description), isActive = 1`,
      [tenantId, companyId, sku, names[index], advisory, revenueAccountId],
    );
  }
  await connection.commit();
  console.log(JSON.stringify({ imported: names.length, priceMode: 'on_request' }));
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
