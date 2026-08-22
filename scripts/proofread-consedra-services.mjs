import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const tenantId = 1;
const companyId = 1;
const batchSize = 35;
const outputPath = "/home/ubuntu/consedra-finance-os/tmp/consedra-services-proofread-candidates.json";

function normalizeArabic(value) {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
    .replace(/\bKPI(?=\S)/g, "KPI ")
    .replace(/\(\)([A-Za-z])/g, "($1)")
    .replace(/\s+/g, " ")
    .trim();
}

async function proofreadBatch(items) {
  const response = await fetch(`${process.env.BUILT_IN_FORGE_API_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-5-mini",
      max_completion_tokens: 5000,
      messages: [
        { role: "system", content: "أنت مدقق لغوي عربي دقيق لكتالوج خدمات شركة. لا تترجم ولا تختصر ولا تضف أو تحذف خدمة. صحح فقط الأخطاء الإملائية الواضحة، الحروف العربية المشوهة الناتجة عن PDF، والمسافات وعلامات الترقيم. حافظ تماماً على المصطلحات الفنية والإنجليزية والأرقام. أعد JSON فقط بصيغة {items:[{id:number,nameAr:string,confidence:number}]}، ويجب أن يتضمن كل معرف مرة واحدة." },
        { role: "user", content: JSON.stringify({ items }) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`LLM request failed: ${response.status} ${await response.text()}`);
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content : content?.filter((part) => part.type === "text").map((part) => part.text).join("");
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed.items)) throw new Error("LLM response did not contain an items array.");
  return parsed.items;
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [rows] = await connection.execute("SELECT id, nameAr FROM productsServices WHERE tenantId = ? AND companyId = ? AND kind = 'service' ORDER BY id", [tenantId, companyId]);
  const normalized = rows.map((row) => ({ id: Number(row.id), nameAr: normalizeArabic(row.nameAr) }));
  const reviewed = [];
  for (let index = 0; index < normalized.length; index += batchSize) {
    const batch = normalized.slice(index, index + batchSize);
    const result = await proofreadBatch(batch);
    const byId = new Map(result.map((item) => [Number(item.id), item]));
    for (const item of batch) {
      const correction = byId.get(item.id);
      if (!correction || typeof correction.nameAr !== "string" || typeof correction.confidence !== "number") throw new Error(`Invalid correction for service ${item.id}`);
      reviewed.push({ id: item.id, original: rows.find((row) => Number(row.id) === item.id).nameAr, normalized: item.nameAr, suggested: normalizeArabic(correction.nameAr), confidence: correction.confidence });
    }
  }
  const candidates = reviewed.filter((item) => item.original !== item.suggested);
  await fs.writeFile(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), total: reviewed.length, changed: candidates.length, items: reviewed, candidates }, null, 2));
  console.log(JSON.stringify({ total: reviewed.length, changed: candidates.length, outputPath }));
} finally {
  await connection.end();
}
