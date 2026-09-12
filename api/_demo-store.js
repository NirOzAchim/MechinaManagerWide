/* ============================================================
   monday מזויף — מצב הדגמה, בלי טוקן ובלי רשת
   ------------------------------------------------------------
   ⚠⚠⚠ **התפר הוא `api/_monday.js` ולא נקודות הקצה.**

     במאגר יש 79 נקודות קצה ו-107 עטיפות `withAuth`, אבל
     **שלוש פונקציות בלבד** נוגעות ב-monday: `gql`, `allItems`
     ו-`uploadFile`. לזייף אותן פירושו שכל 79 המסלולים רצים
     **בקוד האמיתי שלהם** — אותו אימות, אותן הרשאות, אותה
     לוגיקה עסקית — רק מול מחסן אחר.

     זו גם החזרה הגנרלית להחלפת מסד הנתונים: היום שבו monday
     תוחלף, התפר יהיה בדיוק כאן.

   ------------------------------------------------------------
   ⚠⚠ **לא ירוץ בייצור, לעולם.** הדלקה דורשת `KX_DATA=local`
     **וגם** היעדר `process.env.VERCEL`. שני תנאים ולא אחד:
     משתנה שנשכח דלוק בהגדרות Vercel היה מגיש למכינה מסך
     מלא בנתוני דמה שנראים אמיתיים — וזה גרוע בהרבה מכל
     שגיאה. אותה משמעת של `?date=` ב-`api/_test-date.js`.

   ⚠ **וגם בלי הדגל ההתנהגות לא משתנה**: בלי טוקן ובלי
     `KX_DATA` הקוד נכשל כמו תמיד ב-"MONDAY_TOKEN לא מוגדר".

   ------------------------------------------------------------
   ⚠ **מצב בקובץ ולא בזיכרון.** `vite` טוען מודולים מחדש
     ב-HMR, ומשתנה מודול היה מתאפס באמצע העבודה — כלומר
     שורה שנוספה במסך נעלמת בלי שאיש יבין למה.

   ⚠ **אינו מדמה את הסמנטיקה של monday**, ובכוונה: לא תוויות
     כפולות, לא הגבלת קצב, לא הרשאות. מה שכן — `text` אמיתי
     (לא JSON), ו-`value === null` לתא ריק, כי זה בדיוק המבחן
     שהקוד נשען עליו (5ז, אינדקס 5).

   ⚠ **זה אינו `tools/tests/monday-mock.mjs`.** ההוא בודק
     סקריפטי הקמה, מחזיר `text` כ-JSON, ונטען דרך `MONDAY_MOCK`.
     איחוד השניים היה שובר את `npm run check:seeds`.
   ============================================================ */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const DEMO_FILE = process.env.KX_DATA_FILE
  || resolve(process.cwd(), ".demo", "data.json");

/** ⚠ שני תנאים. ראו ההערה למעלה. */
export const isDemo = () =>
  process.env.KX_DATA === "local" && !process.env.VERCEL;

/* ---------- אחסון ---------- */
const empty = () => ({ boards: {}, seq: 900000000 });

function load() {
  if (!existsSync(DEMO_FILE)) return empty();
  try { return JSON.parse(readFileSync(DEMO_FILE, "utf8")); }
  catch { return empty(); }
}

function save(s) {
  mkdirSync(dirname(DEMO_FILE), { recursive: true });
  writeFileSync(DEMO_FILE, JSON.stringify(s), "utf8");
}

const next = (s) => String(++s.seq);

/** לוח שנשאל עליו ואינו קיים הוא לוח **ריק**, לא שגיאה. */
function board(s, id) {
  const k = String(id);
  if (!s.boards[k]) s.boards[k] = { id: k, name: "לוח " + k, columns: [], items: [] };
  return s.boards[k];
}

/* ============================================================
   ערך → טקסט
   ⚠⚠ **זו הנקודה שבה מוק תמים נכשל.** כל המאגר קורא
     `val(i,c)` שמחזיר `.text`, ו-monday מחזירה שם טקסט
     אנושי — שם התווית, לא `{"label":"..."}`. מוק שמחזיר
     JSON גורם לכל מסך להציג מחרוזות מסולסלות.
   ============================================================ */
