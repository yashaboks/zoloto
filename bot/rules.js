/* ============================================================
   ЯШАБОКС, бот — правила каталога.

   Здесь только то, что не зависит ни от Telegram, ни от GitHub:
   какие бывают разделы и пробы, как проверить поля, как выглядит
   карточка и как вставить изделие в файл каталога. Поэтому этот
   файл можно проверять отдельно, без сети.

   ⚠️  МЕНЯЕТЕ admin/config.yml (разделы, поля) — ЗАГЛЯНИТЕ СЮДА.
   Бот пишет в те же файлы, что и панель, и должен писать их так же.
   ============================================================ */

/* Разделы каталога. Ключ — имя файла в assets/data/catalog/.
   uk — подпись на сайте, one — как назвать изделие, если Claude не
   придумал названия, maxWeight — сколько граммов уже подозрительно
   (не запрет, а повод переспросить), size — у колец это размер,
   а не длина. */
export const SECTIONS = {
  rings:     { uk: 'Каблучки',  one: 'Каблучка',  maxWeight: 30,   size: true },
  pendants:  { uk: 'Підвіски',  one: 'Підвіска',  maxWeight: 50 },
  chains:    { uk: 'Ланцюжки',  one: 'Ланцюжок',  maxWeight: 250 },
  bracelets: { uk: 'Браслети',  one: 'Браслет',   maxWeight: 250 },
  earrings:  { uk: 'Сережки',   one: 'Сережки',   maxWeight: 30 },
  watches:   { uk: 'Годинники', one: 'Годинник',  maxWeight: 300 },
  coins:     { uk: 'Монети',    one: 'Монета',    maxWeight: 1100 },
  other:     { uk: 'Інше',      one: 'Виріб',     maxWeight: 5000 }
};

/* Пробы, которые реально встречаются: золото (в т. ч. советская 583
   и 9999 у слитков и монет), серебро, платина. Всё, чего тут нет, —
   почти наверняка ослышка: «пятьсот восемьдесят» вместо 585. */
export const PROBAS = [
  333, 375, 500, 583, 585, 750, 800, 830, 850, 875,
  900, 916, 925, 950, 958, 960, 999, 9999
];

/* Ответ Claude — это предложение, а не данные. Всё приводим к тому
   виду, в каком панель хранит каталог, и выбрасываем то, что не
   похоже на правду: в файл сайта попадает только проверенное. */
export function normalize(raw) {
  raw = raw || {};
  const section = SECTIONS[raw.section] ? raw.section : null;

  let proba = Number.parseInt(raw.proba, 10);
  if (!(proba > 0)) proba = null;

  // Вес хранится строкой с точкой ("23.32") — так его пишет панель.
  let weight = null;
  if (raw.weight != null) {
    const w = String(raw.weight).replace(',', '.').replace(/[^\d.]/g, '');
    if (Number.parseFloat(w) > 0) weight = String(Number.parseFloat(w));
  }

  let length = '';
  if (raw.length != null) {
    length = String(raw.length).replace(',', '.').replace(/\s*(см|cm|мм)\.?\s*$/i, '').trim();
  }

  let price = raw.price == null ? null : Math.round(Number(String(raw.price).replace(/[^\d.]/g, '')));
  if (!(price > 0)) price = null;

  let name = (raw.name_uk || '').trim();
  if (!name && section) name = SECTIONS[section].one;

  return { section, name_uk: name, proba, weight, length, price };
}

/* Чего не хватает, чтобы опубликовать, и что подозрительно.
   Не хватает — кнопки «Опубликовать» нет. Подозрительно — кнопка
   есть, но карточка прямо говорит, что проверить. */
export function check(f) {
  const missing = [];
  const warnings = [];
  if (!f.section) missing.push('раздел');
  if (!f.proba) missing.push('проба');
  if (!f.weight) missing.push('вес');

  if (f.proba && !PROBAS.includes(f.proba)) {
    warnings.push(`Проба ${f.proba} — такой почти не бывает. Ослышка?`);
  }
  if (f.weight && f.section) {
    const w = Number.parseFloat(f.weight);
    if (w > SECTIONS[f.section].maxWeight) {
      warnings.push(`Вес ${fmtWeight(f.weight)} г для раздела «${SECTIONS[f.section].uk}» — точно?`);
    }
    if (w < 0.2) warnings.push(`Вес ${fmtWeight(f.weight)} г — очень мало, точно?`);
  }
  if (f.price && f.price < 100) warnings.push(`Цена ${f.price} ₴ — точно?`);
  return { missing, warnings, ok: missing.length === 0 };
}

export function fmtWeight(w) {
  return String(w).replace('.', ',');
}

function fmtPrice(p) {
  return p ? `${String(p).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₴` : 'за домовленістю';
}

