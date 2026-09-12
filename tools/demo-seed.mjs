/* ============================================================
   זריעת מצב ההדגמה — נתוני מכינה מומצאים, בלי monday
   ------------------------------------------------------------
   ⚠⚠ **אין כאן שום נתון אמיתי.** שמות, תעודות זהות, טלפונים
     ומיילים מומצאים לחלוטין. תעודות הזהות אינן עוברות ביקורת
     ספרת ביקורת ואינן שייכות לאיש. זה 4יג מהכיוון ההפוך:
     קובץ משרד החינוך לא נכנס למערכת, וגם לא לזריעת הדגמה.

   ⚠ **כותב ל-.demo/data.json בלבד** — קובץ ב-.gitignore.
     אינו נוגע ב-monday, אינו קורא טוקן, ואינו דורש רשת.

   ⚠ **אידמפוטנטי בכוח**: הוא דורס את הקובץ. "לאפס את
     ההדגמה" הוא פשוט להריץ שוב — וזו התכונה שהופכת אותו
     לשימושי כשמשחקים עם המסכים ושוברים משהו.

   הרצה:  npm run demo:seed        (או אוטומטית מ-npm run demo)
   ============================================================ */

import { writeSeed, DEMO_FILE } from "../api/_demo-store.js";
import { hashPassword } from "../api/_credentials.js";

import { AUTH_BOARD, AUTH_COLS, KIND, STAFF_ROLE } from "../shared/auth-board.js";
import { CRED_COLS } from "../shared/cred-ids.js";
import {
  MECHINA_BOARDS as MB, MECHINA_COLS as MC,
  DAY_KIND, ABSENCE, ABSENCE_SOURCE, REQ_STATUS,
} from "../shared/mechina-boards.js";
import {
  LESSON_BOARDS as LB, LESSON_COLS as LC, PLANNED, HAPPENED, ROLES_COL,
  ROLE_KITCHEN, ROLE_CONTAINER, ROLE_SAFETY, ROLE_HOUSE, ROLE_SCHEDULE,
} from "../shared/lessons-boards.js";
import { KITCHEN_BOARDS as KB, KITCHEN_COLS as KC } from "../shared/kitchen-ids.js";
import { KITCHEN_AREA, KITCHEN_KIND, KITCHEN_SHOP_STATUS } from "../shared/kitchen-boards.js";
import { PLACEMENT_BOARDS as PB, PLACEMENT_COLS as PC } from "../shared/placements-ids.js";
import { CATEGORY, PERIOD, SEM } from "../shared/placements.js";

/* ---------- עזרי תאריך ---------- */
const DAY = 86400000;
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const today = new Date(iso(Date.now()));
const back = (n) => iso(today.getTime() - n * DAY);
const fwd = (n) => iso(today.getTime() + n * DAY);
const dow = (s) => new Date(s + "T00:00:00Z").getUTCDay();
/* ⚠ **היום תמיד יום לימודים**, גם כשהוא שבת. הדגמה
   שנפתחת על יום שאינו בלוח השנה מציגה מסך ריק ונראית
   שבורה, בעוד שהיא נכונה לגמרי. */
const isSchoolDay = (s) => s === iso(today) || (dow(s) !== 5 && dow(s) !== 6);

/* ---------- בניית המחסן ---------- */
let seq = 900000000;
const id = () => String(++seq);
const boards = {};
const B = (boardId, name) => (boards[String(boardId)] =
  boards[String(boardId)] || { id: String(boardId), name, columns: [], items: [] });
const row = (b, name, cols = {}) => {
  const it = { id: id(), name, cols: {} };
  for (const [c, v] of Object.entries(cols)) {
    if (v === undefined || v === null || v === "") continue;
    /* ⚠⚠ **עמודת קישור אינה טקסט.** הקוד קורא אותה דרך
       `linked_item_ids` (api/_requests.js, _attendance-data.js,
       _lessons-data.js, _leader-weeks.js) ולא דרך `text`.
       זריעה כמחרוזת מייצרת שורות שאף מסך לא יציג —
       בקשה בלי חניך, מפגש בלי גיליון — ובלי שום שגיאה. */
    it.cols[c] = (v && typeof v === "object")
      ? { text: (v.item_ids || []).join(", "), value: v }
      : { text: String(v), value: String(v) };
  }
  b.items.push(it);
  return it;
};

/** ערך של עמודת קישור */
const rel = (...ids) => ({ item_ids: ids.flat().filter(Boolean).map(String) });

