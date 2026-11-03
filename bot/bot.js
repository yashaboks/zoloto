/* ============================================================
   ЯШАБОКС, бот — что происходит на каждое сообщение.

   Порядок для Саши (подробно — в БОТ-правила-для-Саши.md):
   фото (1–3) → голосовое → карточка → «Опубликовать».
   Исправление до публикации — следующим сообщением.
   После публикации — ответом на сообщение «Опубликовано».

   Главное правило файла: на сайт ничего не попадает без нажатия
   кнопки. Голос и Claude только заполняют карточку, записывает
   её код — и только после «да».

   Всё внешнее (Telegram, GitHub, Claude, база) приходит в deps:
   так этот файл можно прогнать на поддельных данных, ничего не
   отправляя и ничего не записывая на сайт.
   ============================================================ */

import {
  SECTIONS, normalize, check, cardText, esc, fieldLines,
  parseCatalog, findIndex, toItem, fromItem, insertItem, removeItem, replaceItem, NotFound, searchCatalog
} from './rules.js';

/* Артём: ему бот доступен всегда, и он решает, кого ещё пустить. */
export const ADMIN = 240611165;

const MAX_PHOTOS = 3;

/* Сколько ждать остальные фото альбома. Telegram присылает их
   отдельными сообщениями в течение секунды-двух. */
const ALBUM_WAIT = 2500;

const catalogPath = section => `yashaboks/assets/data/catalog/${section}.json`;

/* Ошибка, которую нужно просто показать Саше как есть. */
export class Say extends Error {}

const HELP = [
  '<b>Как добавить изделие</b>',
  '1. Пришли 1–3 фото одним сообщением (первое — обложка).',
  '2. Скажи голосом: что это, проба, вес. Если есть — длина или размер и цена.',
  '3. Проверь карточку и нажми «Опубликовать».',
  '',
  'Ошибся бот — просто скажи или напиши, что исправить.',
  'Изделие уже на сайте — ответь на его сообщение «Опубликовано» и скажи «продано», новую цену или пришли новые фото.',
  'Не можешь найти сообщение — скажи без фото, например «убери часы, тридцать грамм»: бот найдёт изделие на сайте и покажет.',
  '',
  '/otmena — выбросить текущую карточку и неотправленные фото.'
].join('\n');

export async function handleUpdate(deps, update) {
  const { store } = deps;
  if (!(await store.claimUpdate(update.update_id))) return;

  const chat = update.callback_query
    ? update.callback_query.message && update.callback_query.message.chat.id
    : update.message && update.message.chat.id;

  try {
    if (update.callback_query) await onButton(deps, update.callback_query);
    else if (update.message) await onMessage(deps, update.message);
  } catch (e) {
    await reportError(deps, chat, e);
  }
}

async function reportError({ tg }, chat, e) {
  if (e instanceof Say) {
    if (chat) await tg.send(chat, e.message);
    return;
  }
  // Саше — коротко и по-человечески, Артёму — как есть, чтобы чинить.
  try {
    if (chat) await tg.send(chat, '😕 Что-то пошло не так, на сайт ничего не записано. Артём уже знает. Попробуй ещё раз чуть позже.');
    if (chat !== ADMIN) await tg.send(ADMIN, `⚠️ Ошибка бота (чат ${chat}):\n<code>${esc(String(e && e.stack || e)).slice(0, 3000)}</code>`);
  } catch { /* если и Telegram недоступен — сделать уже нечего */ }
}

/* ---------- Кто может пользоваться ---------- */

async function allowed(store, user) {
  if (user.id === ADMIN) return true;
  const u = await store.getUser(user.id);
  return !!u && u.status === 'allowed';
}

function userName(u) {
  return [u.first_name, u.last_name].filter(Boolean).join(' ') + (u.username ? ` (@${u.username})` : '');
}

/* Незнакомцу бот ничего не делает, а Артёму присылает вопрос с
   кнопками. Так Сашин номер в Telegram не надо узнавать заранее:
   Саша пишет боту, Артём жмёт «Разрешить». Один раз на человека. */