function fmtLength(f) {
  if (!f.length) return null;
  if (f.section && SECTIONS[f.section].size) return `Размер: ${esc(f.length)}`;
  if (f.section === 'chains' || f.section === 'bracelets') return `Длина: ${esc(f.length)} см`;
  return `Длина: ${esc(f.length)}`;
}

/* Telegram разбирает подпись как HTML, а текст в неё попадает со
   слов Саши. Без экранирования «<» в названии ломает всю карточку. */
export function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* Строки с полями изделия — общие для всех видов карточек.
   Пары [ключ, строка]: по ключу карточка правки сравнивает «было» и
   «стало», а строки длины может и не быть. */
function fieldRows(f) {
  const rows = [
    ['name', `<b>${esc(f.name_uk || '—')}</b>`],
    ['section', `Раздел: ${f.section ? SECTIONS[f.section].uk : '—'}`],
    ['proba', `Проба: ${f.proba || '—'}`],
    ['weight', `Вес: ${f.weight ? fmtWeight(f.weight) + ' г' : '—'}`]
  ];
  const len = fmtLength(f);
  if (len) rows.push(['length', len]);
  rows.push(['price', `Цена: ${fmtPrice(f.price)}`]);
  return rows;
}

export function fieldLines(f) {
  return fieldRows(f).map(r => r[1]);
}

/* Карточка нового изделия или правки. before — как было на сайте:
   тогда изменённые строки помечаются, чтобы Саша сразу видел, что
   именно бот собирается поменять. */
export function cardText({ title, fields, before, photoCount, note }) {
  const lines = [title, ''];
  if (before) {
    const was = Object.fromEntries(fieldRows(before));
    for (const [k, l] of fieldRows(fields)) {
      if (!was[k]) lines.push(`${l}   <i>(было: пусто)</i>`);
      else if (was[k] !== l) lines.push(`${l}   <i>(было: ${was[k].replace(/^[^:]*: /, '').replace(/<\/?b>/g, '')})</i>`);
      else lines.push(l);
    }
    const now = Object.fromEntries(fieldRows(fields));
    if (was.length && !now.length) lines.push(`${was.length}   <i>(убрано)</i>`);
  } else {
    lines.push(...fieldLines(fields));
  }
  if (photoCount) lines.push(`📷 Фото: ${photoCount}`);

  const c = check(fields);
  if (c.warnings.length) lines.push('', ...c.warnings.map(w => '⚠️ ' + esc(w)));
  if (!c.ok) lines.push('', `❗ Не хватает: ${c.missing.join(', ')}. Скажи голосом или напиши.`);
  if (note) lines.push('', note);
  lines.push('', '<i>Не так? Скажи или напиши, что исправить.</i>');
  return lines.join('\n');
}

/* ---------- Файл каталога ----------

   Формат — ровно как у панели Sveltia: {"items": [...]}, отступ
   2 пробела, кириллица как есть, перевод строки в конце. Иначе
   каждая правка ботом «переписывала» бы весь файл, и в истории
   GitHub не было бы видно, что на самом деле поменялось. */

export function serialize(data) {
  return JSON.stringify(data, null, 2) + '\n';
}

export function parseCatalog(text) {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.items)) data.items = [];
  return data;
}

/* Изделие в каталоге узнаём по первому фото: у изделий нет номера,
   а имя файла фото уникально (бот называет их по времени). */
export function findIndex(data, photo) {
  return data.items.findIndex(it => Array.isArray(it.photos) && it.photos[0] === photo);
}

export class NotFound extends Error {}

export function toItem(f, photos, status = 'available') {
  // Порядок полей — как в панели, чтобы файл не перемешивался.
  return {
    photos,
    name_uk: f.name_uk,
    proba: f.proba,
    weight: f.weight,
    length: f.length || '',
    price: f.price,
    status
  };
}

export function fromItem(item, section) {
  return {
    section,
    name_uk: item.name_uk || '',
    proba: item.proba ?? null,
    weight: item.weight || null,
    length: item.length || '',
    price: item.price ?? null
  };
}

/* Новое изделие — первым в разделе: так же делает панель, и так
   свежий товар покупатель видит сразу. */
export function insertItem(text, item) {
  const data = parseCatalog(text);
  data.items.unshift(item);
  return serialize(data);
}

export function removeItem(text, photo) {
  const data = parseCatalog(text);
  const i = findIndex(data, photo);
  if (i < 0) throw new NotFound(photo);
  const [item] = data.items.splice(i, 1);
  return { text: serialize(data), item };
}

export function replaceItem(text, photo, item) {
  const data = parseCatalog(text);
  const i = findIndex(data, photo);
  if (i < 0) throw new NotFound(photo);
  data.items[i] = item;
  return serialize(data);
}
