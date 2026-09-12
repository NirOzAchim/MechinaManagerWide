/* ============================================================
   השער של המצב המקומי — שהוא לעולם לא יידלק בייצור
   ------------------------------------------------------------
   ⚠⚠⚠ **זו הבדיקה שמגנה על המכינה.** מצב מקומי שיידלק
     בייצור יגיש למכינה מסך מלא בנתוני דמה **שנראים אמיתיים**
     — נוכחות, בקשות יציאה, מלאי. זה גרוע בהרבה מכל שגיאה,
     כי שום דבר במסך לא יגלה את זה.

     ולכן שני תנאים ולא אחד: `KX_DATA=local` **וגם** היעדר
     `process.env.VERCEL`. דגל שנשכח דלוק בהגדרות Vercel אינו
     מספיק כדי להדליק אותו.

   ⚠ **והכיוון השני חשוב לא פחות**: בלי הדגל ההתנהגות חייבת
     להיות **זהה לחלוטין** לזו שהייתה לפני שהמצב המקומי נוסף —
     אותה שגיאה, אותו מסלול. זה המבחן של "ההתנהגות של ניר עוז
     אינה משתנה".

   ⚠ אינו דורש רשת, טוקן או .env.

   הרצה:  npm run check:demo
   ============================================================ */

const M = new URL("../api/_monday.js", import.meta.url).href;

/** טוען את המודול מחדש תחת סביבה נתונה */
async function probe(env) {
  for (const k of ["KX_DATA", "VERCEL", "MONDAY_TOKEN"]) delete process.env[k];
  Object.assign(process.env, env);
  /* ⚠ מחרוזת שאילתה — בלעדיה המודול נשאר במטמון והבדיקה
     בודקת שש פעמים את אותה סביבה. */
  const { gql } = await import(`${M}?v=${Math.random()}`);
  try {
    const r = await gql("{ me { id } }");
    return { path: "local", note: JSON.stringify(r).slice(0, 40) };
  } catch (e) {
    if (/MONDAY_TOKEN/.test(e.message)) return { path: "monday", note: "נדרש טוקן" };
    return { path: "monday", note: e.message.slice(0, 40) };
  }
}

const CASES = [
  { t: "בלי דגל ובלי טוקן — בדיוק כמו קודם", env: {}, want: "monday" },
  { t: "בלי דגל, עם טוקן — monday אמיתית", env: { MONDAY_TOKEN: "x" }, want: "monday" },
  { t: "KX_DATA=local — מצב מקומי", env: { KX_DATA: "local" }, want: "local" },
  { t: "⚠ local + VERCEL — הדגל מתעלם", env: { KX_DATA: "local", VERCEL: "1" }, want: "monday" },
  { t: "⚠ local + VERCEL + טוקן — monday", env: { KX_DATA: "local", VERCEL: "1", MONDAY_TOKEN: "x" }, want: "monday" },
  { t: "KX_DATA=other — אינו מדליק", env: { KX_DATA: "other" }, want: "monday" },
  { t: "KX_DATA ריק — אינו מדליק", env: { KX_DATA: "" }, want: "monday" },
];

let pass = 0, fail = 0;
console.log("השער של המצב המקומי\n");
for (const c of CASES) {
  const got = await probe(c.env);
  const ok = got.path === c.want;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "✓" : "✗"} ${c.t.padEnd(42)} → ${got.path}${ok ? "" : `  (ציפינו ${c.want})`}`);
}

/* ⚠ ולא רק המסלול: המודול המקומי **לא ייטען כלל** כשהדגל
   כבוי. ייבוא שקורה תמיד הוא קוד שרץ בייצור בלי סיבה. */
const src = await (await import("node:fs/promises")).readFile(
  new URL("../api/_monday.js", import.meta.url), "utf8");
const lazy = /import\(\s*["']\.\/_demo-store\.js["']\s*\)/.test(src)
  && !/^\s*import\s+.*_demo-store/m.test(src);
lazy ? pass++ : fail++;
console.log(`  ${lazy ? "✓" : "✗"} הייבוא עצל — בייצור המודול אינו נטען`);

console.log(`\n${pass} עברו, ${fail} נכשלו`);
process.exit(fail ? 1 : 0);