async function onStranger({ tg, store }, m) {
  const isNew = await store.addPendingUser(m.from.id, userName(m.from));
  if (!isNew) return;
  await tg.send(m.chat.id, 'Это рабочий бот магазина ЯШАБОКС. Я передал владельцу, что ты написал.');
  await tg.send(ADMIN, `👤 Боту написал(а): <b>${esc(userName(m.from))}</b>, ID ${m.from.id}.\nРазрешить пользоваться ботом?`, [[
    { text: '✅ Разрешить', data: `allow:${m.from.id}` },
    { text: '🚫 Нет', data: `deny:${m.from.id}` }
  ]]);
}

/* ---------- Сообщения ---------- */

async function onMessage(deps, m) {
  const { tg, store } = deps;
  if (m.chat.type !== 'private') return;
  if (!(await allowed(store, m.from))) return onStranger(deps, m);

  const chat = m.chat.id;
  const text = (m.text || '').trim();

  if (text.startsWith('/')) {
    const cmd = text.split(/[\s@]/)[0].toLowerCase();
    if (cmd === '/otmena' || cmd === '/cancel') return cancelAll(deps, chat);
    if (cmd === '/zhurnal' && m.from.id === ADMIN) return showJournal(deps, chat);
    return tg.send(chat, HELP);
  }

  if (m.photo) return onPhoto(deps, m);

  if (m.document && /^image\//.test(m.document.mime_type || '')) {
    throw new Say('Пришли, пожалуйста, как <b>фото</b>, а не файлом: файл с айфона бывает огромным (RAW) и на сайт не годится.');
  }
  if (m.video || m.video_note) throw new Say('Видео сайт не показывает — пришли фото.');

  if (m.voice || m.audio) {
    await tg.typing(chat);
    const bytes = await tg.download((m.voice || m.audio).file_id);
    const heard = await deps.transcribe(bytes);
    if (!heard) throw new Say('Не расслышал 🙉 Повтори, пожалуйста, или напиши текстом.');
    return onWords(deps, m, heard);
  }

  if (text) return onWords(deps, m, text);
  return tg.send(chat, HELP);
}

/* Последние фразы и как их понял Claude — только Артёму. Чтобы
   разбираться, почему бот что-то понял не так, не залезая в базу. */