export function textOf(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v !== "object") return String(v);

  if (typeof v.label === "string") return v.label;
  if (v.checked !== undefined) return (v.checked === true || v.checked === "true") ? "v" : "";
  if (v.date) return v.time ? `${v.date} ${String(v.time).slice(0, 5)}` : String(v.date);
  if (v.email !== undefined) return String(v.text || v.email || "");
  if (v.phone !== undefined) return String(v.phone || "");
  if (v.url !== undefined) return String(v.text || v.url || "");
  if (typeof v.text === "string") return v.text;
  if (Array.isArray(v.item_ids)) return v.item_ids.join(", ");
  if (Array.isArray(v.ids)) return v.ids.join(", ");
  return "";
}

/** ⚠ ריק אמיתי: `value` הוא `null` ולא `"{}"`. */
const isBlank = (v) => v === null || v === undefined || v === "" ||
  (typeof v === "object" && Object.keys(v).length === 0);

/** שורה פנימית → הצורה ש-monday מחזירה */
function asItem(it) {
  const cols = it.cols || {};
  return {
    id: String(it.id),
    name: String(it.name ?? ""),
    column_values: Object.entries(cols).map(([id, cell]) => {
      const raw = cell && typeof cell === "object" && "value" in cell ? cell.value : cell;
      const text = cell && typeof cell === "object" && "text" in cell
        ? String(cell.text ?? "") : textOf(raw);
      return {
        id,
        text,
        value: isBlank(raw) ? null : JSON.stringify(raw),
        /* ⚠ `linked_item_ids` — `allItems` מבקש אותו במפורש
           עבור עמודות קישור, ולוח השיבוצים נשען עליו. */
        linked_item_ids: raw && Array.isArray(raw.item_ids)
          ? raw.item_ids.map(String) : undefined,
      };
    }),
  };
}

/** כתיבה מהאפליקציה: JSON של monday → התא הפנימי */
function writeCols(it, json) {
  let obj;
  try { obj = typeof json === "string" ? JSON.parse(json || "{}") : (json || {}); }
  catch { obj = {}; }
  it.cols = it.cols || {};
  for (const [colId, v] of Object.entries(obj)) {
    /* ⚠ ניקוי הוא `null` ולא `{}` — ראו 5ז. */
    if (isBlank(v)) { it.cols[colId] = { text: "", value: null }; continue; }
    it.cols[colId] = { text: textOf(v), value: v };
  }
}

/* ============================================================
   ה-API
   ⚠ התאמת תבנית ולא מנוע GraphQL. הרשימה סגורה: אלה **כל**
     הפעולות שנספרו ב-api/ (38 change_multiple, 30 create_item,
     27 boards(, 21 delete_item, 9 create_column, 6 create_board,
     6 change_simple, 4 items(ids, 4 duplicate_board, 2
     update_status_column, 2 next_items_page, 1 me, 1 complexity,
     1 add_file_to_column).

   ⚠ **שאילתה שאינה מוכרת זורקת ואינה מחזירה `{}` בשקט.**
     תשובה ריקה נראית כמו לוח ריק, וזה עיקרון 6 — מסך שנראה
     תקין ומראה נתון שגוי.
   ============================================================ */
