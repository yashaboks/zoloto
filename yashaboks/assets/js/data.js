/* ============================================================
   yashaboks — data & config
   Edit CONFIG.social to plug in real links / phone number.
   Edit CATALOG to post real items (add `photo: "assets/img/xxx.jpg"`).
   ============================================================ */

const CONFIG = {
  rate: 3500,        // ₴ per gram — what he pays
  pawnRate: 3000,    // ₴ per gram — typical pawnshop, for the comparison
  currency: "₴",
  social: {
    tiktok: "https://www.tiktok.com/@yashaboks",
    instagram: "https://www.instagram.com/yashaboks",
    // TODO: replace the placeholder Telegram username with the real one
    telegram: "https://t.me/yashaboks",
    // TODO: replace the placeholder number with the real one (digits only for links)
    phone: "+380000000000",
    phoneDisplay: "+380 00 000 00 00",
    viber: "viber://chat?number=%2B380000000000",
    whatsapp: "https://wa.me/380000000000"
  }
};

/* icon library (inline SVG inner markup, drawn with currentColor) */
const ICONS = {
  badge: '<path d="M12 3l2.5 1.8 3-.2.9 2.9 2.4 1.9-1.1 2.8 1.1 2.8-2.4 1.9-.9 2.9-3-.2L12 21l-2.5-1.8-3 .2-.9-2.9L3.2 15l1.1-2.8L3.2 9.4l2.4-1.9.9-2.9 3 .2z"/><path d="M9 12l2 2 4-4"/>',
  cash: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5h.01M17.5 14.5h.01"/>',
  pin: '<path d="M12 21s-6.5-5.7-6.5-10.3A6.5 6.5 0 0 1 12 4a6.5 6.5 0 0 1 6.5 6.7C18.5 15.3 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.4"/>',
  scale: '<path d="M12 3v16M7 20h10M4.5 7h15M4.5 7L2 13h5zM19.5 7L17 13h5zM7 13a2.5 2.5 0 0 1-5 0M22 13a2.5 2.5 0 0 1-5 0M8 7l8-1.6"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  swap: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  chain: '<path d="M9 9a2.5 2.5 0 0 1 0 5 2.5 2.5 0 0 1 0-5zM15 10a2.5 2.5 0 0 1 0 5 2.5 2.5 0 0 1 0-5zM12 6a2.5 2.5 0 0 1 0 5 2.5 2.5 0 0 1 0-5zM6 13a2.5 2.5 0 0 1 0 5 2.5 2.5 0 0 1 0-5zM18 13a2.5 2.5 0 0 1 0 5 2.5 2.5 0 0 1 0-5z"/>',
  ring: '<circle cx="12" cy="14" r="6"/><path d="M9 8.5L10.5 4h3L15 8.5"/><path d="M12 3.6l1.2 1.4-1.2 1.3-1.2-1.3z"/>',
  earrings: '<circle cx="8" cy="6" r="2"/><path d="M8 8v4a3 3 0 0 0 3 3"/><circle cx="16" cy="6" r="2"/><path d="M16 8v4a3 3 0 0 1-3 3"/>',
  bracelet: '<ellipse cx="12" cy="12" rx="8" ry="6"/><ellipse cx="12" cy="12" rx="4" ry="3"/><circle cx="12" cy="6" r="1.3"/>',
  pendant: '<path d="M8 4h8l-1.5 4H9.5zM12 8v2"/><circle cx="12" cy="15" r="4"/>',
  coin: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="5"/><path d="M12 9v6M10 12h4"/>'
};

/* 4-step process — text comes from I18N (how.sN_t / how.sN_d) */
const STEPS = [
  { icon: "badge" },
  { icon: "pin" },
  { icon: "scale" },
  { icon: "cash" }
];

/* trust points — text from I18N (trust.tN_t / trust.tN_d) */
const TRUST = [
  { icon: "badge", key: "t1" },
  { icon: "cash",  key: "t2" },
  { icon: "pin",   key: "t3" },
  { icon: "scale", key: "t4" },
  { icon: "lock",  key: "t5" },
  { icon: "swap",  key: "t6" }
];

/* what I buy — chips */
const BUY = [
  { uk: "Ланцюжки", ru: "Цепочки" },
  { uk: "Каблучки", ru: "Кольца" },
  { uk: "Сережки", ru: "Серьги" },
  { uk: "Браслети", ru: "Браслеты" },
  { uk: "Кулони та підвіски", ru: "Кулоны и подвески" },
  { uk: "Монети", ru: "Монеты" },
  { uk: "Зубне золото", ru: "Зубное золото" },
  { uk: "Брухт і злам", ru: "Лом и обломки" },
  { uk: "Антикваріат", ru: "Антиквариат" },
  { uk: "Вироби з камінням", ru: "Изделия с камнями" }
];

/* showcase — demo items. Replace with real ones + add photo paths. */
const CATALOG = [
  { type: "chain",    name: { uk: "Ланцюжок «Бісмарк»", ru: "Цепочка «Бисмарк»" }, proba: 585, weight: 11.8, price: 26900, status: "available" },
  { type: "ring",     name: { uk: "Каблучка з фіанітами", ru: "Кольцо с фианитами" }, proba: 585, weight: 3.4, price: 7200, status: "available" },
  { type: "earrings", name: { uk: "Сережки «Конго»", ru: "Серьги «Конго»" }, proba: 750, weight: 4.1, price: 13500, status: "available" },
  { type: "bracelet", name: { uk: "Браслет плетений", ru: "Браслет плетёный" }, proba: 585, weight: 7.6, price: 16800, status: "sold" },
  { type: "pendant",  name: { uk: "Кулон «Ікона»", ru: "Кулон «Икона»" }, proba: 585, weight: 2.2, price: 4900, status: "available" },
  { type: "coin",     name: { uk: "Монета «Дукат»", ru: "Монета «Дукат»" }, proba: 986, weight: 3.49, price: null, status: "available" }
];