/* ============================================================
   1. המשתמשים
   ⚠ הסיסמאות כאן ידועות ויושבות בקוד — וזה מקובל **רק כאן**:
     אלה אינם אנשים, אין להם נתונים, והקובץ אינו נוגע בלוח
     אמיתי. סיסמה ידועה על שורה של אדם היא פרצה (4לד).
   ============================================================ */
export const DEMO_USERS = [
  { user: "menahel", pass: "demo1234", label: "ראש המכינה — רואה הכול" },
  { user: "madrich", pass: "demo1234", label: "מדריך — ממליץ על בקשות" },
  { user: "chanich", pass: "demo1234", label: "חניך — נושא חמישה תפקידים" },
];

const NAMES = [
  "אורי בן־חיים", "יונתן שגב", "איתי מזרחי", "נועם אלקיים", "רועי שטרן",
  "אלון פרץ", "יהב דוד", "עידו רוזן", "שחר אביטל", "תומר גל",
  "אריאל נחום", "מתן כהן", "גיא לוי", "דניאל אשכנזי", "עומר סלע",
];

const auth = B(AUTH_BOARD, "משתמשים והרשאות");
const roster = B(MB.roster, "מצבת חניכים");

const headHash = await hashPassword("demo1234");

row(auth, "דני — ראש מכינה", {
  [AUTH_COLS.kind]: KIND.manager,
  [AUTH_COLS.code]: "11112222",
  [AUTH_COLS.active]: "v",
  [AUTH_COLS.role]: STAFF_ROLE.head,
  [CRED_COLS.staff.user]: "menahel",
  [CRED_COLS.staff.pass]: headHash,
  [CRED_COLS.staff.email]: "menahel@demo.local",
});

row(auth, "נעם — מדריך", {
  [AUTH_COLS.kind]: KIND.manager,
  [AUTH_COLS.code]: "33334444",
  [AUTH_COLS.active]: "v",
  [AUTH_COLS.role]: STAFF_ROLE.guide,
  [CRED_COLS.staff.user]: "madrich",
  [CRED_COLS.staff.pass]: headHash,
  [CRED_COLS.staff.email]: "madrich@demo.local",
});

/* ============================================================
   2. החניכים
   ⚠ הראשון נושא שם משתמש וסיסמה **וחמישה תפקידים** — כדי
     שמסך בעל התפקיד ייראה מלא, וכדי שאפשר יהיה לבדוק את
     4יט (מסך של בעל תפקיד זהה למסך של המנהל) בלי להגדיר דבר.
   ============================================================ */
const students = [];
for (let i = 0; i < NAMES.length; i++) {
  const cred = i === 0
    ? {
      [CRED_COLS.student.user]: "chanich",
      [CRED_COLS.student.pass]: headHash,
      [CRED_COLS.student.email]: "chanich@demo.local",
    }
    : {};
  const roles = i === 0
    ? [ROLE_KITCHEN, ROLE_CONTAINER, ROLE_SAFETY, ROLE_HOUSE, ROLE_SCHEDULE].join(", ")
    : "";
  students.push(row(roster, NAMES[i], {
    [MC.roster.tz]: String(300000000 + i * 137),
    [MC.roster.active]: "v",
    [MC.roster.gender]: "זכר",
    [MC.roster.dob]: `200${5 + (i % 3)}-0${1 + (i % 9)}-1${i % 9}`,
    [MC.roster.phone]: `05${2 + (i % 6)}-555-${1000 + i}`,
    [MC.roster.city]: ["ניר עוז", "באר שבע", "תל אביב", "חיפה"][i % 4],
    [MC.roster.shirt]: ["S", "M", "L", "XL"][i % 4],
    [ROLES_COL]: roles,
    ...cred,
  }));
}
const sid = (i) => students[i].id;

/* ============================================================
   3. לוח השנה והנוכחות
   ⚠ 60 יום אחורה, בלי שישי ושבת — כדי שאחוז הנוכחות יעבור
     את סף ארבעת/חמשת הימים (4ג) ויוצג באמת.
   ============================================================ */
const cal = B(MB.calendar, "לוח שנה");
const marked = B(MB.marked, "ימי סימון");
const schoolDays = [];
for (let d = 60; d >= 0; d--) {
  const date = back(d);
  if (!isSchoolDay(date)) continue;
  schoolDays.push(date);
  row(cal, date, { [MC.calendar.date]: date, [MC.calendar.kind]: DAY_KIND.regular });
}
/* כמה ימים קדימה, כדי שיהיה מה לתכנן */
for (let d = 1; d <= 20; d++) {
  const date = fwd(d);
  if (!isSchoolDay(date)) continue;
  row(cal, date, { [MC.calendar.date]: date, [MC.calendar.kind]: DAY_KIND.regular });
}

