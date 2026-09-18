// @ts-check
/**
 * <hashrock-switcher> — hashrock の star 済みプロジェクトを行き来するメニュー。
 *
 * https://repos.hashrock.info/switcher/v1.js としてこのファイルをそのまま配る
 * (app/routes/switcher/v1.js.ts)。ビルドを通さないので依存ライブラリは持たない。
 *
 *   <script type="module" src="https://repos.hashrock.info/switcher/v1.js"></script>
 *   <hashrock-switcher></hashrock-switcher>
 *
 * 属性: floating (画面右上の角に浮かせる) / theme="light" | "dark" (省略時は OS に従う)
 * 配色: --hs-bg --hs-fg --hs-muted --hs-border --hs-accent で上書きできる
 *
 * 1 本を全サイトが読むので、壊すと全サイトが同時に壊れる。タグ名・属性・
 * 既定の見た目の互換を崩す変更は v2.js を新設すること。
 * ホストのページを妨げないよう、読み込みも描画も非同期で、例外は外に出さない。
 */

const ORIGIN = "https://repos.hashrock.info";
export const API_URL = `${ORIGIN}/api/starred`;
export const ALL_PROJECTS_URL = `${ORIGIN}/`;
export const CACHE_KEY = "hashrock-switcher:v1";
/** これより新しいキャッシュは取り直さない (API の max-age と揃える) */
export const CACHE_TTL_MS = 60 * 1000;
export const TAG_NAME = "hashrock-switcher";
const LABEL = "hashrock のサービス";

const MENU_WIDTH = 320;
const VIEWPORT_MARGIN = 8;
const MENU_GAP = 6;

/**
 * @typedef {{ id: number, name: string, description: string | null, logo: string | null, href: string }} SwitcherItem
 * @typedef {{ savedAt: number, items: SwitcherItem[] }} CacheEntry
 */

// ---------------------------------------------------------------------------
// 純粋関数 (app/switcher/__tests__ で単体テストしている)

/**
 * http(s) の絶対 URL だけを通す。ここで作るリンクは各サイトのページに
 * 差し込まれるので、javascript: などが混ざってもリンクにしない。
 * @param {unknown} value
 * @returns {string | null}
 */
export function safeHttpUrl(value) {
  if (typeof value !== "string" || value === "") return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * リンク先。url → homepage → repositoryUrl の順で最初にあるもの。
 * @param {{ url?: unknown, homepage?: unknown, repositoryUrl?: unknown }} repo
 * @returns {string | null}
 */
export function pickLink(repo) {
  for (const candidate of [repo.url, repo.homepage, repo.repositoryUrl]) {
    const href = safeHttpUrl(candidate);
    if (href) return href;
  }
  return null;
}

const collator = new Intl.Collator("ja", { numeric: true, sensitivity: "base" });

/**
 * 名前の昇順。/api/starred は更新日順で作業のたびに入れ替わるが、
 * 移動用のメニューで位置が動くと手が覚えられないので固定する。
 * @param {SwitcherItem[]} items
 * @returns {SwitcherItem[]}
 */
export function sortByName(items) {
  return [...items].sort((a, b) => collator.compare(a.name, b.name) || a.id - b.id);
}

/**
 * /api/starred の応答をメニューの項目にする。リンク先の無いものは外す。
 * @param {unknown} json
 * @returns {SwitcherItem[]}
 */
export function toItems(json) {
  const repos = json && typeof json === "object" && "repos" in json ? json.repos : null;
  if (!Array.isArray(repos)) throw new Error("unexpected response");
  /** @type {SwitcherItem[]} */
  const items = [];
  for (const repo of repos) {
    if (!repo || typeof repo !== "object") continue;
    const href = pickLink(repo);
    if (typeof repo.name !== "string" || repo.name === "" || !href) continue;
    items.push({
      id: typeof repo.id === "number" ? repo.id : 0,
      name: repo.name,
      description: typeof repo.description === "string" && repo.description !== "" ? repo.description : null,
      logo: safeHttpUrl(repo.logo),
      href,
    });
  }
  return sortByName(items);
}

/**
 * スキームを除いた「ホスト + パス」。パス末尾のスラッシュは落とす。
 * @param {string} href
 */
function hostAndPath(href) {
  const url = new URL(href);
  return { host: url.host.toLowerCase(), path: url.pathname.replace(/\/+$/, "") };
}

/**
 * location がその項目のサイトの中か。スキームを無視してホスト + パスの前方一致で比べる。
 * GitHub Pages のサイトは同じホストなのでパスまで見る。前方一致はパスの区切りで切る
 * (/carve-daw は /carve-daw-x に一致しない)。
 * @param {string} itemHref
 * @param {string} locationHref
 */
export function matchesLocation(itemHref, locationHref) {
  try {
    const item = hostAndPath(itemHref);
    const here = hostAndPath(locationHref);
    if (item.host === "" || item.host !== here.host) return false;
    return here.path === item.path || here.path.startsWith(`${item.path}/`);
  } catch {
    return false;
  }
}

/**
 * 今いるサイトの項目の添字。複数一致したらパスの長い (より具体的な) 方。
 * @param {SwitcherItem[]} items
 * @param {string} locationHref
 * @returns {number} 無ければ -1
 */
export function findCurrentIndex(items, locationHref) {
  let best = -1;
  let bestLength = -1;
  items.forEach((item, i) => {
    if (!matchesLocation(item.href, locationHref)) return;
    const length = hostAndPath(item.href).path.length;
    if (length > bestLength) {
      best = i;
      bestLength = length;
    }
  });
  return best;
}

/**
 * localStorage の値を読む。形が違えば (版違い・壊れた値) 無かったことにする。
 * @param {string | null} raw
 * @returns {CacheEntry | null}
 */
export function parseCache(raw) {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || data.v !== 1 || typeof data.savedAt !== "number" || !Array.isArray(data.items)) {
      return null;
    }
    const items = data.items.filter(
      /** @param {any} item */
      (item) =>
        item &&
        typeof item.name === "string" &&
        safeHttpUrl(item.href) !== null &&
        (item.logo === null || safeHttpUrl(item.logo) !== null)
    );
    return { savedAt: data.savedAt, items };
  } catch {
    return null;
  }
}

