/* ============================================================
   ЯШАБОКС, бот — запись на сайт через GitHub.

   Сайт живёт в репозитории yashaboks/zoloto: любое сохранение в
   ветку main Cloudflare сам выкладывает на сайт за минуту. Бот
   делает то же, что панель Sveltia, — сохраняет файлы в GitHub.

   Фото и запись в каталоге уходят ОДНИМ сохранением (коммитом):
   либо изделие появилось целиком, либо не появилось ничего. Панель
   так не умела, и на сайте оставались изделия без фото.

   Ключ — GITHUB_TOKEN в настройках Cloudflare: открывает только
   этот репозиторий и только запись файлов.
   ============================================================ */

const REPO = 'yashaboks/zoloto';
const API = `https://api.github.com/repos/${REPO}`;

/* Сколько раз пробовать заново, если в ту же секунду кто-то
   сохранил что-то через панель: GitHub тогда отказывает, мы
   перечитываем свежий каталог и вносим изменение ещё раз. */
const ATTEMPTS = 4;

export function bytesToBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function base64ToText(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function makeGithub(token, branch) {
  async function gh(method, path, body) {
    const r = await fetch(path.startsWith('http') ? path : `${API}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        // Без User-Agent GitHub отвечает отказом.
        'user-agent': 'yashaboks-bot',
        ...(body ? { 'content-type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await r.text();
    const json = text ? JSON.parse(text) : null;
    if (!r.ok) {
      const e = new Error(`GitHub ${method} ${path}: ${r.status} ${json && json.message}`);
      e.status = r.status;
      throw e;
    }
    return json;
  }

  async function readAt(ref, path) {
    const j = await gh('GET', `/contents/${encodeURI(path)}?ref=${ref}`);
    return base64ToText(j.content);
  }

  return {
    branch,

    /* Прочитать файл в текущем состоянии ветки. */
    read: path => readAt(branch, path),

    /* Сохранить изменения одним коммитом.
       images — [{path, bytes}]: загружаются заранее, один раз.
       change(read) — получает функцию чтения файлов на момент
       коммита и возвращает [{path, text}] — что записать. Если
       коммит не прошёл из-за чужого сохранения, change вызывается
       снова уже на свежих файлах. */
    async commit({ images = [], change, message }) {
      const blobs = [];
      for (const img of images) {
        const b = await gh('POST', '/git/blobs', { content: bytesToBase64(img.bytes), encoding: 'base64' });
        blobs.push({ path: img.path, mode: '100644', type: 'blob', sha: b.sha });
      }

      for (let attempt = 1; ; attempt++) {
        const ref = await gh('GET', `/git/ref/heads/${branch}`);
        const head = ref.object.sha;
        const commit = await gh('GET', `/git/commits/${head}`);

        const files = await change(path => readAt(head, path));
        const tree = await gh('POST', '/git/trees', {
          base_tree: commit.tree.sha,
          tree: [...blobs, ...files.map(f => ({ path: f.path, mode: '100644', type: 'blob', content: f.text }))]
        });
        const next = await gh('POST', '/git/commits', { message, tree: tree.sha, parents: [head] });
        try {
          await gh('PATCH', `/git/refs/heads/${branch}`, { sha: next.sha, force: false });
          return next.sha;
        } catch (e) {
          // 422 — ветка ушла вперёд, пока мы собирали коммит.
          if (e.status !== 422 || attempt >= ATTEMPTS) throw e;
        }
      }
    }
  };
}
