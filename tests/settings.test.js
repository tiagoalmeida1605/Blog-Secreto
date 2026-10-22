import test from "node:test";
import assert from "node:assert/strict";

const settingsModule = new URL("../js/settings.js", import.meta.url);
let importId = 0;

function makeEnvironment(initialStorage = null, { unavailable = false, systemLight = false, systemReducedMotion = false } = {}) {
  const elements = new Map();
  const listeners = new Map();
  const attributes = {};
  const media = new Map([
    ["(prefers-color-scheme: light)", { matches: systemLight, addEventListener(type, listener) { this.listener = listener; } }],
    ["(prefers-reduced-motion: reduce)", { matches: systemReducedMotion, addEventListener(type, listener) { this.listener = listener; } }]
  ]);
  class FakeElement {
    constructor(id) {
      this.id = id;
      this.value = "";
      this.checked = false;
      this.textContent = "";
      this.classList = { toggle: (name, force) => { this[`${name}Class`] = force; } };
    }
    addEventListener(type, listener) { this.listeners ??= {}; this.listeners[type] = listener; }
    focus() { this.focused = true; }
    dispatch(type) { this.listeners?.[type]?.({ target: this }); }
  }
  const document = {
    documentElement: { dataset: attributes },
    querySelector(selector) {
      const id = selector.slice(1);
      if (!elements.has(id)) elements.set(id, new FakeElement(id));
      return elements.get(id);
    }
  };
  const localStorage = {
    value: initialStorage,
    getItem() {
      if (unavailable) throw new Error("storage unavailable");
      return this.value;
    },
    setItem(key, value) {
      if (unavailable) throw new Error("storage unavailable");
      this.value = value;
      this.key = key;
    }
  };
  globalThis.document = document;
  globalThis.window = {
    localStorage,
    matchMedia(query) { return media.get(query); },
    addEventListener(type, listener) { listeners.set(type, listener); }
  };
  return { elements, attributes, localStorage, media, listeners };
}

async function initialize(environment) {
  const moduleUrl = new URL(settingsModule.href);
  moduleUrl.searchParams.set("test", String(++importId));
  const settings = await import(moduleUrl.href);
  settings.initSettings();
  return environment;
}

test("loads stored choices, applies them, follows system changes, and restores defaults", async () => {
  const env = makeEnvironment(JSON.stringify({ theme: "light", textSize: "large", reducedMotion: false }), { systemLight: false });
  await initialize(env);
  assert.equal(env.attributes.theme, "light");
  assert.equal(env.attributes.textSize, "large");

  env.elements.get("setting-theme").value = "auto";
  env.elements.get("setting-theme").dispatch("change");
  assert.equal(env.attributes.themeChoice, "auto");
  assert.equal(env.attributes.theme, "dark");
  env.media.get("(prefers-color-scheme: light)").matches = true;
  env.media.get("(prefers-color-scheme: light)").listener();
  assert.equal(env.attributes.theme, "light");

  env.media.get("(prefers-reduced-motion: reduce)").matches = true;
  env.media.get("(prefers-reduced-motion: reduce)").listener();
  assert.equal(env.attributes.reduceMotion, "true");

  env.elements.get("settings-reset").dispatch("click");
  assert.deepEqual(JSON.parse(env.localStorage.value), { theme: "dark", textSize: "normal", reducedMotion: false });
  assert.equal(env.attributes.theme, "dark");
  assert.equal(env.elements.get("setting-theme").focused, true);
});

test("replaces malformed stored settings with defaults", async () => {
  const env = makeEnvironment("{invalid json");
  await initialize(env);
  assert.deepEqual(JSON.parse(env.localStorage.value), { theme: "dark", textSize: "normal", reducedMotion: false });
  assert.equal(env.attributes.theme, "dark");
  assert.equal(env.elements.get("settings-status").textContent, "Preferências inválidas substituídas pelos padrões.");
});

test("keeps controls functional and reports when local storage is unavailable", async () => {
  const env = makeEnvironment(null, { unavailable: true });
  const loggedErrors = [];
  const originalConsoleError = console.error;
  console.error = (...details) => loggedErrors.push(details);
  try {
    await initialize(env);
    assert.match(env.elements.get("settings-status").textContent, /armazenamento local está indisponível/);
    env.elements.get("setting-text-size").value = "large";
    env.elements.get("setting-text-size").dispatch("change");
    assert.equal(env.attributes.textSize, "large");
    assert.equal(env.elements.get("settings-status")["is-errorClass"], true);
    assert.equal(loggedErrors.length, 2);
  } finally {
    console.error = originalConsoleError;
  }
});

test("synchronizes valid preference changes from another tab", async () => {
  const env = makeEnvironment();
  await initialize(env);
  env.listeners.get("storage")({
    key: "bs-settings-v1",
    newValue: JSON.stringify({ theme: "light", textSize: "small", reducedMotion: true })
  });
  assert.equal(env.attributes.theme, "light");
  assert.equal(env.elements.get("setting-text-size").value, "small");
  assert.equal(env.elements.get("setting-reduced-motion").checked, true);
});