/**
 * @param {SwitcherItem[]} items
 * @param {number} now
 */
export function serializeCache(items, now) {
  return JSON.stringify({ v: 1, savedAt: now, items });
}

/**
 * キャッシュをそのまま使ってよいか (取り直さなくてよいか)。
 * 時計が戻って savedAt が未来になっている場合は古い扱いにする。
 * @param {number} savedAt
 * @param {number} now
 * @param {number} [ttl]
 */
export function isFresh(savedAt, now, ttl = CACHE_TTL_MS) {
  return savedAt <= now && now - savedAt < ttl;
}

/**
 * CSS anchor positioning が使えないときのメニューの位置 (position: fixed 基準)。
 * 右端をボタンに揃えて左下へ開き、画面の外にははみ出さない。
 * @param {{ bottom: number, right: number }} anchor ボタンの getBoundingClientRect()
 * @param {{ width: number, height: number }} viewport
 */
export function placeMenu(anchor, viewport) {
  const width = Math.max(0, Math.min(MENU_WIDTH, viewport.width - VIEWPORT_MARGIN * 2));
  const alignedRight = Math.max(viewport.width - anchor.right, VIEWPORT_MARGIN);
  const right = Math.min(alignedRight, viewport.width - VIEWPORT_MARGIN - width);
  const top = Math.max(anchor.bottom + MENU_GAP, VIEWPORT_MARGIN);
  const maxHeight = Math.max(viewport.height - top - VIEWPORT_MARGIN, 120);
  return { top, right, width, maxHeight };
}

// ---------------------------------------------------------------------------
// 描画

