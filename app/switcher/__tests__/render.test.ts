// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { ALL_PROJECTS_URL, TAG_NAME, renderMenuContent } from "../v1.js";

const items = [
  {
    id: 1,
    name: "carve-daw",
    description: "DAW",
    logo: "https://repos.hashrock.info/logos/1",
    href: "https://hashrock.github.io/carve-daw/",
  },
  { id: 2, name: "ganttpad-cf", description: null, logo: null, href: "http://ganttpad.app/" },
];

function render(state: Parameters<typeof renderMenuContent>[1], href = "https://example.test/") {
  const box = document.createElement("div");
  for (const node of renderMenuContent(document, state, href)) box.appendChild(node);
  return box;
}

describe("renderMenuContent", () => {
  it("lists every project as a link, plus the link to all projects", () => {
    const box = render({ items, failed: false });
    const links = Array.from(box.querySelectorAll("a")).map((a) => [
      (a.querySelector(".name") ?? a).textContent,
      a.getAttribute("href"),
    ]);
    expect(links).toEqual([
      ["carve-daw", "https://hashrock.github.io/carve-daw/"],
      ["ganttpad-cf", "http://ganttpad.app/"],
      ["すべてのプロジェクト →", ALL_PROJECTS_URL],
    ]);
    expect(box.querySelector('[role="menu"]')?.getAttribute("aria-label")).toBe("hashrock のサービス");
    expect(box.querySelectorAll('[role="menuitem"]')).toHaveLength(3);
    const img = box.querySelector("img");
    expect(img?.getAttribute("loading")).toBe("lazy");
    expect(img?.getAttribute("width")).toBe("20");
  });

  it("marks the current site and does not link to it", () => {
    const box = render({ items, failed: false }, "https://ganttpad.app/notes/7");
    const current = box.querySelector('[aria-current="page"]');
    expect(current?.tagName).toBe("DIV");
    expect(current?.textContent).toContain("ganttpad-cf");
    expect(current?.textContent).toContain("いまここ");
    expect(Array.from(box.querySelectorAll("a"), (a) => a.querySelector(".name")?.textContent)).not.toContain("ganttpad-cf");
  });

  it("shows the failure and still offers the link to all projects", () => {
    const box = render({ items: null, failed: true });
    expect(box.querySelector('[role="status"]')?.textContent).toBe("読み込めませんでした");
    const links = Array.from(box.querySelectorAll("a"));
    expect(links.map((a) => a.getAttribute("href"))).toEqual([ALL_PROJECTS_URL]);
  });

  it("shows a loading state before the first response", () => {
    const box = render({ items: null, failed: false });
    expect(box.querySelector('[role="status"]')?.textContent).toBe("読み込み中…");
  });

  it("renders names as text, never as markup", () => {
    const box = render({
      items: [{ id: 3, name: '<img src=x onerror="alert(1)">', description: "<b>x</b>", logo: null, href: "https://x.test/" }],
      failed: false,
    });
    expect(box.querySelectorAll("img, b")).toHaveLength(0);
  });
});

describe("<hashrock-switcher>", () => {
  it("renders an accessible button in its shadow root without fetching", async () => {
    const calls: unknown[] = [];
    globalThis.fetch = ((...args: unknown[]) => {
      calls.push(args);
      return Promise.reject(new Error("offline"));
    }) as typeof fetch;

    const host = document.createElement(TAG_NAME);
    document.body.appendChild(host);
    const button = host.shadowRoot?.querySelector("button");
    expect(button?.getAttribute("aria-label")).toBe("hashrock のサービス");
    expect(button?.getAttribute("title")).toBe("hashrock のサービス");
    expect(button?.getAttribute("aria-haspopup")).toBe("menu");
    expect(button?.getAttribute("aria-expanded")).toBe("false");
    expect(host.shadowRoot?.querySelector("[popover]")?.getAttribute("popover")).toBe("auto");
    // ページ読み込み時には取りに行かない
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toHaveLength(0);
  });

  it("does not throw into the host page when the API is down", async () => {
    globalThis.fetch = (() => Promise.reject(new Error("offline"))) as typeof fetch;
    const host = document.createElement(TAG_NAME);
    document.body.appendChild(host);
    const button = host.shadowRoot!.querySelector("button")!;
    expect(() => button.dispatchEvent(new Event("focus"))).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });
});

/**
 * happy-dom には Popover API が無いので、部品が使う分だけ差し込む。
 * ブラウザの light dismiss (外側クリック・Esc) は真似しない。
 */
