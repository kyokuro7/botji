export const SETTINGS_KEY = 'xagent.settings';

export const DEFAULT_SETTINGS = {
  provider: 'openai',
  baseUrl: '',
  model: 'gpt-4o-mini',
  apiKey: '',
  askFirst: true
};

export const DEFAULT_MODEL = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-5-5'
};

export function loadSettings() {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  } catch (e) {
    // localStorage rusak / diblokir
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (e) {
    return false;
  }
}
