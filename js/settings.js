const STORAGE_KEY = "bs-settings-v1";
const DEFAULTS = Object.freeze({
  theme: "dark",
  textSize: "normal",
  reducedMotion: false
});

const THEME_CHOICES = new Set(["dark", "light", "auto"]);
const TEXT_SIZE_CHOICES = new Set(["small", "normal", "large"]);
const mediaQueries = {};
let preferences = { ...DEFAULTS };
let initialized = false;

const controls = {
  theme: document.querySelector("#setting-theme"),
  textSize: document.querySelector("#setting-text-size"),
  reducedMotion: document.querySelector("#setting-reduced-motion"),
  reset: document.querySelector("#settings-reset"),
  status: document.querySelector("#settings-status")
};

function readPreferences(rawValue) {
  if (typeof rawValue !== "string") return null;
  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    if (!THEME_CHOICES.has(parsed.theme) || !TEXT_SIZE_CHOICES.has(parsed.textSize) || typeof parsed.reducedMotion !== "boolean") {
      return null;
    }
    return {
      theme: parsed.theme,
      textSize: parsed.textSize,
      reducedMotion: parsed.reducedMotion
    };
  } catch {
    return null;
  }
}

function getMediaQuery(name, query) {
  if (mediaQueries[name]) return mediaQueries[name];
  try {
    mediaQueries[name] = window.matchMedia(query);
  } catch (error) {
    console.error(`Não foi possível consultar a preferência do sistema (${name}):`, error);
    mediaQueries[name] = null;
  }
  return mediaQueries[name];
}

function applyPreferences() {
  const systemTheme = getMediaQuery("theme", "(prefers-color-scheme: light)");
  const resolvedTheme = preferences.theme === "auto"
    ? (systemTheme?.matches ? "light" : "dark")
    : preferences.theme;
  const systemReducedMotion = getMediaQuery("motion", "(prefers-reduced-motion: reduce)");
  const reduceMotion = preferences.reducedMotion || Boolean(systemReducedMotion?.matches);

  document.documentElement.dataset.themeChoice = preferences.theme;
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.textSize = preferences.textSize;
  document.documentElement.dataset.reduceMotion = String(reduceMotion);

  controls.theme.value = preferences.theme;
  controls.textSize.value = preferences.textSize;
  controls.reducedMotion.checked = preferences.reducedMotion;
}

function setStatus(message, isError = false) {
  controls.status.textContent = message;
  controls.status.classList.toggle("is-error", isError);
}

function savePreferences(message = "Preferências salvas neste dispositivo.") {
  applyPreferences();
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    setStatus(message);
  } catch (error) {
    console.error("Não foi possível salvar as preferências no armazenamento local:", error);
    setStatus("Não foi possível salvar neste dispositivo. As alterações continuam aplicadas nesta sessão.", true);
  }
}

function handleSystemPreferenceChange() {
  applyPreferences();
}

function handleStorageChange(event) {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  if (event.newValue === null) {
    preferences = { ...DEFAULTS };
    applyPreferences();
    setStatus("Preferências removidas em outra aba; os padrões foram aplicados.");
    return;
  }
  const next = readPreferences(event.newValue);
  if (!next) {
    preferences = { ...DEFAULTS };
    applyPreferences();
    setStatus("As preferências desta outra aba eram inválidas; os padrões foram aplicados.", true);
    return;
  }
  preferences = next;
  applyPreferences();
  setStatus("Preferências atualizadas em outra aba.");
}

export function initSettings() {
  if (initialized) return;
  initialized = true;

  let storedValue = null;
  let storageAvailable = true;
  try {
    storedValue = window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    storageAvailable = false;
    console.error("Não foi possível ler as preferências do armazenamento local:", error);
  }

  if (storedValue !== null) {
    const saved = readPreferences(storedValue);
    if (saved) {
      preferences = saved;
    } else {
      preferences = { ...DEFAULTS };
      setStatus("Preferências inválidas encontradas; os padrões foram aplicados.", true);
      if (storageAvailable) savePreferences("Preferências inválidas substituídas pelos padrões.");
    }
  }

  applyPreferences();
  if (!storageAvailable) {
    setStatus("O armazenamento local está indisponível. As preferências desta sessão ainda funcionam.", true);
  } else if (storedValue === null) {
    setStatus("Preferências padrão aplicadas. As escolhas ficam neste dispositivo.");
  }

  controls.theme.addEventListener("change", () => {
    preferences.theme = controls.theme.value;
    savePreferences();
  });
  controls.textSize.addEventListener("change", () => {
    preferences.textSize = controls.textSize.value;
    savePreferences();
  });
  controls.reducedMotion.addEventListener("change", () => {
    preferences.reducedMotion = controls.reducedMotion.checked;
    savePreferences();
  });
  controls.reset.addEventListener("click", () => {
    preferences = { ...DEFAULTS };
    savePreferences("Padrões restaurados e salvos neste dispositivo.");
    controls.theme.focus();
  });

  const themeQuery = getMediaQuery("theme", "(prefers-color-scheme: light)");
  const motionQuery = getMediaQuery("motion", "(prefers-reduced-motion: reduce)");
  themeQuery?.addEventListener("change", handleSystemPreferenceChange);
  motionQuery?.addEventListener("change", handleSystemPreferenceChange);
  window.addEventListener("storage", handleStorageChange);
}
