/* ============================================================
   ЯШАБОКС, бот — память между сообщениями (база D1 в Cloudflare).

   Почему база, а не «записная книжка» KV: альбом из трёх фото
   Telegram присылает тремя отдельными сообщениями почти в одну
   секунду, и они обрабатываются одновременно. KV в таком случае
   оставляет последнюю запись и теряет остальные. В D1 каждое фото —
   своя строка, а «кто первый, тот и отвечает» решается одним
   UPDATE … WHERE handled = 0: его выигрывает ровно один.

   Бесплатного лимита D1 (5 млн чтений и 100 тыс. записей в день)
   хватает на тысячи изделий в день.
   ============================================================ */

const SCHEMA = [
  // update_id от Telegram: он повторяет сообщение, если мы не успели
  // ответить, — без этой таблицы изделие публиковалось бы дважды.
  `CREATE TABLE IF NOT EXISTS updates (id INTEGER PRIMARY KEY, ts INTEGER)`,
  `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, status TEXT)`,
  // Фото, которые пришли и ещё не стали карточкой.
  `CREATE TABLE IF NOT EXISTS photos (chat INTEGER, msg INTEGER, grp TEXT, file_id TEXT, caption TEXT, ts INTEGER, PRIMARY KEY (chat, msg))`,
  // Альбом целиком: обычные новые фото или замена фото у изделия.
  `CREATE TABLE IF NOT EXISTS groups (grp TEXT PRIMARY KEY, chat INTEGER, type TEXT, target TEXT, handled INTEGER DEFAULT 0, ts INTEGER)`,
  // Одна неопубликованная карточка на чат. ver растёт с каждой
  // правкой: кнопка со старой карточки не опубликует новую.
  `CREATE TABLE IF NOT EXISTS drafts (chat INTEGER PRIMARY KEY, ver INTEGER, state TEXT, asked INTEGER DEFAULT 0, card INTEGER, data TEXT)`,
  // Сообщение «Опубликовано» → какое изделие. По нему работает
  // «ответь на сообщение, чтобы поменять».
  `CREATE TABLE IF NOT EXISTS published (chat INTEGER, msg INTEGER, section TEXT, photo TEXT, PRIMARY KEY (chat, msg))`,
  // Что сказал Саша и что понял Claude. Нужно, чтобы сравнить модели
  // на настоящих фразах и разбирать ошибки.
  // «Последнее изделие, о котором шла речь»: следующее голосовое без
  // ответа на сообщение относится к нему. pending — правка, которая
  // ждёт, пока Саша выберет одно изделие из нескольких найденных.
  `CREATE TABLE IF NOT EXISTS focus (chat INTEGER PRIMARY KEY, section TEXT, photo TEXT, pending TEXT, ts INTEGER)`,
  // Пост в канале про изделие на сайте: по нему пост исправляется
  // при правке и помечается «продано», когда изделие убирают.
  `CREATE TABLE IF NOT EXISTS channel (photo TEXT PRIMARY KEY, msg INTEGER, ts INTEGER)`,
  `CREATE TABLE IF NOT EXISTS journal (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, chat INTEGER, mode TEXT, text TEXT, model TEXT, result TEXT)`
];

/* Фото без голосового дольше этого срока забываются: иначе вчерашние
   снимки прицепились бы к сегодняшнему голосовому. */
const PHOTO_TTL = 3 * 60 * 60 * 1000;

/* Сколько бот помнит, о каком изделии шла речь. Дольше — опасно:
   через час «цену поставь пять тысяч» скорее про новое изделие. */
const FOCUS_TTL = 30 * 60 * 1000;

let ready = false;

