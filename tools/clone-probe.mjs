/* ============================================================
   ניסוי השכפול — האם monday משמרת מזהי עמודות?
   ------------------------------------------------------------
   ⚠⚠⚠ **זו השאלה שמכריעה את כל מסלול ההגדרה העצמית.**

     `api/_cycle.js` מחליף בזמן ריצה **מזהי לוחות בלבד** (35
     נתיבים). 342 מזהי העמודות שיושבים על אותם לוחות ממשיכים
     לבוא מ-`shared/*-ids.js` המקובעים.

     ההערה ב-`api/_cycles-api.js:17` אומרת שמזהי העמודות בלוח
     המשוכפל **שונים** מהמקור ו"לכן המיפוי נבנה לפי שם" —
     **ומיפוי כזה אינו קיים במאגר.** `api/_cycle-import.js`
     לוקח את הלוח מ-`cycle.boards[...]` (לפי המחזור) ואת
     העמודות מ-`MECHINA_COLS` / `LESSON_COLS` (מקובעות).

     כלומר אחד משניים:
       · monday משמרת → הקוד נכון וההערה שגויה.
       · monday אינה משמרת → לפיצ׳ר המחזורים יש באג רדום
         שיתפוצץ בהפעלה הראשונה של מחזור חדש.

   ⚠ **וזה נכשל בשקט.** `val(i, c)` מחזיר `""` לעמודה שאינה
     נמצאת — כלומר מחזור חדש ייראה כמו מחזור ריק, לא כמו
     תקלה. זה עיקרון 6 בגרסה הגרועה ביותר שלו.

   ------------------------------------------------------------
   מה הוא עושה:
     1. משכפל לוח ב-`duplicate_board_with_structure` (מבנה
        בלי שורות — אף פריט לא נוצר).
     2. משווה עמודה-עמודה לפי **כותרת**: מזהה, סוג, ותוויות
        הסטטוס על מפתחותיהן.
     3. **מוחק את הלוח שהוא יצר** — לפי המזהה שחזר מהיצירה
        ולא לפי סינון שם (ראו הכלל ב-CLAUDE.md).

   ⚠ אינו נוגע בלוח המקור, בשום מצב. רק קורא ממנו.

   ⚠ **הרצה יבשה כברירת מחדל**: בלי `--go` הוא רק מדפיס מה
     הוא עומד לשכפל ויוצא. השכפול עצמו יוצר לוח, ולכן הוא
     פעולה שדורשת אישור מפורש.

   הרצה:
     node --env-file=.env tools/clone-probe.mjs            # יבש
     node --env-file=.env tools/clone-probe.mjs --go       # באמת
     node --env-file=.env tools/clone-probe.mjs --go --keep   # בלי למחוק
     node --env-file=.env tools/clone-probe.mjs --go --board 5090791777
   ============================================================ */

import { gql } from "../api/_monday.js";
import { MECHINA_BOARDS } from "../shared/mechina-boards.js";
import { LESSON_BOARDS } from "../shared/lessons-boards.js";
import { PLACEMENT_BOARDS } from "../shared/placements-ids.js";

const GO = process.argv.includes("--go");
const KEEP = process.argv.includes("--keep");
const ONE = (() => {
  const i = process.argv.indexOf("--board");
  return i > -1 ? process.argv[i + 1] : null;
})();

/* ⚠ שלושה לוחות ולא אחד: התשובה עשויה להיות תלוית **סוג
   עמודה**. מצבת החניכים נושאת status, date, numbers, phone
   ו-email; הגיליונות נושאים checkbox ו-long_text; השיבוצים
   נושאים board_relation — וזה הסוג שהכי סביר שיתנהג אחרת,
   כי הוא מצביע על לוח אחר. */
const TARGETS = ONE
  ? [{ title: "לוח שנבחר ידנית", id: String(ONE) }]
  : [
    { title: "מצבת החניכים", id: MECHINA_BOARDS.roster },
    { title: "גיליונות מרצים", id: LESSON_BOARDS.sheets },
    { title: "שיבוצי חניכים", id: PLACEMENT_BOARDS.assignments },
  ];

const NAME = (t) => `זמני · בדיקת שכפול · ${t} · ${Date.now()}`;

/* ⚠ המזהים שנוצרו, לניקוי. נשמרים מיד אחרי היצירה — ולא
   מחושבים מחדש בסוף לפי שם. */
const created = [];

async function columnsOf(boardId) {
  const d = await gql(
    `query($b:[ID!]){ boards(ids:$b){ id name columns{ id title type settings_str } } }`,
    { b: [String(boardId)] });
  const b = d?.boards?.[0];
  if (!b) throw new Error(`לוח ${boardId} לא נמצא`);
  return b.columns || [];
}

/** מפתחות התוויות בעמודת סטטוס — כולל אינדקס 5 (ראו 5ז) */
function labelKeys(settings_str) {
  try {
    const s = JSON.parse(settings_str || "{}");
    if (!s.labels) return null;
    return Object.entries(s.labels)
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join(" | ");
  } catch { return null; }
}

async function cleanup() {
  for (const id of created.splice(0)) {
    try {
      await gql(`mutation($b:ID!){ delete_board(board_id:$b){ id } }`, { b: String(id) });
      console.log(`  נמחק לוח הבדיקה ${id}`);
    } catch (e) {
      console.error(`  ⚠ מחיקת ${id} נכשלה — למחוק ידנית: ${e && e.message}`);
    }
  }
}

/* ⚠ גם נפילה באמצע מוחקת אחריה. בלי זה הרצה שנפלה משאירה
   לוחות זבל בחשבון של המכינה. */