const STYLE = `
:host {
  --_bg: var(--hs-bg, #ffffff);
  --_fg: var(--hs-fg, #1f2328);
  --_muted: var(--hs-muted, #656d76);
  --_border: var(--hs-border, #d0d7de);
  --_accent: var(--hs-accent, #0969da);
  /* ロゴは白地のカード向けに描かれたものが多いので、暗い配色では明るい下地を敷く */
  --_logo-bg: transparent;
  display: inline-flex;
  vertical-align: middle;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :host(:not([theme="light"])) {
    --_bg: var(--hs-bg, #161b22);
    --_fg: var(--hs-fg, #e6edf3);
    --_muted: var(--hs-muted, #9198a1);
    --_border: var(--hs-border, #3d444d);
    --_accent: var(--hs-accent, #4493f8);
    --_logo-bg: #e6edf3;
    color-scheme: dark;
  }
}
:host([theme="dark"]) {
  --_bg: var(--hs-bg, #161b22);
  --_fg: var(--hs-fg, #e6edf3);
  --_muted: var(--hs-muted, #9198a1);
  --_border: var(--hs-border, #3d444d);
  --_accent: var(--hs-accent, #4493f8);
  --_logo-bg: #e6edf3;
  color-scheme: dark;
}
:host([hidden]) { display: none; }
:host([floating]) {
  position: fixed;
  top: max(12px, env(safe-area-inset-top));
  right: max(12px, env(safe-area-inset-right));
  z-index: 2147483000;
}

.button {
  box-sizing: border-box;
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  anchor-name: --hs-button;
}
.button:hover, .button[aria-expanded="true"] {
  background: color-mix(in srgb, currentColor 12%, transparent);
}
.button:focus-visible {
  outline: 2px solid var(--_accent);
  outline-offset: 2px;
}
.button svg { display: block; }
:host([floating]) .button {
  width: 36px;
  height: 36px;
  border: 1px solid var(--_border);
  border-radius: 999px;
  background: var(--_bg);
  color: var(--_fg);
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.12);
}
:host([floating]) .button:hover, :host([floating]) .button[aria-expanded="true"] {
  background: color-mix(in srgb, var(--_fg) 8%, var(--_bg));
}

.menu {
  position: fixed;
  inset: auto;
  box-sizing: border-box;
  width: min(${MENU_WIDTH}px, calc(100vw - ${VIEWPORT_MARGIN * 2}px));
  max-height: var(--hs-max-height, calc(100vh - 64px));
  margin: 0;
  padding: 6px;
  overflow: auto;
  border: 1px solid var(--_border);
  border-radius: 12px;
  background: var(--_bg);
  color: var(--_fg);
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.16), 0 2px 6px rgb(0 0 0 / 0.08);
  font: 400 14px/1.4 system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif;
  font-style: normal;
  text-align: left;
  text-transform: none;
  letter-spacing: normal;
  white-space: normal;
}
/* Popover API の無いブラウザでは出さない (:popover-open を知らなければ下の規則ごと無視される) */
.menu { display: none; }
.menu:popover-open { display: block; }
@supports (anchor-name: --a) {
  .menu {
    position-anchor: --hs-button;
    top: anchor(bottom);
    right: anchor(right);
    margin-top: ${MENU_GAP}px;
    position-try-fallbacks: flip-inline;
  }
}

.heading {
  padding: 4px 10px 6px;
  color: var(--_muted);
  font-size: 12px;
  font-weight: 600;
}
.status {
  margin: 0;
  padding: 10px;
  color: var(--_muted);
}
.item {
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  min-height: 44px;
  padding: 6px 10px;
  border-radius: 8px;
  color: inherit;
  text-decoration: none;
  outline: none;
}
a.item:hover, .item:focus {
  background: color-mix(in srgb, var(--_fg) 8%, transparent);
}
.item:focus-visible {
  outline: 2px solid var(--_accent);
  outline-offset: -2px;
}
.item.current {
  background: color-mix(in srgb, var(--_accent) 10%, transparent);
  cursor: default;
}
.logo {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  overflow: hidden;
  border-radius: 4px;
}
.logo:not(.initial) { background: var(--_logo-bg); }
.logo img { display: block; width: 20px; height: 20px; object-fit: contain; }
.logo.initial {
  background: color-mix(in srgb, var(--_fg) 10%, transparent);
  color: var(--_muted);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}
.text { display: flex; flex-direction: column; min-width: 0; }
.name, .description { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.name { font-weight: 600; }
.description { color: var(--_muted); font-size: 12px; }
.here {
  padding: 1px 8px;
  border: 1px solid currentColor;
  border-radius: 999px;
  color: var(--_accent);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}
.footer {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid var(--_border);
}
.all {
  display: block;
  padding: 8px 10px;
  border-radius: 8px;
  color: var(--_accent);
  font-weight: 600;
  text-decoration: none;
  outline: none;
}
.all:hover, .all:focus { background: color-mix(in srgb, var(--_accent) 10%, transparent); }
.all:focus-visible { outline: 2px solid var(--_accent); outline-offset: -2px; }
`;

const DOTS = [3, 8, 13]
  .flatMap((y) => [3, 8, 13].map((x) => `<circle cx="${x}" cy="${y}" r="1.6"/>`))
  .join("");
const ICON = `<svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true" focusable="false">${DOTS}</svg>`;

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {Document} doc
 * @param {K} tag
 * @param {string} className
 * @param {string} [text]
 */
function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * @param {Document} doc
 * @param {SwitcherItem} item
 */
