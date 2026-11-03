/* ============================================================
   ЯШАБОКС — адрес /api/telegram, сюда Telegram приносит сообщения
   для бота. Файл в папке functions/ Cloudflare Pages сам делает
   адресом: свой сервер не нужен, выкладывается вместе с сайтом.

   Сама логика бота — в папке bot/ в корне репозитория (на сайт она
   не попадает: сайт выкладывается из папки yashaboks/).

   Что настроить в Cloudflare → проект yashaboks → Settings, и для
   Production, и для Preview (ключей в коде нет и быть не должно):
     Variables and secrets (тип Secret):
       TELEGRAM_TOKEN    — ключ бота от @BotFather
       ANTHROPIC_API_KEY — ключ Claude из console.anthropic.com
       GITHUB_TOKEN      — ключ GitHub: только yashaboks/zoloto, Contents
     Bindings:
       DB — база D1 (yashaboks-bot)
       AI — Workers AI (распознавание голоса)
     Необязательно: CLAUDE_MODEL — другая модель Claude для сравнения.

   После выкладки один раз открыть в браузере
     https://<адрес сайта>/api/telegram?setup=1
   — бот начнёт слушать именно этот адрес.
   ============================================================ */

import { handleUpdate, ADMIN } from '../../bot/bot.js';
import { makeStore } from '../../bot/store.js';
import { makeTelegram } from '../../bot/telegram.js';
import { makeGithub, bytesToBase64 } from '../../bot/github.js';
import { understand, transcribe } from '../../bot/understand.js';

/* Настоящий сайт — только эти адреса. С любого другого (копия
   ветки для проверки) бот пишет в ветку bot-sandbox: что бы ни
   случилось на тесте, живой каталог Саши не тронут. */
const LIVE_HOSTS = ['yashaboks.com', 'www.yashaboks.com', 'yashaboks.pages.dev'];
const SANDBOX_BRANCH = 'bot-sandbox';

function branchFor(host) {
  return LIVE_HOSTS.includes(host) ? 'main' : SANDBOX_BRANCH;
}

/* Секрет, который Telegram прикладывает к каждому запросу. Без него
   кто угодно мог бы прислать на этот адрес поддельное «нажатие
   кнопки». Выводим его из ключа бота, чтобы не заводить ещё одну
   настройку: знает его только тот, кто знает ключ. */
async function webhookSecret(token) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`yashaboks:${token}`));
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function missingSettings(env) {
  return ['TELEGRAM_TOKEN', 'ANTHROPIC_API_KEY', 'GITHUB_TOKEN', 'DB', 'AI'].filter(k => !env[k]);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (missingSettings(env).length) return new Response('not configured', { status: 503 });
  const got = request.headers.get('x-telegram-bot-api-secret-token');
  if (got !== await webhookSecret(env.TELEGRAM_TOKEN)) return new Response('forbidden', { status: 403 });

  const update = await request.json();
  const host = new URL(request.url).hostname;
  const branch = branchFor(host);
  const deps = {
    tg: makeTelegram(env.TELEGRAM_TOKEN),
    gh: makeGithub(env.GITHUB_TOKEN, branch),
    store: makeStore(env.DB),
    understand: args => understand(env, args),
    transcribe: bytes => transcribe(env.AI, bytes, bytesToBase64),
    sleep: ms => new Promise(r => setTimeout(r, ms)),
    testing: branch !== 'main'
  };

  // Telegram ждёт ответа быстро, а голос и Claude — это секунды.
  // Отвечаем сразу, работу доделываем после ответа.
  context.waitUntil(handleUpdate(deps, update));
  return new Response('ok');
}

/* Открыть в браузере:
     /api/telegram          — проверить, всё ли настроено (без ключей);
     /api/telegram?setup=1  — подключить бота к этому адресу. */
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const branch = branchFor(url.hostname);
  const missing = missingSettings(env);
  const lines = [
    `Адрес: ${url.hostname}`,
    `Пишет в ветку: ${branch}${branch === 'main' ? ' (настоящий сайт)' : ' (тестовая копия)'}`,
    missing.length ? `Не хватает настроек: ${missing.join(', ')}` : 'Настройки: все на месте'
  ];

  if (url.searchParams.get('setup') && !missing.length) {
    const tg = makeTelegram(env.TELEGRAM_TOKEN);
    await makeStore(env.DB).init();
    await tg.call('setWebhook', {
      url: `https://${url.hostname}/api/telegram`,
      secret_token: await webhookSecret(env.TELEGRAM_TOKEN),
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true
    });
    await tg.call('setMyCommands', {
      commands: [
        { command: 'help', description: 'Как пользоваться' },
        { command: 'otmena', description: 'Выбросить карточку и фото' }
      ]
    });
    // Переключение бота видно Артёму сразу — и случайное тоже.
    await tg.send(ADMIN, `🔌 Бот подключён к ${url.hostname}, пишет в ветку ${branch}.`);
    lines.push('', 'Готово: бот слушает этот адрес.');
  }

  return new Response(lines.join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