export async function gql(query, vars = {}) {
  const s = load();
  const q = String(query);
  const has = (re) => new RegExp(re).test(q);

  try {
    if (has("\\bcomplexity\\b")) return { complexity: { after: 5000000 } };
    if (has("\\bme\\s*\\{")) return { me: { id: "1", name: "הדגמה" } };

    if (has("create_board")) {
      const b = { id: next(s), name: String(vars.n || vars.name || "לוח"), columns: [], items: [] };
      s.boards[b.id] = b;
      return { create_board: { id: b.id } };
    }

    if (has("duplicate_board")) {
      const src = board(s, vars.b);
      const b = {
        id: next(s), name: String(vars.n || src.name + " (עותק)"),
        /* ⚠ **משמר מזהי עמודות** — זו ההתנהגות שהניסוי
           ב-tools/clone-probe.mjs נועד לאמת מול monday
           האמיתית. אם יתברר אחרת, כאן המקום לשקף זאת. */
        columns: JSON.parse(JSON.stringify(src.columns || [])),
        items: [], // duplicate_board_with_structure — מבנה בלי שורות
      };
      s.boards[b.id] = b;
      return { duplicate_board: { board: { id: b.id } } };
    }

    if (has("delete_board")) {
      delete s.boards[String(vars.b)];
      return { delete_board: { id: String(vars.b) } };
    }

    if (has("create_column")) {
      const b = board(s, vars.b);
      const title = String(vars.t ?? "");
      const dup = b.columns.find((c) => c.title === title);
      if (dup) return { create_column: { id: dup.id } };
      const lit = q.match(/column_type:\s*([a-z_]+)\b/);
      const type = vars.c || (lit && lit[1] !== "$c" ? lit[1] : "text");
      const col = {
        id: `${type}_demo${next(s)}`, title, type,
        settings_str: String(vars.s || "{}"), revision: "1",
      };
      b.columns.push(col);
      return { create_column: { id: col.id } };
    }

    if (has("update_status_column")) {
      const b = board(s, vars.b);
      const col = b.columns.find((c) => String(c.id) === String(vars.c));
      if (col) col.revision = String(Number(col.revision || 1) + 1);
      return { update_status_column: { id: String(vars.c || "") } };
    }

    if (has("create_item")) {
      const b = board(s, vars.b);
      const it = { id: next(s), name: String(vars.n ?? ""), cols: {} };
      writeCols(it, vars.v);
      b.items.push(it);
      return { create_item: { id: it.id } };
    }

    if (has("change_multiple_column_values")) {
      const b = board(s, vars.b);
      const it = b.items.find((x) => String(x.id) === String(vars.i));
      if (it) writeCols(it, vars.v);
      return { change_multiple_column_values: { id: String(vars.i) } };
    }

    if (has("change_simple_column_value")) {
      const b = board(s, vars.b);
      const it = b.items.find((x) => String(x.id) === String(vars.i));
      const colId = vars.c || (q.match(/column_id:\s*"([^"]+)"/) || [])[1];
      if (it) {
        /* ⚠ `column_id:"name"` משנה את שם השורה ולא תא. */
        if (colId === "name") it.name = String(vars.n ?? vars.value ?? "");
        else { it.cols = it.cols || {}; it.cols[colId] = { text: String(vars.n ?? ""), value: String(vars.n ?? "") }; }
      }
      return { change_simple_column_value: { id: String(vars.i) } };
    }

    if (has("delete_item")) {
      const id = String(vars.i ?? (q.match(/delete_item\s*\(\s*item_id:\s*(\d+)/) || [])[1] ?? "");
      for (const b of Object.values(s.boards)) {
        b.items = b.items.filter((x) => String(x.id) !== id);
      }
      return { delete_item: { id } };
    }

    if (has("add_file_to_column")) {
      return { add_file_to_column: { id: next(s), name: "demo-file" } };
    }

    if (has("next_items_page")) {
      return { next_items_page: { cursor: null, items: [] } };
    }

    /* ⚠ `items(ids:)` — שליפה נקודתית של שורות לפי מזהה. */
    if (has("\\bitems\\s*\\(\\s*ids")) {
      const want = new Set((Array.isArray(vars.i) ? vars.i : [vars.i]).filter(Boolean).map(String));
      const out = [];
      for (const b of Object.values(s.boards)) {
        for (const it of b.items) if (want.has(String(it.id))) out.push(asItem(it));
      }
      return { items: out };
    }

    if (has("boards\\s*\\(\\s*ids")) {
      const raw = vars.b ?? (q.match(/boards\s*\(\s*ids:\s*\[([^\]]*)\]/) || [])[1];
      const list = Array.isArray(raw)
        ? raw
        : String(raw ?? "").split(",").map((x) => x.replace(/["\s]/g, "")).filter(Boolean);
      return {
        boards: list.map((id) => {
          const b = board(s, id);
          const out = { id: b.id, name: b.name };
          if (has("columns")) {
            out.columns = (b.columns || []).map((c) => ({
              id: c.id, title: c.title, type: c.type,
              settings_str: c.settings_str || "{}", revision: c.revision || "1",
            }));
          }
          if (has("items_page")) {
            out.items_page = { cursor: null, items: b.items.map(asItem) };
          }
          if (has("groups")) out.groups = [{ id: "topics", title: "ראשי" }];
          return out;
        }),
      };
    }

    if (has("boards\\s*\\(\\s*limit")) {
      return { boards: Object.values(s.boards).map((b) => ({ id: b.id, name: b.name })) };
    }

    throw new Error("מצב הדגמה: שאילתה שאינה מוכרת — "
      + q.replace(/\s+/g, " ").trim().slice(0, 120));
  } finally {
    save(s);
  }
}

export async function allItems(boardId) {
  const s = load();
  return board(s, boardId).items.map(asItem);
}

/** ⚠ חתימה זהה ל-api/_monday.js. ייצוא חסר נופל בטעינת הנתב. */
export async function uploadFile(itemId, columnId, fileName) {
  return { add_file_to_column: { id: "demo-file", name: String(fileName || "") } };
}

/* ---------- שירות לזריעה ---------- */
export function writeSeed(data) { save(data); }
export function readSeed() { return load(); }
export { board as ensureBoard, next as nextId };