function renderLogo(doc, item) {
  const initial = () => {
    const box = el(doc, "span", "logo initial", Array.from(item.name)[0] ?? "");
    box.setAttribute("aria-hidden", "true");
    return box;
  };
  if (!item.logo) return initial();
  const box = el(doc, "span", "logo");
  const img = doc.createElement("img");
  img.src = item.logo;
  img.alt = "";
  img.width = 20;
  img.height = 20;
  img.loading = "lazy";
  img.decoding = "async";
  img.addEventListener("error", () => box.replaceWith(initial()), { once: true });
  box.appendChild(img);
  return box;
}

/**
 * @param {Document} doc
 * @param {SwitcherItem} item
 * @param {boolean} current
 */
function renderItem(doc, item, current) {
  /** @type {HTMLElement} */
  let node;
  if (current) {
    // 今いるサイトはリンクにしない
    node = el(doc, "div", "item current");
    node.setAttribute("aria-current", "page");
    node.setAttribute("aria-disabled", "true");
  } else {
    const link = el(doc, "a", "item");
    link.href = item.href;
    node = link;
  }
  node.setAttribute("role", "menuitem");
  node.tabIndex = -1;
  const text = el(doc, "span", "text");
  text.appendChild(el(doc, "span", "name", item.name));
  if (item.description) {
    const description = el(doc, "span", "description", item.description);
    description.title = item.description;
    text.appendChild(description);
  }
  node.appendChild(renderLogo(doc, item));
  node.appendChild(text);
  if (current) node.appendChild(el(doc, "span", "here", "いまここ"));
  return node;
}

/**
 * メニューの中身。ボタンやポップオーバーの仕組みとは切り離してあり、
 * DOM 環境があればこれだけで描画を確かめられる。
 * @param {Document} doc
 * @param {{ items: SwitcherItem[] | null, failed: boolean }} state items が null なら未取得
 * @param {string} locationHref
 * @returns {Node[]}
 */
export function renderMenuContent(doc, state, locationHref) {
  const heading = el(doc, "div", "heading", LABEL);
  heading.setAttribute("aria-hidden", "true");

  const status = el(doc, "p", "status");
  status.setAttribute("role", "status");

  const menu = el(doc, "div", "list");
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", LABEL);

  if (state.items) {
    const current = findCurrentIndex(state.items, locationHref);
    state.items.forEach((item, i) => menu.appendChild(renderItem(doc, item, i === current)));
  } else {
    status.textContent = state.failed ? "読み込めませんでした" : "読み込み中…";
  }

  const footer = el(doc, "div", "footer");
  footer.setAttribute("role", "none");
  const all = el(doc, "a", "all", "すべてのプロジェクト →");
  all.href = ALL_PROJECTS_URL;
  all.setAttribute("role", "menuitem");
  all.tabIndex = -1;
  footer.appendChild(all);
  menu.appendChild(footer);

  return status.textContent ? [heading, status, menu] : [heading, menu];
}

// ---------------------------------------------------------------------------
// データ (同じページの全インスタンスで共有する)

const store = {
  /** @type {SwitcherItem[] | null} */
  items: null,
  savedAt: 0,
  failed: false,
  cacheRead: false,
  /** @type {Promise<void> | null} */
  inflight: null,
  /** @type {Set<() => void>} */
  listeners: new Set(),
};

function notify() {
  for (const listener of store.listeners) {
    try {
      listener();
    } catch {
      // 描画の失敗をホストのページへ漏らさない
    }
  }
}

function readCacheOnce() {
  if (store.cacheRead) return;
  store.cacheRead = true;
  try {
    const entry = parseCache(localStorage.getItem(CACHE_KEY));
    if (entry && !store.items) {
      store.items = entry.items;
      store.savedAt = entry.savedAt;
    }
  } catch {
    // localStorage が使えない環境 (プライベートモード、sandbox の iframe など)
  }
}

/** キャッシュを出せる状態にし、古ければ裏で取り直す (stale-while-revalidate) */
function load() {
  readCacheOnce();
  if (store.inflight) return store.inflight;
  if (store.items && isFresh(store.savedAt, Date.now())) return Promise.resolve();

  const signal = typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(10000) : undefined;
  store.inflight = fetch(API_URL, { mode: "cors", credentials: "omit", signal })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((json) => {
      const items = toItems(json);
      const now = Date.now();
      const changed = JSON.stringify(items) !== JSON.stringify(store.items);
      store.items = items;
      store.savedAt = now;
      store.failed = false;
      try {
        localStorage.setItem(CACHE_KEY, serializeCache(items, now));
      } catch {
        // 保存できなくても表示はできる
      }
      if (changed) notify();
    })
    .catch(() => {
      // キャッシュがあればそれを出し続ける。無ければ失敗の表示にする
      store.failed = true;
      if (!store.items) notify();
    })
    .finally(() => {
      store.inflight = null;
    });
  return store.inflight;
}

