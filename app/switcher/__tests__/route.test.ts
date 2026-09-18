import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { GET } from "../../routes/switcher/v1.js";

function app() {
  const hono = new Hono();
  hono.get("/switcher/v1.js", ...GET);
  return hono;
}

describe("GET /switcher/v1.js", () => {
  it("can be loaded as a cross-origin module script", async () => {
    const res = await app().request("/switcher/v1.js", { headers: { origin: "https://edane.hashrock.info" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
  });

  it("serves the component source as is", async () => {
    const body = await (await app().request("/switcher/v1.js")).text();
    expect(body).toContain('export const TAG_NAME = "hashrock-switcher"');
    expect(body).toContain("customElements.define");
  });
});