function installPopover() {
  const proto = HTMLElement.prototype as any;
  const open = new WeakSet<HTMLElement>();
  const originalMatches = proto.matches;
  const toggle = (el: HTMLElement, newState: "open" | "closed") => {
    el.dispatchEvent(Object.assign(new Event("beforetoggle"), { newState }));
    if (newState === "open") open.add(el);
    else open.delete(el);
    el.dispatchEvent(Object.assign(new Event("toggle"), { newState }));
  };
  Object.defineProperty(proto, "popover", {
    configurable: true,
    get(this: HTMLElement) {
      return this.getAttribute("popover");
    },
  });
  proto.showPopover = function (this: HTMLElement) {
    if (!open.has(this)) toggle(this, "open");
  };
  proto.hidePopover = function (this: HTMLElement) {
    if (open.has(this)) toggle(this, "closed");
  };
  proto.matches = function (this: HTMLElement, selector: string) {
    return selector === ":popover-open" ? open.has(this) : originalMatches.call(this, selector);
  };
  return () => {
    delete proto.popover;
    delete proto.showPopover;
    delete proto.hidePopover;
    proto.matches = originalMatches;
  };
}

describe("<hashrock-switcher> keyboard", () => {
  let uninstall: () => void;
  let host: HTMLElement;
  let root: ShadowRoot;

  beforeEach(async () => {
    uninstall = installPopover();
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            repos: [
              { id: 1, name: "alpha", url: "https://alpha.test/" },
              { id: 2, name: "beta", url: "https://beta.test/" },
            ],
          })
        )
      )) as typeof fetch;
    host = document.createElement(TAG_NAME);
    document.body.appendChild(host);
    root = host.shadowRoot!;
    // フォーカスで先読みさせ、一覧が揃ってから操作する
    root.querySelector("button")!.dispatchEvent(new Event("focus"));
    await new Promise((r) => setTimeout(r, 0));
  });

  afterEach(() => {
    host.remove();
    uninstall();
  });

  const button = () => root.querySelector("button")!;
  const menu = () => root.querySelector<HTMLElement>("[popover]")!;
  const focusedName = () => (root.activeElement?.querySelector(".name") ?? root.activeElement)?.textContent;
  const press = (target: Element, key: string, type = "keydown") =>
    target.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, composed: true, cancelable: true }));

  it("moves through the items with the arrow keys and closes with Esc", () => {
    press(button(), "ArrowDown");
    expect(menu().matches(":popover-open")).toBe(true);
    expect(button().getAttribute("aria-expanded")).toBe("true");
    expect(focusedName()).toBe("alpha");

    press(root.activeElement!, "ArrowDown");
    expect(focusedName()).toBe("beta");
    press(root.activeElement!, "ArrowDown");
    expect(focusedName()).toBe("すべてのプロジェクト →");
    press(root.activeElement!, "ArrowDown");
    expect(focusedName()).toBe("alpha");
    press(root.activeElement!, "ArrowUp");
    expect(focusedName()).toBe("すべてのプロジェクト →");

    press(root.activeElement!, "Escape");
    expect(menu().matches(":popover-open")).toBe(false);
    expect(button().getAttribute("aria-expanded")).toBe("false");
    expect(root.activeElement).toBe(button());
  });

  it("does not let keys pressed inside reach the host page's listeners", () => {
    const seen: string[] = [];
    const record = (event: Event) => seen.push(`${event.type}:${(event as KeyboardEvent).key}`);
    const types = ["keydown", "keyup", "keypress"];
    for (const type of types) {
      document.addEventListener(type, record);
      window.addEventListener(type, record);
      host.addEventListener(type, record);
    }
    try {
      for (const type of types) press(button(), "Backspace", type);
      press(button(), "ArrowDown");
      for (const type of types) {
        press(root.activeElement!, "Backspace", type);
        press(root.activeElement!, "h", type);
      }
      press(root.activeElement!, "ArrowDown");
      press(root.activeElement!, "Escape");
      expect(seen).toEqual([]);

      // 部品の外で押したキーは今までどおりホストへ届く
      press(document.body, "Backspace");
      expect(seen).toEqual(["keydown:Backspace", "keydown:Backspace"]);
    } finally {
      for (const type of types) {
        document.removeEventListener(type, record);
        window.removeEventListener(type, record);
        host.removeEventListener(type, record);
      }
    }
  });

  it("cannot hide keys from capture-phase listeners on window (known limitation)", () => {
    const seen: string[] = [];
    const record = (event: Event) => seen.push((event as KeyboardEvent).key);
    window.addEventListener("keydown", record, { capture: true });
    try {
      press(button(), "Backspace");
      expect(seen).toEqual(["Backspace"]);
    } finally {
      window.removeEventListener("keydown", record, { capture: true });
    }
  });
});