// ---------------------------------------------------------------------------
// 要素

function supportsPopover() {
  return typeof HTMLElement !== "undefined" && Object.prototype.hasOwnProperty.call(HTMLElement.prototype, "popover");
}

function supportsAnchor() {
  try {
    return typeof CSS !== "undefined" && CSS.supports("anchor-name: --a");
  } catch {
    return false;
  }
}

/** @param {() => void} fn */
function guard(fn) {
  try {
    fn();
  } catch {
    // ホストのページへ例外を漏らさない
  }
}

function defineElement() {
  if (typeof customElements === "undefined" || typeof HTMLElement === "undefined") return;
  if (customElements.get(TAG_NAME)) return;

  class HashrockSwitcher extends HTMLElement {
    constructor() {
      super();
      const root = this.attachShadow({ mode: "open" });
      const doc = this.ownerDocument;

      const style = doc.createElement("style");
      style.textContent = STYLE;

      const button = el(doc, "button", "button");
      button.type = "button";
      button.innerHTML = ICON;
      button.title = LABEL;
      button.setAttribute("aria-label", LABEL);
      button.setAttribute("aria-haspopup", "menu");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-controls", "hs-menu");
      // popovertarget で開閉する。JS で開閉すると、開いているときにボタンを押したとき
      // 外側クリックとして一度閉じてから開き直してしまう
      button.setAttribute("popovertarget", "hs-menu");

      const menu = el(doc, "div", "menu");
      menu.id = "hs-menu";
      menu.setAttribute("popover", "auto");

      root.append(style, button, menu);
      this.button = button;
      this.menu = menu;
      /** @type {"first" | "last"} 開いたときにどこへフォーカスを置くか */
      this.focusOnOpen = "first";
      this.watching = false;
      this.onStoreChange = () => {
        if (this.isOpen()) this.render();
      };
      this.onViewportChange = () => guard(() => this.position());

      const prefetch = () => guard(() => void load());
      button.addEventListener("pointerenter", prefetch);
      button.addEventListener("focus", prefetch);
      button.addEventListener("click", () => guard(() => this.onButtonClick()));
      button.addEventListener("keydown", (event) => guard(() => this.onButtonKeydown(event)));
      menu.addEventListener("keydown", (event) => guard(() => this.onMenuKeydown(event)));
      menu.addEventListener("click", (event) => guard(() => this.onMenuClick(event)));
      menu.addEventListener("beforetoggle", (event) => guard(() => this.onBeforeToggle(/** @type {ToggleEvent} */ (event))));
      menu.addEventListener("toggle", (event) => guard(() => this.onToggle(/** @type {ToggleEvent} */ (event))));

      // 部品の中 (ボタンとメニュー) で押したキーをホストのページへバブルさせない。
      // Shadow DOM の外から見ると target が <hashrock-switcher> に付け替わるので、
      // ホスト側の「入力欄にフォーカスがあるか」の判定をすり抜け、Backspace で
      // 選択中の図形が消える、1 文字のショートカットが効く、といったことが起きる。
      // shadow root のバブルで止めるので、上のボタンとメニューのキー処理は先に動く。
      // stopPropagation は既定の動作を止めないので、Enter / Space でのリンクやボタンの
      // 操作、Tab でのフォーカス移動、ブラウザによる Esc の light dismiss はそのまま効く。
      // 限界: window / document に capture フェーズ ({ capture: true }) で張った
      // リスナーには、ここより先に届くので止められない。そういうホストは
      // event.composedPath()[0] か、target が <hashrock-switcher> かどうかで見分けること。
      const isolate = (/** @type {Event} */ event) => event.stopPropagation();
      for (const type of ["keydown", "keyup", "keypress"]) root.addEventListener(type, isolate);
    }

    connectedCallback() {
      store.listeners.add(this.onStoreChange);
    }

    disconnectedCallback() {
      store.listeners.delete(this.onStoreChange);
      this.watchViewport(false);
    }

    isOpen() {
      try {
        return this.menu.matches(":popover-open");
      } catch {
        return false;
      }
    }

    onButtonClick() {
      // 開閉そのものは popovertarget に任せる
      this.focusOnOpen = "first";
      // Popover API の無い古いブラウザでは一覧ページへの入口にだけなる
      if (!supportsPopover()) location.href = ALL_PROJECTS_URL;
    }

    /** @param {KeyboardEvent} event */
    onButtonKeydown(event) {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      if (!supportsPopover()) return;
      event.preventDefault();
      this.focusOnOpen = event.key === "ArrowDown" ? "first" : "last";
      if (this.isOpen()) this.focusItem(this.focusOnOpen === "first" ? 0 : -1);
      else this.menu.showPopover();
    }

    /** @param {ToggleEvent} event */
    onBeforeToggle(event) {
      if (event.newState !== "open") return;
      // load() が先にキャッシュを読むので、あればすぐ出せる
      void load();
      this.render();
      this.position();
    }

    /** @param {ToggleEvent} event */
    onToggle(event) {
      const open = event.newState === "open";
      this.button.setAttribute("aria-expanded", String(open));
      this.watchViewport(open);
      if (open) {
        this.focusItem(this.focusOnOpen === "first" ? 0 : -1);
        return;
      }
      // Esc やメニュー内の操作で閉じたらボタンへ戻す。外側の入力欄などを
      // クリックして閉じた場合は、そちらのフォーカスを奪わない
      const root = /** @type {ShadowRoot} */ (this.shadowRoot);
      const active = this.ownerDocument.activeElement;
      const inside = root.activeElement !== null && root.activeElement !== this.button;
      if (inside || active === null || active === this.ownerDocument.body || active === this) {
        this.button.focus({ preventScroll: true });
      }
    }

    /** @param {KeyboardEvent} event */
    onMenuKeydown(event) {
      const items = this.menuItems();
      const root = /** @type {ShadowRoot} */ (this.shadowRoot);
      const index = items.indexOf(/** @type {HTMLElement} */ (root.activeElement));
      switch (event.key) {
        case "ArrowDown":
          this.focusItem(index + 1 < items.length ? index + 1 : 0);
          break;
        case "ArrowUp":
          this.focusItem(index > 0 ? index - 1 : -1);
          break;
        case "Home":
          this.focusItem(0);
          break;
        case "End":
          this.focusItem(-1);
          break;
        case "Tab":
          this.menu.hidePopover();
          break;
        case "Escape":
          // ブラウザの light dismiss でも閉じるが、それに頼らず自分で閉じる
          this.menu.hidePopover();
          break;
        default:
          return;
      }
      event.preventDefault();
    }

    /** @param {MouseEvent} event */
    onMenuClick(event) {
      const target = /** @type {Element} */ (event.target);
      // リンクで移動するときは閉じておく (戻るボタンで開いたまま戻らないように)
      if (target.closest && target.closest("a")) this.menu.hidePopover();
    }

    menuItems() {
      return /** @type {HTMLElement[]} */ (Array.from(this.menu.querySelectorAll('[role="menuitem"]')));
    }

    /** @param {number} index 負なら末尾から */
    focusItem(index) {
      const items = this.menuItems();
      const item = items.at(index);
      if (item) item.focus({ preventScroll: false });
    }

    render() {
      const root = /** @type {ShadowRoot} */ (this.shadowRoot);
      const items = this.menuItems();
      const focused = items.indexOf(/** @type {HTMLElement} */ (root.activeElement));
      this.menu.replaceChildren(
        ...renderMenuContent(this.ownerDocument, { items: store.items, failed: store.failed }, location.href)
      );
      // 裏で取り直して中身が変わっても、フォーカスは同じ位置に残す
      if (focused >= 0) this.focusItem(Math.min(focused, this.menuItems().length - 1));
    }

    position() {
      const rect = this.button.getBoundingClientRect();
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const place = placeMenu(rect, viewport);
      this.menu.style.setProperty("--hs-max-height", `${place.maxHeight}px`);
      if (supportsAnchor()) return;
      this.menu.style.top = `${place.top}px`;
      this.menu.style.right = `${place.right}px`;
    }

    /** @param {boolean} on */
    watchViewport(on) {
      if (on === this.watching) return;
      this.watching = on;
      if (on) {
        window.addEventListener("resize", this.onViewportChange);
        window.addEventListener("scroll", this.onViewportChange, true);
      } else {
        window.removeEventListener("resize", this.onViewportChange);
        window.removeEventListener("scroll", this.onViewportChange, true);
      }
    }
  }

  customElements.define(TAG_NAME, HashrockSwitcher);
}

guard(defineElement);
