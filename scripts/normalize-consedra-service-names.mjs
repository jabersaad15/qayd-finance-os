import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const replacements = [
  [/السجالت/g, "السجلات"], [/العالمات/g, "العلامات"], [/االستثمار/g, "الاستثمار"], [/االندماج/g, "الاندماج"], [/االستحواذ/g, "الاستحواذ"],
  [/األنشطة/g, "الأنشطة"], [/األسواق/g, "الأسواق"], [/األدلة/g, "الأدلة"], [/األعمال/g, "الأعمال"], [/األداء/g, "الأداء"], [/اإلدارة/g, "الإدارة"],
  [/األجنبي/g, "الأجنبي"], [/األول/g, "الأول"], [/األوراق/g, "الأوراق"], [/األصول/g, "الأصول"], [/اإلدارية/g, "الإدارية"], [/اإللكترونية/g, "الإلكترونية"],
  [/األمن/g, "الأمن"], [/األجهزة/g, "الأجهزة"], [/األنظمة/g, "الأنظمة"], [/األبحاث/g, "الأبحاث"], [/األحداث/g, "الأحداث"],
  [/\(\)Business Models/g, "(Business Models)"], [/KPIوبطاقات/g, "KPI وبطاقات"],
];

function normalizeName(value) {
  let result = value.normalize("NFKC").replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "").replace(/\s+/g, " ").trim();
  for (const [pattern, replacement] of replacements) result = result.replace(pattern, replacement);
  return result.replace(/\s*\(\s*/g, " (").replace(/\s*\)\s*/g, ") ").replace(/\s+/g, " ").trim();
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [rows] = await connection.execute("SELECT id, nameAr FROM productsServices WHERE tenantId = 1 AND companyId = 1 AND kind = 'service' ORDER BY id");
  const changes = rows.map((row) => ({ id: Number(row.id), before: row.nameAr, after: normalizeName(row.nameAr) })).filter((item) => item.before !== item.after);
  await connection.beginTransaction();
  for (const change of changes) await connection.execute("UPDATE productsServices SET nameAr = ? WHERE id = ? AND tenantId = 1 AND companyId = 1", [change.after, change.id]);
  await connection.commit();
  const reportPath = "/home/ubuntu/consedra-finance-os/tmp/consedra-services-normalization-report.json";
  await fs.writeFile(reportPath, JSON.stringify({ totalServices: rows.length, corrected: changes.length, changes }, null, 2));
  console.log(JSON.stringify({ totalServices: rows.length, corrected: changes.length, reportPath }));
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