async function showJournal({ tg, store }, chat) {
  const rows = await store.recentLog(6);
  if (!rows.length) return tg.send(chat, 'Журнал пуст.');
  const parts = rows.map(r => {
    const res = JSON.parse(r.result || '{}');
    const short = Object.entries(res).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}=${v}`).join(', ');
    return `<b>${new Date(r.ts).toISOString().slice(11, 16)} ${r.mode}</b> «${esc(r.text)}»\n→ ${esc(short)}`;
  });
  return tg.send(chat, parts.join('\n\n').slice(0, 4000));
}

async function cancelAll({ tg, store }, chat) {
  const d = await store.getDraft(chat);
  if (d) await tg.stripButtons(chat, d.card);
  await store.deleteDraft(chat);
  const free = await store.freePhotos(chat);
  await store.deletePhotos(chat, free.map(p => p.msg));
  return tg.send(chat, 'Ок, всё выбросил. Можно начинать заново: фото, потом голосовое.');
}

/* ---------- Фото ---------- */

async function onPhoto(deps, m) {
  const { tg, store } = deps;
  const chat = m.chat.id;
  const grp = m.media_group_id ? `${chat}:g${m.media_group_id}` : `${chat}:m${m.message_id}`;
  // Самое большое из размеров, которые хранит Telegram.
  const fileId = m.photo[m.photo.length - 1].file_id;
  await store.addPhoto({ chat, msg: m.message_id, grp, fileId, caption: m.caption });

  const pub = m.reply_to_message && await store.getPublished(chat, m.reply_to_message.message_id);
  if (pub) await store.markGroupReplace(grp, chat, { section: pub.section, photo: pub.photo });

  // Ждём остальные фото альбома; отвечает только один из обработчиков.
  await deps.sleep(ALBUM_WAIT);
  const g = await store.takeGroup(grp, chat);
  if (!g) return;

  if (g.type === 'replace') return replacePhotosCard(deps, chat, g.target, await store.groupPhotos(grp));

  const draft = await store.getDraft(chat);
  if (draft) {
    if (await store.markAsked(chat)) await askAboutOldCard(deps, chat, draft);
    return;
  }

  const caption = (await store.groupPhotos(grp)).map(p => p.caption).find(Boolean);
  if (caption) return newItem(deps, chat, caption);

  return tg.send(chat, '📷 Фото есть. Теперь скажи голосом: что это, проба, вес (и длина или цена, если есть).');
}

async function askAboutOldCard({ tg }, chat, draft) {
  const name = draft.data.fields ? draft.data.fields.name_uk : '';
  return tg.send(chat, `Новые фото получил. Но прошлая карточка${name ? ` «${esc(name)}»` : ''} ещё не закончена. Что с ней?`, [[
    { text: '✅ Опубликовать её', data: `ok:${draft.ver}` },
    { text: '🗑 Выбросить', data: `no:${draft.ver}` }
  ]]);
}

/* ---------- Голос или текст ---------- */

async function onWords(deps, m, text) {
  const { tg, store } = deps;
  const chat = m.chat.id;
  const pub = m.reply_to_message && await store.getPublished(chat, m.reply_to_message.message_id);
  const draft = await store.getDraft(chat);

  if (pub) {
    if (draft) throw new Say('Сначала закончи с карточкой выше: опубликуй или отмени её.');
    return changePublished(deps, chat, pub, text);
  }

  if (draft) {
    if (draft.state === 'busy') throw new Say('Секунду, ещё сохраняю прошлую карточку…');
    if ((await store.freePhotos(chat)).length) {
      await store.markAsked(chat);
      return askAboutOldCard(deps, chat, draft);
    }
    if (draft.data.kind === 'delete' || draft.data.kind === 'photos') {
      throw new Say('Нажми кнопку под карточкой выше: подтвердить или отмена.');
    }
    return fixDraft(deps, chat, draft, text);
  }

  return newItem(deps, chat, text);
}

/* Правка поверх того, что уже есть. Раздел, название, пробу и вес
   «стереть» нельзя — если Claude вернул пусто, значит, просто не
   повторил их, и остаётся прежнее. А длину и цену стереть можно
   («цену убери» = за домовленістю), поэтому их берём как есть. */
function merge(current, r) {
  const keep = (k) => (r[k] == null || r[k] === '' ? current[k] : r[k]);
  return {
    section: keep('section'), name_uk: keep('name_uk'), proba: keep('proba'), weight: keep('weight'),
    length: r.length, price: r.price
  };
}

async function think(deps, chat, mode, text, current) {
  const { model, result } = await deps.understand({ mode, text, current });
  await deps.store.log({ chat, mode, text, model, result });
  return result;
}

async function newItem(deps, chat, text) {
  const { tg, store } = deps;
  const free = await store.freePhotos(chat);
  if (!free.length) return findOnSite(deps, chat, text);

  await tg.typing(chat);
  const r = await think(deps, chat, 'new', text, null);
  if (r.action === 'unclear') throw new Say(r.question ? esc(r.question) : 'Не понял 🤔 Скажи: что это, проба, вес.');

  const photos = free.slice(0, MAX_PHOTOS);
  const fields = normalize(r);
  await store.deletePhotos(chat, free.map(p => p.msg));
  const note = [
    free.length > MAX_PHOTOS ? `Взял первые ${MAX_PHOTOS} фото — больше сайт не показывает.` : '',
    r.question ? '❓ ' + esc(r.question) : ''
  ].filter(Boolean).join('\n');
  return showCard(deps, chat, { kind: 'new', fields, photos: photos.map(p => p.file_id), note, heard: text });
}

async function fixDraft(deps, chat, draft, text) {
  await deps.tg.typing(chat);
  const r = await think(deps, chat, 'fix', text, draft.data.fields);
  if (r.action === 'unclear') throw new Say(r.question ? esc(r.question) : 'Не понял, что исправить 🤔');
  const fields = normalize(merge(draft.data.fields, r));
  return showCard(deps, chat, { ...draft.data, fields, note: r.question ? '❓ ' + esc(r.question) : '' }, draft);
}

/* Изделие уже на сайте: читаем, как оно записано сейчас (его могли
   поменять через панель), и спрашиваем Claude, что Саша хочет. */
async function changePublished(deps, chat, pub, text) {
  const { tg } = deps;
  await tg.typing(chat);
  const item = await readItem(deps, pub);
  const current = fromItem(item, pub.section);
  const r = await think(deps, chat, 'site', text, current);

  if (r.action === 'delete') return showCard(deps, chat, { kind: 'delete', fields: current, target: pub });
  if (r.action === 'unclear') throw new Say(r.question ? esc(r.question) : 'Не понял, что поменять 🤔');

  const fields = normalize(merge(current, r));
  return showCard(deps, chat, { kind: 'edit', fields, before: current, target: pub, note: r.question ? '❓ ' + esc(r.question) : '' });
}

async function readItem({ gh }, pub) {
  const data = parseCatalog(await gh.read(catalogPath(pub.section)));
  const i = findIndex(data, pub.photo);
  if (i < 0) throw new Say('Не нашёл это изделие на сайте — похоже, его уже убрали через панель.');
  return data.items[i];
}

/* Фото нет — значит, Саша говорит о том, что уже на сайте: «убери
   часы», «у печатки на 12 грамм поменяй цену». Находим и присылаем
   кандидатов с фото. Каждое такое сообщение работает как
   «Опубликовано»: под ним кнопка «Убрать», а ответом на него можно
   поменять поля или фото. */
async function findOnSite(deps, chat, text) {
  const { tg, gh, store } = deps;
  await tg.typing(chat);
  const r = await think(deps, chat, 'search', text, null);
  const q = normalize(r);
  if (r.action === 'unclear' || (!q.section && !q.weight && !q.proba && !r.name_uk)) {
    throw new Say('Новое изделие — сначала пришли фото (1–3 одним сообщением), потом голосовое.\n\n' +
      'Убрать или поменять то, что уже на сайте, — скажи, что это и вес, например «убери часы, тридцать грамм».');
  }

  const catalogs = {};
  for (const section of q.section ? [q.section] : Object.keys(SECTIONS)) {
    catalogs[section] = parseCatalog(await gh.read(catalogPath(section)));
  }
  const { total, items } = searchCatalog(catalogs, { ...q, name_uk: r.name_uk });
  if (!items.length) throw new Say('Не нашёл такого на сайте 🤔 Скажи по-другому: что это, проба, вес.');

  const wantDelete = r.action === 'delete';
  await tg.send(chat, total > items.length
    ? `Нашёл ${total}, показываю первые ${items.length}. Чтобы найти точнее — скажи вес.`
    : `Нашёл ${total === 1 ? 'одно' : total}:`);

  for (const { section, item } of items) {
    const f = fromItem(item, section);
    const caption = [...fieldLines(f), '',
      wantDelete ? '<i>Это оно? Жми «Убрать».</i>' : '<i>Чтобы поменять — ответь на это сообщение. Убрать — кнопка ниже.</i>'
    ].join('\n');
    const buttons = [[{ text: '🗑 Убрать с сайта', data: 'rm' }]];
    let msg;
    try {
      const r = await fetch(deps.siteUrl + item.photos[0], { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(`фото с сайта: ${r.status}`);
      const type = r.headers.get('content-type') || 'image/jpeg';
      const bytes = new Uint8Array(await r.arrayBuffer());
      msg = await tg.sendPhotoFile(chat, bytes, item.photos[0].split('/').pop(), type, caption, buttons);
    } catch (e) {
      // Без фото найденное всё равно можно убрать или поправить —
      // присылаем текстом, а Артёму причину, чтобы починить.
      msg = await tg.send(chat, caption, buttons);
      if (chat !== ADMIN || deps.testing) await tg.send(ADMIN, `⚠️ Не отправилось фото ${esc(item.photos[0])}: ${esc(String(e && e.message || e))}`).catch(() => {});
    }
    await store.addPublished(chat, msg, section, item.photos[0]);
  }
}

/* «Убрать с сайта» под найденным изделием. Само сообщение с фото и
   есть подтверждение, поэтому второй карточки «точно?» не нужно. */
async function removeFound(deps, chat, cq) {
  const { tg, store } = deps;
  const pub = await store.getPublished(chat, cq.message.message_id);
  if (!pub) {
    await tg.answer(cq.id, 'Уже убрано');
    return tg.stripButtons(chat, cq.message.message_id);
  }
  if (await store.getDraft(chat)) {
    await tg.answer(cq.id);
    throw new Say('Сначала закончи с карточкой выше: опубликуй или отмени её.');
  }
  const item = await readItem(deps, pub);
  const ver = await store.saveDraft(chat, { kind: 'delete', fields: fromItem(item, pub.section), target: pub });
  if (!(await store.claimDraft(chat, ver))) return tg.answer(cq.id, 'Уже убираю…');
  await tg.answer(cq.id, 'Убираю…');
  try {
    await publish(deps, chat, await store.getDraft(chat), cq.from);
  } catch (e) {
    await store.deleteDraft(chat);
    throw e;
  }
  await tg.stripButtons(chat, cq.message.message_id);
}

async function replacePhotosCard(deps, chat, target, photos) {
  const draft = await deps.store.getDraft(chat);
  if (draft) throw new Say('Сначала закончи с карточкой выше: опубликуй или отмени её. Потом пришли новые фото ещё раз.');
  const item = await readItem(deps, target);
  await deps.store.deletePhotos(chat, photos.map(p => p.msg));
  return showCard(deps, chat, {
    kind: 'photos',
    fields: fromItem(item, target.section),
    photos: photos.slice(0, MAX_PHOTOS).map(p => p.file_id),
    target
  });
}

/* ---------- Карточка ---------- */

async function showCard(deps, chat, data, oldDraft) {
  const { tg, store } = deps;
  if (oldDraft) await tg.stripButtons(chat, oldDraft.card);
  const ver = await store.saveDraft(chat, data);
  const f = data.fields;
  const testing = deps.testing ? '\n🧪 <i>Тест: пишу в копию сайта, не на настоящий.</i>' : '';
  let msg;

  if (data.kind === 'new') {
    const ok = check(f).ok;
    const buttons = [[...(ok ? [{ text: '✅ Опубликовать', data: `ok:${ver}` }] : []), { text: '❌ Отмена', data: `no:${ver}` }]];
    msg = await tg.sendPhoto(chat, data.photos[0],
      cardText({ title: '🆕 <b>Новое изделие</b>' + testing, fields: f, photoCount: data.photos.length, note: data.note }), buttons);
  } else if (data.kind === 'edit') {
    const ok = check(f).ok;
    const buttons = [[...(ok ? [{ text: '✅ Сохранить', data: `ok:${ver}` }] : []), { text: '❌ Отмена', data: `no:${ver}` }]];
    msg = await tg.send(chat, cardText({ title: '✏️ <b>Изменить на сайте</b>' + testing, fields: f, before: data.before, note: data.note }), buttons);
  } else if (data.kind === 'delete') {
    msg = await tg.send(chat, ['🗑 <b>Убрать с сайта?</b>' + testing, '', ...fieldLines(f)].join('\n'), [[
      { text: '🗑 Да, убрать', data: `ok:${ver}` }, { text: '❌ Отмена', data: `no:${ver}` }
    ]]);
  } else {
    msg = await tg.sendPhoto(chat, data.photos[0],
      [`🖼 <b>Заменить фото (${data.photos.length})</b>` + testing, '', ...fieldLines(f)].join('\n'), [[
        { text: '✅ Заменить', data: `ok:${ver}` }, { text: '❌ Отмена', data: `no:${ver}` }
      ]]);
  }
  await store.setDraftCard(chat, ver, msg);
}

/* ---------- Кнопки ---------- */

async function onButton(deps, cq) {
  const { tg, store } = deps;
  const chat = cq.message.chat.id;
  const [act, arg] = String(cq.data || '').split(':');

  if (act === 'allow' || act === 'deny') {
    if (cq.from.id !== ADMIN) return tg.answer(cq.id);
    const id = Number(arg);
    await store.setUserStatus(id, act === 'allow' ? 'allowed' : 'denied');
    await tg.answer(cq.id, act === 'allow' ? 'Доступ открыт' : 'Отказано');
    await tg.stripButtons(chat, cq.message.message_id);
    if (act === 'allow') await tg.send(id, '✅ Доступ открыт.\n\n' + HELP);
    return;
  }

  if (!(await allowed(store, cq.from))) return tg.answer(cq.id);
  if (act === 'rm') return removeFound(deps, chat, cq);

  const draft = await store.getDraft(chat);
  if (!draft || String(draft.ver) !== arg) {
    await tg.answer(cq.id, 'Эта карточка уже неактуальна');
    return tg.stripButtons(chat, cq.message.message_id);
  }

  if (act === 'no') {
    await store.deleteDraft(chat);
    await tg.answer(cq.id, 'Отменено');
    await tg.stripButtons(chat, draft.card);
    await tg.stripButtons(chat, cq.message.message_id);
    await tg.send(chat, '❌ Карточку выбросил, на сайте ничего не менял.');
  } else if (act === 'ok') {
    if (!(await store.claimDraft(chat, draft.ver))) return tg.answer(cq.id, 'Уже сохраняю…');
    await tg.answer(cq.id, 'Сохраняю…');
    try {
      await publish(deps, chat, draft, cq.from);
    } catch (e) {
      await store.releaseDraft(chat);
      throw e;
    }
    await tg.stripButtons(chat, draft.card);
    await tg.stripButtons(chat, cq.message.message_id);
  } else {
    return tg.answer(cq.id);
  }

  // Карточку закрыли, а новые фото уже ждут — подсказать, что дальше.
  if ((await store.freePhotos(chat)).length) {
    await tg.send(chat, '📷 Новые фото на месте. Теперь скажи про них голосом: что это, проба, вес.');
  }
}

/* ---------- Запись на сайт ---------- */

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
}

/* Имя файла: время + случайная часть. Одного времени мало: если ты
   и Саша сохраните что-то в одну секунду, фото получили бы одинаковые
   имена и затёрли бы друг друга. */
async function downloadPhotos({ tg }, fileIds) {
  const t = `${stamp()}-${Math.random().toString(36).slice(2, 6)}`;
  const out = [];
  for (let i = 0; i < fileIds.length; i++) {
    const name = `tg-${t}-${i + 1}.jpg`;
    out.push({ path: `yashaboks/assets/img/${name}`, url: `/assets/img/${name}`, bytes: await tg.download(fileIds[i]) });
  }
  return out;
}

async function publish(deps, chat, draft, from) {
  const { tg, gh, store } = deps;
  const d = draft.data;
  const f = d.fields;
  const where = deps.testing ? ' (в тестовой копии сайта)' : '';
  const hint = '\n\n<i>Чтобы поменять или убрать — ответь на это сообщение (смахни его влево).</i>';
  let text, section = f.section, photo;

  if (d.kind === 'new') {
    if (!check(f).ok) throw new Say('В карточке не хватает данных — допиши и нажми снова.');
    const imgs = await downloadPhotos(deps, d.photos);
    photo = imgs[0].url;
    const item = toItem(f, imgs.map(i => i.url));
    await gh.commit({
      images: imgs,
      message: `Бот: новое изделие «${f.name_uk}» (${section})`,
      change: async read => [{ path: catalogPath(section), text: insertItem(await read(catalogPath(section)), item) }]
    });
    text = `✅ Опубликовано${where}: <b>${esc(f.name_uk)}</b>, ${SECTIONS[section].uk}. Через минуту-две будет на сайте.`;
  } else {
    photo = d.target.photo;
    const oldSection = d.target.section;
    let imgs = [];
    if (d.kind === 'photos') {
      imgs = await downloadPhotos(deps, d.photos);
      photo = imgs[0].url;
    }
    if (d.kind === 'edit' && !check(f).ok) throw new Say('В карточке не хватает данных — допиши и нажми снова.');

    await gh.commit({
      images: imgs,
      message: d.kind === 'delete' ? `Бот: убрано «${f.name_uk}» (${oldSection})`
        : d.kind === 'photos' ? `Бот: новые фото «${f.name_uk}» (${oldSection})`
        : `Бот: изменено «${f.name_uk}» (${section})`,
      change: async read => {
        const fromText = await read(catalogPath(oldSection));
        if (d.kind === 'delete') return [{ path: catalogPath(oldSection), text: removeItem(fromText, d.target.photo).text }];
        if (d.kind === 'photos') {
          const data = parseCatalog(fromText);
          const i = findIndex(data, d.target.photo);
          if (i < 0) throw new NotFound(d.target.photo);
          return [{ path: catalogPath(oldSection), text: replaceItem(fromText, d.target.photo, { ...data.items[i], photos: imgs.map(x => x.url) }) }];
        }
        // Правка: берём свежую запись с сайта и меняем только поля,
        // фото и статус оставляем как есть.
        const { text: rest, item: old } = removeItem(fromText, d.target.photo);
        const item = toItem(f, old.photos, old.status || 'available');
        if (section === oldSection) return [{ path: catalogPath(oldSection), text: replaceItem(fromText, d.target.photo, item) }];
        // Другой раздел: убрать из старого файла и поставить первым в новом.
        return [
          { path: catalogPath(oldSection), text: rest },
          { path: catalogPath(section), text: insertItem(await read(catalogPath(section)), item) }
        ];
      }
    }).catch(e => {
      if (e instanceof NotFound) throw new Say('Не нашёл это изделие на сайте — похоже, его уже убрали через панель.');
      throw e;
    });

    if (d.kind === 'delete') {
      await store.forgetPublished(d.target.photo);
      section = oldSection;
      text = `🗑 Убрано с сайта${where}: <b>${esc(f.name_uk)}</b>.`;
    } else {
      await store.retargetPublished(d.target.photo, section, photo);
      text = d.kind === 'photos'
        ? `✅ Фото заменены${where}: <b>${esc(f.name_uk)}</b>. Через минуту-две будет на сайте.`
        : `✅ Изменено${where}: <b>${esc(f.name_uk)}</b>, ${SECTIONS[section].uk}. Через минуту-две будет на сайте.`;
    }
  }

  // На сайт уже записано. Если дальше что-то сломается, Саша не
  // должен думать, что изделие не сохранилось, и жать ещё раз.
  try {
    await store.deleteDraft(chat);
    const msg = await tg.send(chat, text + (d.kind === 'delete' ? '' : hint));
    if (d.kind !== 'delete') await store.addPublished(chat, msg, section, photo);
  } catch (e) {
    await tg.send(ADMIN, `⚠️ Записано на сайт, но после этого ошибка:\n<code>${esc(String(e && e.stack || e)).slice(0, 2000)}</code>`).catch(() => {});
    throw new Say(text + '\n\n(Записано. Повторно жать не нужно.)');
  }

  // Первое время Артём видит каждую публикацию — чтобы заметить,
  // если бот где-то понимает Сашу неправильно.
  if (chat !== ADMIN) {
    await tg.send(ADMIN, `📋 ${esc(userName(from))}:\n${text}\n\n${fieldLines(f).join('\n')}`);
  }
}
