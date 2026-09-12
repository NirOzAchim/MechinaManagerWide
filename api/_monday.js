/* ============================================================
   לקוח monday — צד שרת בלבד
   ------------------------------------------------------------
   הקובץ הזה קורא את MONDAY_TOKEN, ולכן אסור שייובא אי פעם
   מתוך src/. הוא רץ רק בפונקציות שב-api/, שמופעלות על השרת.

   מקומית הטוקן מגיע מ-.env; ב-Vercel מ-Environment Variables.
   ============================================================ */

const ENDPOINT = "https://api.monday.com/v2";

/* ============================================================
   ⚠ שגיאות שכן שווה לנסות שוב עליהן — תקלה רגעית אצל monday
     או הגבלת קצב. כל השאר (תווית חסרה, עמודה שהוחלפה, הרשאה)
     הן טעות בקוד, ועליהן נכשלים מיד וברעש.
   ============================================================ */
const TRANSIENT = /INTERNAL_SERVER_ERROR|DOWNSTREAM_SERVICE_ERROR|Internal server error|ComplexityException|RATE_LIMIT|Too many requests|502|503|504/i;

/* ============================================================
   מצב הדגמה — המחסן מוחלף, הקוד לא
   ------------------------------------------------------------
   ⚠⚠ **שני תנאים, ולא אחד**: `KX_DATA=local` **וגם** היעדר
     `process.env.VERCEL`. דגל שנשכח דלוק בהגדרות Vercel היה
     מגיש למכינה מסך מלא בנתוני דמה שנראים אמיתיים — גרוע
     מכל שגיאה. אותה משמעת של `?date=` ב-api/_test-date.js.

   ⚠ **ובלי הדגל שום דבר לא משתנה.** בלי טוקן ובלי KX_DATA
     נכשלים בדיוק כמו קודם, באותה הודעה.

   ⚠ ייבוא **עצל וממוטמע**: בייצור המודול אינו נטען כלל.

   ⚠ **`allItems` אינו מגושר כאן** — הוא קורא ל-`gql` שלמעלה,
     ולכן הוא מקבל את ההדגמה מעצמו. גישור נפרד היה מסלול שני
     שיכול לסטות.
   ============================================================ */
let demoMod;
const demo = () => (demoMod = demoMod || import("./_demo-store.js"));
const demoOn = () => process.env.KX_DATA === "local" && !process.env.VERCEL;

export async function gql(query, variables = {}) {
  if (demoOn()) return (await demo()).gql(query, variables);

  const token = process.env.MONDAY_TOKEN;
  if (!token) throw new Error("MONDAY_TOKEN לא מוגדר בסביבה");

  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: token, "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(25000),
      });

      const json = await r.json();
      if (json.errors) {
        /* ============================================================
           ⚠⚠ **לא כל שגיאת GraphQL היא קבועה.**

           כאן היה כתוב "שגיאת סכמה או הרשאה לא תשתפר בניסיון
           חוזר", וזה נכון — אבל **`INTERNAL_SERVER_ERROR` של
           monday אינו שגיאת סכמה**, הוא תקלה רגעית אצלם. הוא
           הגיע באותו שדה `errors`, ולכן נזרק מיד בלי אף ניסיון
           חוזר.

           זה נראה בפיילוט כ**"ההתחברות נכשלת"**: monday החזירה
           500 לחלק מהבקשות, כל כניסה קוראת ללוח, וכל כישלון
           כזה הפיל את הכניסה לגמרי — בזמן שהניסיון הבא היה
           מצליח. אצל המשתמש זה נראה כמו מערכת שבורה, ואצלנו
           כמו "monday נפלה".

           ⚠ **וההבחנה חייבת להישאר.** תווית שאינה קיימת, עמודה
             שהוחלפה או הרשאה חסרה **חייבות להיכשל ברעש ומיד** —
             ניסיון חוזר עליהן רק מסתיר טעות בקוד ומשלש את הזמן.
           ============================================================ */
        const text = JSON.stringify(json.errors);
        if (attempt < 2 && TRANSIENT.test(text)) {
          lastError = new Error("monday: " + text);
          /* ⚠ המתנה גדלה: תקלה רגעית אצלם לא נפתרת באותה
             מילישנייה, וניסיון מיידי הוא בזבוז של שלוש בקשות. */
          await new Promise((z) => setTimeout(z, 400 * (attempt + 1)));
          continue;
        }
        throw new Error("monday: " + text);
      }
      return json.data;
    } catch (e) {
      lastError = e;
      if (String(e.message).startsWith("monday:")) throw e;
      // תקלת רשת או timeout — שווה לנסות שוב
    }
  }
  throw new Error("הקריאה ל-monday נכשלה אחרי 3 ניסיונות: " + lastError?.message);
}

/**
 * מעלה קובץ לעמודת קבצים של פריט.
 *
 * ⚠ נקודת קצה נפרדת של monday (v2/file) עם multipart — לא
 *   ה-GraphQL הרגיל. הקובץ מגיע כ-Buffer אחרי פענוח base64.
 */
export async function uploadFile(itemId, columnId, fileName, buffer, mime = "application/octet-stream") {
  /* ⚠ נקודת קצה נפרדת של monday ולא GraphQL, ולכן היא **כן**
     צריכה גישור משלה — בניגוד ל-allItems. */
  if (demoOn()) return (await demo()).uploadFile(itemId, columnId, fileName);

  const token = process.env.MONDAY_TOKEN;
  if (!token) throw new Error("MONDAY_TOKEN לא מוגדר בסביבה");

  const form = new FormData();
  form.append("query",
    `mutation($file: File!) { add_file_to_column(item_id: ${Number(itemId)}, column_id: "${columnId}", file: $file) { id } }`);
  form.append("variables[file]", new Blob([buffer], { type: mime }), fileName);

  const r = await fetch("https://api.monday.com/v2/file", {
    method: "POST",
    headers: { Authorization: token },
    body: form,
    signal: AbortSignal.timeout(60000),
  });
  const json = await r.json();
  if (json.errors) throw new Error("monday: " + JSON.stringify(json.errors));
  return json.data;
}

/** שולף את כל הפריטים בלוח, כולל דפדוף מעבר ל-500 */
export async function allItems(boardId, extraFields = "") {
  const out = [];
  let cursor = null;

  do {
    const page = cursor
      ? `next_items_page(limit:500, cursor:${JSON.stringify(cursor)})`
      : `boards(ids:[${boardId}]){ items_page(limit:500)`;

    const query = cursor
      ? `{ ${page} { cursor items { id name ${extraFields}
             column_values { id text value ... on BoardRelationValue { linked_item_ids } } } } }`
      : `{ ${page} { cursor items { id name ${extraFields}
             column_values { id text value ... on BoardRelationValue { linked_item_ids } } } } } }`;

    const data = await gql(query);
    const pageData = cursor ? data.next_items_page : data.boards[0].items_page;
    out.push(...pageData.items);
    cursor = pageData.cursor;
  } while (cursor);

  return out;
}
