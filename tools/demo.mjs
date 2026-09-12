/* ============================================================
   הרצת האפליקציה בלי monday — נקודת הכניסה היחידה
   ------------------------------------------------------------
   ⚠ **אינו משתמש ב-`--env-file=.env`.** זו כל הנקודה: הפקודה
     הרגילה (`npm run dev`) נכשלת מיד על מכונה בלי `.env`
     ב-`node: .env: not found` — לא באזהרה, אלא בקריסה. מי
     שמושך את המאגר לראשונה נתקע שם.

   ⚠ **אינו נוגע ב-monday, ואינו יכול לגעת**: `KX_DATA=local`
     גורם ל-`api/_monday.js` לחזור לפני שורת ה-`fetch`, ולכן
     אין קריאת רשת אחת. אין טוקן, אין חשבון, אין תלות.

   ⚠ `SESSION_SECRET` נקבע כאן לערך פיתוח קבוע. הוא **חייב**
     להיות באורך 32 לפחות (ראו `secret()` ב-api/_session.js),
     והוא מקובע בכוונה כדי שהעוגייה תשרוד הפעלה מחדש — אחרת
     כל ריסטארט מנתק אותך באמצע בדיקה.
     ⚠ אינו סוד: אין כאן נתון של איש, והמכונה אינה חשופה.

   הרצה:
     npm run demo            השרת + זריעה אם חסרה
     npm run demo -- --reset זריעה מחדש מאפס
   ============================================================ */

import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

process.env.KX_DATA = "local";
process.env.SESSION_SECRET = process.env.SESSION_SECRET
  || "demo-only-session-secret-not-a-real-one-0123456789";
/* ⚠ נמחק במפורש. משתנה שנשאר בסביבה היה גורם לקוד לנסות
   את monday במסלולים שאינם עוברים דרך הדגל. */
delete process.env.MONDAY_TOKEN;
delete process.env.VERCEL;

const dataFile = resolve(root, ".demo", "data.json");
const reset = process.argv.includes("--reset");

if (reset && existsSync(dataFile)) rmSync(dataFile);

const run = (file, args = []) => new Promise((ok, bad) => {
  const p = spawn(process.execPath, [file, ...args], {
    cwd: root, stdio: "inherit", env: process.env,
  });
  p.on("exit", (c) => (c === 0 ? ok() : bad(new Error(file + " יצא בקוד " + c))));
});

if (!existsSync(dataFile)) {
  console.log("אין נתוני הדגמה — זורע...\n");
  await run(resolve(here, "demo-seed.mjs"));
  console.log("");
}

console.log("============================================================");
console.log("  מכינת ניר עוז — מצב מקומי, בלי monday ובלי רשת");
console.log("  http://localhost:5173");
console.log("");
console.log("  menahel / demo1234   ראש מכינה");
console.log("  madrich / demo1234   מדריך");
console.log("  chanich / demo1234   חניך עם חמישה תפקידים");
console.log("");
console.log("  לאפס את הנתונים:  npm run demo -- --reset");
console.log("============================================================\n");

await run(resolve(root, "node_modules", "vite", "bin", "vite.js"));