for (const sig of ["uncaughtException", "unhandledRejection", "SIGINT"]) {
  process.on(sig, async (e) => { console.error("\n" + sig, e); await cleanup(); process.exit(1); });
}

async function probe(target) {
  console.log(`\n=== ${target.title}  (לוח ${target.id}) ===`);

  const src = await columnsOf(target.id);
  console.log(`  עמודות במקור: ${src.length}`);
  if (!GO) { console.log("  (הרצה יבשה — לא שוכפל. להוסיף --go)"); return null; }

  const name = NAME(target.title);
  const d = await gql(
    `mutation($b:ID!,$n:String!){
       duplicate_board(board_id:$b, board_name:$n,
         duplicate_type: duplicate_board_with_structure){ board{ id } } }`,
    { b: String(target.id), n: name });

  const dupId = d?.duplicate_board?.board?.id;
  if (!dupId) throw new Error("השכפול לא החזיר מזהה");
  created.push(dupId);
  console.log(`  שוכפל ללוח ${dupId}`);

  /* ⚠ monday משכפלת ברקע. קריאה מיד אחרי היצירה עשויה להחזיר
     רשימת עמודות חלקית — וזו "תשובה" שגויה שנראית כמו
     "העמודות לא נשמרו". ממתינים על **תנאי** ולא על זמן. */
  let dup = [];
  for (let i = 0; i < 15; i++) {
    dup = await columnsOf(dupId);
    if (dup.length >= src.length) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log(`  עמודות בעותק: ${dup.length}`);

  const byTitle = new Map();
  for (const c of dup) {
    if (!byTitle.has(c.title)) byTitle.set(c.title, []);
    byTitle.get(c.title).push(c);
  }

  let same = 0, diff = 0, missing = 0, dupTitle = 0, labelDiff = 0;
  const rows = [];

  for (const s of src) {
    const hits = byTitle.get(s.title) || [];
    if (!hits.length) { missing++; rows.push(["חסרה", s.title, s.id, "—", s.type]); continue; }
    if (hits.length > 1) dupTitle++;
    const t = hits[0];
    const idSame = t.id === s.id;
    idSame ? same++ : diff++;

    const ls = labelKeys(s.settings_str), lt = labelKeys(t.settings_str);
    const labelsSame = ls === lt;
    if (ls !== null && !labelsSame) labelDiff++;

    if (!idSame || !labelsSame) {
      rows.push([idSame ? "תוויות" : "מזהה", s.title, s.id, t.id, s.type]);
    }
  }

  console.log(`  זהים: ${same}   שונים: ${diff}   חסרות: ${missing}` +
    `   כותרת כפולה: ${dupTitle}   תוויות שהשתנו: ${labelDiff}`);

  if (rows.length) {
    console.log("\n  מה שאינו תואם:");
    console.log("    " + "מה".padEnd(8) + "כותרת".padEnd(28) + "מקור".padEnd(24) + "עותק");
    for (const [what, title, a, b] of rows.slice(0, 40)) {
      console.log("    " + what.padEnd(8) + String(title).slice(0, 26).padEnd(28) +
        String(a).padEnd(24) + String(b));
    }
    if (rows.length > 40) console.log(`    ...ועוד ${rows.length - 40}`);
  }

  return { same, diff, missing, labelDiff, total: src.length };
}

/* ---------- ריצה ---------- */
console.log("ניסוי השכפול — האם מזהי העמודות שורדים duplicate_board_with_structure?");
if (!GO) console.log("⚠ הרצה יבשה. להוסיף --go כדי לשכפל באמת.\n");

const results = [];
try {
  for (const t of TARGETS) {
    const r = await probe(t);
    if (r) results.push({ ...r, title: t.title });
  }
} finally {
  if (!KEEP) await cleanup();
  else if (created.length) console.log(`\n⚠ --keep: הלוחות ${created.join(", ")} נשארו. למחוק ידנית.`);
}

if (!results.length) process.exit(0);

const totalDiff = results.reduce((n, r) => n + r.diff + r.missing, 0);
const totalLbl = results.reduce((n, r) => n + r.labelDiff, 0);

console.log("\n============================================================");
if (totalDiff === 0) {
  console.log("✓ מזהי העמודות **נשמרים** בשכפול.");
  console.log("  כלומר: ההערה ב-api/_cycles-api.js:17 שגויה, אין באג רדום");
  console.log("  בפיצ׳ר המחזורים, ואין צורך בשכבת פתרון-לפי-שם ל-342 עמודות.");
  console.log("");
  console.log("  ⚠⚠ אבל ההתנהגות הזו **אינה מתועדת אצל monday ואינה מובטחת**.");
  console.log("     בעבר היא הייתה הפוכה. לכן גם בתשובה הזו צריך אימות");
  console.log("     בזמן השכפול — ראו ההערה למעלה על הכישלון השקט.");
} else {
  console.log(`⚠⚠⚠ מזהי העמודות **אינם נשמרים** — ${totalDiff} אי-התאמות.`);
  console.log("  כלומר: לפיצ׳ר המחזורים יש באג רדום. מחזור חדש שיופעל");
  console.log("  יקרא עמודות שאינן קיימות, `val()` יחזיר \"\" לכולן,");
  console.log("  והמערכת תיראה ריקה ולא שבורה.");
}
if (totalLbl) console.log(`\n⚠ ${totalLbl} עמודות סטטוס שינו את מפתחות התוויות — ראו 5ז (אינדקס 5).`);
console.log("============================================================");
