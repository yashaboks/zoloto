/* ============================================================
   ЯШАБОКС, бот — разговор с Telegram.

   Только тонкая обёртка над Bot API: отправить, поправить, скачать.
   Ключ бота приходит из настроек Cloudflare (TELEGRAM_TOKEN) и в
   коде не хранится.
   ============================================================ */

/* На всё, что бот делает после ответа Telegram, у Cloudflare есть
   около 30 секунд — потом работу молча обрывают. Поэтому у каждого
   запроса свой срок: лучше честная ошибка, чем тихое зависание. */
const TIMEOUT = 12000;

export function makeTelegram(token) {
  const base = `https://api.telegram.org/bot${token}`;

  async function call(method, body) {
    const r = await fetch(`${base}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT)
    });
    const j = await r.json();
    if (!j.ok) throw new Error(`Telegram ${method}: ${j.description}`);
    return j.result;
  }

  // Кнопки описываем рядами [[{text, data}]], Telegram ждёт callback_data.
  const keyboard = rows => rows && rows.length
    ? { inline_keyboard: rows.map(row => row.map(b => ({ text: b.text, callback_data: b.data }))) }
    : undefined;

  return {
    call,

    async send(chat, text, buttons) {
      const m = await call('sendMessage', {
        chat_id: chat, text, parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: keyboard(buttons)
      });
      return m.message_id;
    },

    async sendPhoto(chat, fileId, caption, buttons) {
      const m = await call('sendPhoto', {
        chat_id: chat, photo: fileId, caption, parse_mode: 'HTML',
        reply_markup: keyboard(buttons)
      });
      return m.message_id;
    },

    /* Отправить фото файлом, а не ссылкой: по ссылке Telegram качает
       сам, и с фото сайта это было ненадёжно — бот зависал. */
    async sendPhotoFile(chat, bytes, name, type, caption, buttons) {
      const form = new FormData();
      form.append('chat_id', String(chat));
      form.append('photo', new Blob([bytes], { type }), name);
      form.append('caption', caption);
      form.append('parse_mode', 'HTML');
      const kb = keyboard(buttons);
      if (kb) form.append('reply_markup', JSON.stringify(kb));
      const r = await fetch(`${base}/sendPhoto`, { method: 'POST', body: form, signal: AbortSignal.timeout(TIMEOUT) });
      const j = await r.json();
      if (!j.ok) throw new Error(`Telegram sendPhoto: ${j.description}`);
      return j.result.message_id;
    },

    /* Убрать кнопки со старой карточки, чтобы по ней нельзя было
       нажать. Ошибка тут не важна: сообщение могли удалить, или
       кнопок там уже нет. */
    async stripButtons(chat, msg) {
      if (!msg) return;
      try {
        await call('editMessageReplyMarkup', { chat_id: chat, message_id: msg, reply_markup: { inline_keyboard: [] } });
      } catch { /* не страшно */ }
    },

    async answer(id, text) {
      try { await call('answerCallbackQuery', { callback_query_id: id, text }); } catch { /* кнопка устарела */ }
    },

    async typing(chat) {
      try { await call('sendChatAction', { chat_id: chat, action: 'typing' }); } catch { /* не важно */ }
    },

    /* Скачать файл (фото или голосовое) по его file_id. Telegram сам
       хранит фото в уменьшенном виде, около 1280 px, — поэтому RAW
       с айфона сюда не доходит, и сжимать ничего не надо. */
    async download(fileId) {
      const f = await call('getFile', { file_id: fileId });
      const r = await fetch(`https://api.telegram.org/file/bot${token}/${f.file_path}`, { signal: AbortSignal.timeout(TIMEOUT) });
      if (!r.ok) throw new Error(`Telegram: не скачался файл (${r.status})`);
      return new Uint8Array(await r.arrayBuffer());
    }
  };
}
