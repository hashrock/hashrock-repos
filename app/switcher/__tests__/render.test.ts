// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
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