for (const date of schoolDays) {
  /* ⚠ רשימת הנוכחים היא טקסט של מזהים מופרדים בפסיק —
     בדיוק כמו בלוח האמיתי. שניים-שלושה חסרים בכל יום. */
  const miss = (Number(date.slice(8)) % 4);
  const present = students.slice(miss).map((s) => s.id).join(",");
  row(marked, date, {
    [MC.marked.date]: date,
    [MC.marked.by]: "דני — ראש מכינה",
    [MC.marked.present]: present,
    [MC.marked.presentCount]: String(students.length - miss),
  });
}

/* ---------- היעדרויות ---------- */
const abs = B(MB.absence, "היעדרויות");
const absSpec = [
  [1, back(20), ABSENCE.vacation, ABSENCE_SOURCE.request, "חתונה של אחות"],
  [1, back(19), ABSENCE.vacation, ABSENCE_SOURCE.request, "חתונה של אחות"],
  [2, back(12), ABSENCE.sick, ABSENCE_SOURCE.manual, "שפעת"],
  [3, back(8), ABSENCE.justified, ABSENCE_SOURCE.request, "יום מיונים"],
  [4, back(5), ABSENCE.vacation, ABSENCE_SOURCE.request, ""],
];
for (const [i, date, type, source, detail] of absSpec) {
  row(abs, `${NAMES[i]} · ${date}`, {
    [MC.absence.student]: rel(sid(i)), [MC.absence.date]: date,
    [MC.absence.type]: type, [MC.absence.source]: source,
    [MC.absence.detail]: detail, [MC.absence.cost]: "1",
  });
}

/* ============================================================
   4. בקשות יציאה — אחת בכל שלב
   ⚠ השלב **נגזר** מהנתונים ואינו נשמר (4א). לכן די בכך
     שלאחת אין המלצת מדריך ולשנייה יש.
   ============================================================ */
const req = B(MB.requests, "בקשות יציאה");
row(req, `${NAMES[5]} · חופש`, {
  [MC.requests.student]: rel(sid(5)), [MC.requests.type]: ABSENCE.vacation,
  [MC.requests.date]: fwd(6), [MC.requests.endDate]: fwd(7),
  [MC.requests.outAt]: "16:00", [MC.requests.backAt]: "08:00",
  [MC.requests.status]: REQ_STATUS.pending,
});
row(req, `${NAMES[6]} · מחלה`, {
  [MC.requests.student]: rel(sid(6)), [MC.requests.type]: ABSENCE.sick,
  [MC.requests.date]: fwd(2), [MC.requests.endDate]: fwd(2),
  [MC.requests.outAt]: "07:00", [MC.requests.backAt]: "20:00",
  [MC.requests.detail]: "תור לרופא, נקבע מראש",
  [MC.requests.status]: REQ_STATUS.pending,
  [MC.requests.guide]: REQ_STATUS.approved,
  [MC.requests.guideBy]: "נעם — מדריך", [MC.requests.guideAt]: back(1),
});
row(req, `${NAMES[7]} · מוצדקת`, {
  [MC.requests.student]: rel(sid(7)), [MC.requests.type]: ABSENCE.justified,
  [MC.requests.date]: back(8), [MC.requests.endDate]: back(8),
  [MC.requests.outAt]: "06:30", [MC.requests.backAt]: "19:00",
  [MC.requests.detail]: "יום מיונים ליחידה",
  [MC.requests.status]: REQ_STATUS.approved,
  [MC.requests.by]: "דני — ראש מכינה", [MC.requests.decided]: back(10),
  [MC.requests.guide]: REQ_STATUS.approved, [MC.requests.guideBy]: "נעם — מדריך",
});

/* ---------- מובילי שבוע ---------- */
const weeks = B(MB.leaderWeeks, "מובילי שבוע");
for (let w = -2; w <= 2; w++) {
  const base = new Date(today.getTime() + w * 7 * DAY);
  const sun = new Date(base.getTime() - base.getUTCDay() * DAY);
  row(weeks, `שבוע ${w + 3}`, {
    [MC.leaderWeeks.start]: iso(sun),
    [MC.leaderWeeks.end]: iso(sun.getTime() + 6 * DAY),
    [MC.leaderWeeks.num]: String(w + 3),
    [MC.leaderWeeks.what]: ["גיבוש", "אחריות", "נתינה", "מנהיגות", "סיכום"][w + 2],
    [MC.leaderWeeks.leaders]: rel(sid((w + 2) * 2), sid((w + 2) * 2 + 1)),
    [MC.leaderWeeks.open]: "v",
  });
}

