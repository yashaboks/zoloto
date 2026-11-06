/* ============================================================
   ЯШАБОКС, бот — посты в Telegram-канал.

   Что опубликовано на сайте, то и в канале: новое изделие — новый
   пост, правка — пост исправляется, продано — пост остаётся, но
   с пометкой «ПРОДАНО». Удалять не стали: бот может удалить свой
   пост в канале только в первые 48 часов, а исправить — всегда.
   К тому же «продано» в ленте показывает, что золото уходит.

   Канал — дополнение к сайту, а не его часть. Поэтому ошибка здесь
   никогда не отменяет записи на сайт: Саше пишем как обычно,
   Артёму — что пост не вышел.

   На тестовой копии сайта посты идут не в канал, а Артёму в личку:
   так тест не засоряет ленту Сашиных подписчиков.
   ============================================================ */

import { SECTIONS, esc, fmtWeight } from './rules.js';

const SETTINGS = 'yashaboks/assets/data/settings.json';

function fmtPrice(p) {
  return p ? `${String(p).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₴` : 'за домовленістю';
}

/* Подпись поста — по-украински, как на сайте. */
export function postText(f, { contacts, sold, testing } = {}) {
  const size = f.length
    ? (SECTIONS[f.section] && SECTIONS[f.section].size ? `розмір ${esc(f.length)}`
      : f.section === 'chains' || f.section === 'bracelets' ? `довжина ${esc(f.length)} см`
      : `довжина ${esc(f.length)}`)
    : null;
  const facts = [f.proba && `Проба ${f.proba}`, f.weight && `${fmtWeight(f.weight)} г`, size].filter(Boolean).join(' · ');
  const lines = [];
  if (testing) lines.push('🧪 <i>Тест: так виглядатиме пост у каналі</i>', '');

  if (sold) {
    // Продано: зачёркнутое название и без цены и контактов —
    // звонить по этому изделию уже незачем.
    lines.push('❌ <b>ПРОДАНО</b>', '', `<s>${esc(f.name_uk)}</s>`, facts);
    return lines.join('\n');
  }

  lines.push(`<b>${esc(f.name_uk)}</b>`, facts, `Ціна: ${fmtPrice(f.price)}`);
  if (contacts) {
    lines.push('');
    // Номер слитно, без пробелов: только такой Telegram сам узнаёт
    // как телефон и даёт по нему позвонить. Ссылку tel: в посте он
    // не пропускает.
    if (contacts.phone) lines.push(`📞 ${esc(contacts.phone)}`);
    const links = [
      contacts.telegram && `<a href="${esc(contacts.telegram)}">Написати</a>`,
      `<a href="${contacts.site}/#catalog">Весь каталог</a>`
    ].filter(Boolean);
    lines.push(links.join(' · '));
  }
  return lines.join('\n');
}

/* Телефон и Telegram берём из настроек сайта, которые Саша правит в
   панели: сменит номер — новые посты пойдут уже с новым. Те же
   контакты бот даёт незнакомцам, которые пишут ему вместо Саши. */
export async function contacts(deps) {
  try {
    const s = JSON.parse(await deps.gh.read(SETTINGS));
    const phone = String(s.phone || s.phoneDisplay || '').replace(/[^\d+]/g, '');
    return { phone, telegram: s.telegram, site: deps.siteUrl };
  } catch {
    return { site: deps.siteUrl };
  }
}

/* Telegram отвечает ошибкой, если подпись не изменилась, или если
   Саша сам удалил пост в канале. И то и другое — не поломка. */
const harmless = e => /not modified/i.test(e.message);
const gone = e => /message to edit not found|message can't be edited|MESSAGE_ID_INVALID/i.test(e.message);

async function tell(deps, what, e) {
  await deps.tg.send(deps.admin, `⚠️ Канал: ${what} — ${esc(String(e && e.message || e))}`).catch(() => {});
}

/* Новое изделие на сайте → пост. fileIds — Telegram-файлы фото, как
   Саша их прислал (1–3, первое — обложка): сколько фото на сайте,
   столько и в посте. key — адрес обложки на сайте, по нему пост
   потом находим. */
export async function post(deps, f, fileIds, key) {
  try {
    const caption = postText(f, { contacts: await contacts(deps), testing: deps.testing });
    const msgs = await deps.tg.sendAlbum(deps.channel, fileIds, caption);
    await deps.store.addChannelPost(key, msgs);
  } catch (e) {
    await tell(deps, `пост «${esc(f.name_uk)}» не вышел`, e);
  }
}