export function makeStore(db) {
  const now = () => Date.now();
  const q = (sql, ...args) => db.prepare(sql).bind(...args);

  async function init() {
    if (ready) return;
    await db.batch(SCHEMA.map(s => db.prepare(s)));
    ready = true;
  }

  return {
    init,

    async claimUpdate(id) {
      await init();
      const r = await q(`INSERT OR IGNORE INTO updates (id, ts) VALUES (?, ?)`, id, now()).run();
      if (id % 50 === 0) await this.cleanup();
      return r.meta.changes === 1;
    },

    async cleanup() {
      const day = now() - 24 * 60 * 60 * 1000;
      await db.batch([
        q(`DELETE FROM updates WHERE ts < ?`, day),
        q(`DELETE FROM photos WHERE ts < ?`, now() - PHOTO_TTL),
        q(`DELETE FROM groups WHERE ts < ?`, day)
      ]);
    },

    getUser: id => q(`SELECT * FROM users WHERE id = ?`, id).first(),

    async addPendingUser(id, name) {
      const r = await q(`INSERT OR IGNORE INTO users (id, name, status) VALUES (?, ?, 'pending')`, id, name).run();
      return r.meta.changes === 1;
    },

    setUserStatus: (id, status) => q(`UPDATE users SET status = ? WHERE id = ?`, status, id).run(),

    addPhoto: p => q(`INSERT OR IGNORE INTO photos (chat, msg, grp, file_id, caption, ts) VALUES (?, ?, ?, ?, ?, ?)`,
      p.chat, p.msg, p.grp, p.fileId, p.caption || null, now()).run(),

    /* Ответ фотографией на «Опубликовано» помечает альбом как замену
       фото — сразу, ещё до паузы, поэтому побеждает «обычный» тип. */
    markGroupReplace: (grp, chat, target) => q(
      `INSERT INTO groups (grp, chat, type, target, handled, ts) VALUES (?, ?, 'replace', ?, 0, ?)
       ON CONFLICT (grp) DO UPDATE SET type = 'replace', target = excluded.target`,
      grp, chat, JSON.stringify(target), now()).run(),

    /* Ровно один обработчик из всех сообщений альбома получает true
       и отвечает Саше. Остальные молча выходят. */
    async takeGroup(grp, chat) {
      await q(`INSERT OR IGNORE INTO groups (grp, chat, type, target, handled, ts) VALUES (?, ?, 'new', NULL, 0, ?)`, grp, chat, now()).run();
      const r = await q(`UPDATE groups SET handled = 1 WHERE grp = ? AND handled = 0`, grp).run();
      if (r.meta.changes !== 1) return null;
      const row = await q(`SELECT * FROM groups WHERE grp = ?`, grp).first();
      return { type: row.type, target: row.target ? JSON.parse(row.target) : null };
    },

    groupPhotos: async grp => (await q(`SELECT * FROM photos WHERE grp = ? ORDER BY msg`, grp).all()).results,

    /* Фото, которые ждут голосового: всё, кроме альбомов-замен. */
    freePhotos: async chat => (await q(
      `SELECT p.* FROM photos p LEFT JOIN groups g ON g.grp = p.grp
       WHERE p.chat = ? AND p.ts > ? AND (g.type IS NULL OR g.type = 'new') ORDER BY p.msg`,
      chat, now() - PHOTO_TTL).all()).results,

    deletePhotos: async (chat, msgs) => {
      if (!msgs.length) return;
      await db.batch(msgs.map(m => q(`DELETE FROM photos WHERE chat = ? AND msg = ?`, chat, m)));
    },

    async getDraft(chat) {
      const row = await q(`SELECT * FROM drafts WHERE chat = ?`, chat).first();
      return row ? { ...row, data: JSON.parse(row.data) } : null;
    },

    /* Новая или исправленная карточка. Возвращает её номер версии. */
    async saveDraft(chat, data) {
      const row = await q(
        `INSERT INTO drafts (chat, ver, state, asked, card, data) VALUES (?, 1, 'card', 0, NULL, ?)
         ON CONFLICT (chat) DO UPDATE SET ver = ver + 1, state = 'card', asked = 0, card = NULL, data = excluded.data
         RETURNING ver`, chat, JSON.stringify(data)).first();
      return row.ver;
    },

    setDraftCard: (chat, ver, card) => q(`UPDATE drafts SET card = ? WHERE chat = ? AND ver = ?`, card, chat, ver).run(),

    /* Защита от двойного нажатия: опубликовать может только тот,
       кто первым перевёл карточку в «busy». */
    async claimDraft(chat, ver) {
      const r = await q(`UPDATE drafts SET state = 'busy' WHERE chat = ? AND ver = ? AND state = 'card'`, chat, ver).run();
      return r.meta.changes === 1;
    },

    setDraftNext: (chat, ver, text) => q(
      `UPDATE drafts SET data = json_set(data, '$.next', ?) WHERE chat = ? AND ver = ?`, text, chat, ver).run(),

    releaseDraft: chat => q(`UPDATE drafts SET state = 'card' WHERE chat = ?`, chat).run(),

    async markAsked(chat) {
      const r = await q(`UPDATE drafts SET asked = 1 WHERE chat = ? AND asked = 0`, chat).run();
      return r.meta.changes === 1;
    },

    deleteDraft: chat => q(`DELETE FROM drafts WHERE chat = ?`, chat).run(),

    addPublished: (chat, msg, section, photo) => q(
      `INSERT OR REPLACE INTO published (chat, msg, section, photo) VALUES (?, ?, ?, ?)`, chat, msg, section, photo).run(),

    getPublished: (chat, msg) => q(`SELECT * FROM published WHERE chat = ? AND msg = ?`, chat, msg).first(),

    /* Изделие сменило раздел или первое фото — все старые сообщения
       «Опубликовано» про него должны вести туда же. */
    retargetPublished: (oldPhoto, section, newPhoto) => db.batch([
      q(`UPDATE published SET section = ?, photo = ? WHERE photo = ?`, section, newPhoto, oldPhoto),
      q(`UPDATE focus SET section = ?, photo = ? WHERE photo = ?`, section, newPhoto, oldPhoto),
      q(`UPDATE channel SET photo = ? WHERE photo = ?`, newPhoto, oldPhoto)
    ]),

    forgetPublished: photo => db.batch([
      q(`DELETE FROM published WHERE photo = ?`, photo),
      q(`DELETE FROM focus WHERE photo = ?`, photo)
    ]),

    addChannelPost: (photo, msg) => q(`INSERT OR REPLACE INTO channel (photo, msg, ts) VALUES (?, ?, ?)`, photo, msg, now()).run(),
    getChannelPost: photo => q(`SELECT * FROM channel WHERE photo = ?`, photo).first(),
    allChannelPosts: async () => (await q(`SELECT * FROM channel ORDER BY ts`).all()).results,
    forgetChannelPost: photo => q(`DELETE FROM channel WHERE photo = ?`, photo).run(),

    setFocus: (chat, section, photo, pending = null) => q(
      `INSERT OR REPLACE INTO focus (chat, section, photo, pending, ts) VALUES (?, ?, ?, ?, ?)`,
      chat, section, photo, pending ? JSON.stringify(pending) : null, now()).run(),

    async getFocus(chat) {
      const row = await q(`SELECT * FROM focus WHERE chat = ? AND ts > ?`, chat, now() - FOCUS_TTL).first();
      return row ? { section: row.section, photo: row.photo, pending: row.pending ? JSON.parse(row.pending) : null } : null;
    },

    clearFocus: chat => q(`DELETE FROM focus WHERE chat = ?`, chat).run(),

    recentLog: async n => (await q(`SELECT * FROM journal ORDER BY id DESC LIMIT ?`, n).all()).results,

    log: e => q(`INSERT INTO journal (ts, chat, mode, text, model, result) VALUES (?, ?, ?, ?, ?, ?)`,
      now(), e.chat, e.mode, e.text, e.model, JSON.stringify(e.result)).run()
  };
}