/* ============================================================
   5. הלו״ז — גיליונות ומפגשים
   ============================================================ */
const gantt = B(LB.gantt, "גאנט שנתי");
row(gantt, "סמינר פתיחה", { [LC.gantt.start]: back(55), [LC.gantt.end]: back(52), [LC.gantt.type]: "סמינר" });
row(gantt, "סופ״ש בית", { [LC.gantt.start]: back(14), [LC.gantt.end]: back(12), [LC.gantt.type]: "בית" });
row(gantt, "סדרת מדבר", { [LC.gantt.start]: fwd(10), [LC.gantt.end]: fwd(14), [LC.gantt.type]: "סדרה" });

const sheets = B(LB.sheets, "גיליונות מרצים");
const SHEETS = [
  ["מחשבת ישראל", "הרב אבי שטרן", "שני 10:00", 450],
  ["ציונות ותולדות הארץ", "ד״ר מיכל ברנע", "שלישי 11:30", 500],
  ["מנהיגות", "יואב הראל", "רביעי 20:00", 400],
  ["אימונים", "רן ביטון", "ראשון 7:00", 0],
  ["כושר קרבי", "רן ביטון", "חמישי 7:00", 0],
  ["סדנת מרצים מתחלפים", "", "שני 21:00", 0],
];
const sheetRows = SHEETS.map(([subject, lecturer, dayTime, price], i) =>
  row(sheets, subject, {
    [LC.sheets.lecturer]: lecturer,
    [LC.sheets.dayTime]: dayTime,
    [LC.sheets.active]: "v",
    [LC.sheets.price]: price ? String(price) : "",
    [LC.sheets.guestLecturer]: i === 5 ? "v" : "",
  }));

const meetings = B(LB.meetings, "מפגשי שיעורים");
for (let i = 0; i < sheetRows.length; i++) {
  const sh = sheetRows[i];
  /* ⚠ שלושה מצבים ולא שניים: התקיים · לא התקיים · **טרם דווח**
     (4ח). בלי השלישי מסך "טרם דווחו" ריק וחצי מהתכלית נעלמת. */
  for (let n = 0; n < 8; n++) {
    const date = schoolDays[schoolDays.length - 1 - n * 5 - i];
    if (!date) continue;
    const past = n > 1;
    row(meetings, `${SHEETS[i][0]} · ${date}`, {
      [LC.meetings.sheet]: rel(sh.id),
      [LC.meetings.date]: date,
      [LC.meetings.planned]: PLANNED.yes,
      [LC.meetings.happened]: past ? HAPPENED.yes : "",
      [LC.meetings.lecturer]: SHEETS[i][1],
      [LC.meetings.summary]: past && n === 2 ? "נדון מקומו של היחיד מול הכלל." : "",
    });
  }
}

/* ============================================================
   6. המטבח
   ============================================================ */
const equip = B(KB.equipment, "מטבח – ציוד");
const ITEMS = [
  ["אורז", "12 ק״ג", KITCHEN_AREA.food, KITCHEN_KIND.consumable, 20, 6],
  ["פסטה", "8 חבילות של 500 גרם", KITCHEN_AREA.food, KITCHEN_KIND.consumable, 15, 5],
  ["רסק עגבניות", "4 קופסאות", KITCHEN_AREA.food, KITCHEN_KIND.consumable, 10, 4],
  ["שמן קנולה", "3 בקבוקים", KITCHEN_AREA.food, KITCHEN_KIND.consumable, 6, 12],
  ["קמח", "9 ק״ג", KITCHEN_AREA.food, KITCHEN_KIND.consumable, 12, 4],
  ["סוכר", "5 ק״ג", KITCHEN_AREA.food, KITCHEN_KIND.consumable, 8, 5],
  ["עגבניות", "6 ק״ג", KITCHEN_AREA.food, KITCHEN_KIND.consumable, 10, 7],
  ["מלפפונים", "4 ק״ג", KITCHEN_AREA.food, KITCHEN_KIND.consumable, 8, 6],
  ["צלחות חד״פ", "120 יחידות", KITCHEN_AREA.disposable, KITCHEN_KIND.consumable, 200, 0.4],
  ["כוסות חד״פ", "300 יחידות", KITCHEN_AREA.disposable, KITCHEN_KIND.consumable, 400, 0.2],
  ["סכו״ם חד״פ", "80 סטים", KITCHEN_AREA.disposable, KITCHEN_KIND.consumable, 250, 0.5],
  ["שקיות אשפה", "2 גלילים", KITCHEN_AREA.disposable, KITCHEN_KIND.consumable, 6, 14],
  ["סיר גדול", "2", KITCHEN_AREA.food, KITCHEN_KIND.permanent, 2, ""],
  ["מחבת", "3", KITCHEN_AREA.food, KITCHEN_KIND.permanent, 3, ""],
];
for (const [name, qty, area, kind, par, price] of ITEMS) {
  row(equip, name, {
    [KC.equipment.qty]: qty, [KC.equipment.area]: area, [KC.equipment.kind]: kind,
    [KC.equipment.par]: String(par), [KC.equipment.price]: price === "" ? "" : String(price),
  });
}