/* Замена фото в посте. Число фото в альбоме Telegram менять не даёт:
   можно только подменить каждое по отдельности. Поэтому:
   — фото столько же, сколько было, — подменяем по одному;
   — иначе выкладываем пост заново, а старый удаляем. Удалить бот
     может только свой пост младше 48 часов, но фото обычно меняют
     сразу, заметив неудачный снимок;
   — пост старше — подменяем, сколько влезает, и говорим Артёму, что
     осталось поправить руками. Саша этого не видит: на сайте фото
     уже правильные. */
async function replacePhotos(deps, f, key, row, fileIds, caption) {
  const media = (id, i) => i ? { type: 'photo', media: id } : { type: 'photo', media: id, caption, parse_mode: 'HTML' };
  const swap = n => Promise.all(fileIds.slice(0, n).map((id, i) =>
    deps.tg.call('editMessageMedia', { chat_id: deps.channel, message_id: row.msgs[i], media: media(id, i) })
      .catch(e => { if (!harmless(e)) throw e; })));

  if (fileIds.length === row.msgs.length) return swap(fileIds.length);

  // Сначала одно первое сообщение: на нём видно, можно ли ещё
  // удалять. Удалилось — остальные того же возраста, удалятся тоже.
  // Пачкой сразу не проверить: она пропускает то, чего не нашла,
  // и по ответу не понять, удалила ли что-нибудь.
  let deleted = false;
  try {
    await deps.tg.call('deleteMessage', { chat_id: deps.channel, message_id: row.msg });
    deleted = true;
  } catch { /* старше 48 часов — ниже подменим, что можно */ }
  if (deleted) {
    if (row.msgs.length > 1) {
      await deps.tg.call('deleteMessages', { chat_id: deps.channel, message_ids: row.msgs.slice(1) })
        .catch(e => tell(deps, `старые фото поста «${esc(f.name_uk)}» не удалились`, e));
    }
    const msgs = await deps.tg.sendAlbum(deps.channel, fileIds, caption);
    return deps.store.addChannelPost(key, msgs);
  }

  const n = Math.min(fileIds.length, row.msgs.length);
  await swap(n);
  await tell(deps, `в посте «${esc(f.name_uk)}» было ${row.msgs.length} фото, стало ${fileIds.length}`,
    fileIds.length > n ? `в канал поместились только первые ${n}` : `лишние ${row.msgs.length - n} старых фото удали в канале руками`);
}

/* Изделие изменили. newFileIds — если сменили фото: тогда меняем и
   картинки в посте. Пост, которого нет (изделие добавлено до бота
   или через панель), просто пропускаем. */
export async function update(deps, f, key, newFileIds) {
  const row = await deps.store.getChannelPost(key);
  if (!row) return;
  try {
    const caption = postText(f, { contacts: await contacts(deps), testing: deps.testing });
    if (newFileIds) {
      await replacePhotos(deps, f, key, row, newFileIds, caption);
    } else {
      await deps.tg.call('editMessageCaption', { chat_id: deps.channel, message_id: row.msg, caption, parse_mode: 'HTML' });
    }
  } catch (e) {
    if (harmless(e)) return;
    if (gone(e)) return deps.store.forgetChannelPost(key);
    await tell(deps, `пост «${esc(f.name_uk)}» не исправился`, e);
  }
}

/* Переписать подписи всех живых постов по нынешнему сайту: после
   того, как поменялся вид поста или телефон в настройках. Команда
   /kanal, только Артёму. Посты проданного не трогаем. */
export async function refreshAll(deps, catalogs, fromItem) {
  const rows = await deps.store.allChannelPosts();
  let done = 0, missing = 0;
  for (const row of rows) {
    let found = null;
    for (const [section, data] of Object.entries(catalogs)) {
      const item = data.items.find(i => i.photos && i.photos[0] === row.photo);
      if (item) { found = fromItem(item, section); break; }
    }
    if (!found) { missing++; continue; }
    await update(deps, found, row.photo, null);
    done++;
  }
  return { done, missing, total: rows.length };
}

/* Изделие убрали с сайта → «ПРОДАНО» в посте. */
export async function sold(deps, f, key) {
  const row = await deps.store.getChannelPost(key);
  if (!row) return;
  try {
    await deps.tg.call('editMessageCaption', {
      chat_id: deps.channel, message_id: row.msg,
      caption: postText(f, { sold: true, testing: deps.testing }), parse_mode: 'HTML'
    });
  } catch (e) {
    if (!harmless(e) && !gone(e)) return tell(deps, `«${esc(f.name_uk)}» не помечено как продано`, e);
  }
  await deps.store.forgetChannelPost(key);
}