const shop = B(KB.shopping, "מטבח – קניות");
for (const [name, qty] of [["אורז", "8 ק״ג"], ["עגבניות", "4 ק״ג"], ["שקיות אשפה", "4 גלילים"]]) {
  row(shop, name, {
    [KC.shopping.qty]: qty,
    [KC.shopping.status]: KITCHEN_SHOP_STATUS.open,
    [KC.shopping.area]: KITCHEN_AREA.food,
  });
}

/* ============================================================
   7. שיבוצים — ענפים, ועדות, קבוצות
   ⚠ לכל חניך קבוצה, כי בלי קבוצה בקשת היציאה מדלגת על
     המדריך ומגיעה ישר לראש המכינה (4א) — וזה בדיוק המסלול
     שכדאי שייראה עובד בהדגמה.
   ============================================================ */
const defs = B(PB.definitions, "שיבוצים – הגדרות");
const asg = B(PB.assignments, "שיבוצים – שיבוץ");

const groupNoam = row(defs, "קבוצת נעם", {
  [PC.definitions.category]: CATEGORY.group, [PC.definitions.period]: PERIOD.yearly,
  [PC.definitions.lead]: "נעם", [PC.definitions.capacity]: "20",
});
const defList = [
  ["ועדת קבוצה ותוכן", CATEGORY.committee, { [PC.definitions.content]: "v" }],
  ["ועדת ידיעת הארץ והכנה לצבא", CATEGORY.committee, { [PC.definitions.army]: "v" }],
  ["ענף מטבח", CATEGORY.branch, {}],
  ["ענף מכולה", CATEGORY.branch, {}],
  ["סדרת מדבר", CATEGORY.series, {}],
];
const defRows = { "קבוצת נעם": groupNoam };
for (const [name, category, extra] of defList) {
  defRows[name] = row(defs, name, {
    [PC.definitions.category]: category,
    [PC.definitions.period]: PERIOD.yearly,
    [PC.definitions.capacity]: "12",
    ...extra,
  });
}

const place = (st, defName, sem = SEM.yearly) =>
  row(asg, `${st.name} · ${defName}`, {
    [PC.assignments.student]: st.id, [PC.assignments.studentName]: st.name,
    [PC.assignments.placement]: defRows[defName].id,
    [PC.assignments.placementName]: defName,
    [PC.assignments.semester]: sem,
  });

for (const st of students) place(st, "קבוצת נעם");
students.slice(0, 5).forEach((st) => place(st, "ועדת קבוצה ותוכן"));
students.slice(5, 9).forEach((st) => place(st, "ועדת ידיעת הארץ והכנה לצבא"));
students.slice(0, 6).forEach((st) => place(st, "ענף מטבח"));
students.slice(6, 12).forEach((st) => place(st, "ענף מכולה"));

/* ---------- כתיבה ---------- */
writeSeed({ boards, seq });

console.log("✓ מצב ההדגמה נזרע");
console.log("  קובץ  : " + DEMO_FILE);
console.log("  לוחות : " + Object.keys(boards).length);
console.log("  שורות : " + Object.values(boards).reduce((n, b) => n + b.items.length, 0));
console.log("");
console.log("  כניסה :");
for (const u of DEMO_USERS) {
  console.log(`    ${u.user.padEnd(9)} / ${u.pass}   ${u.label}`);
}
