/** App registry: id → title, emoji icon, default size */
export const APPS = {
  finder: {
    id: "finder",
    title: "Finder",
    icon: "📁",
    defaultSize: { w: 560, h: 400 },
  },
  browser: {
    id: "browser",
    title: "Browser",
    icon: "🌐",
    defaultSize: { w: 720, h: 480 },
  },
  notes: {
    id: "notes",
    title: "Notes",
    icon: "📝",
    defaultSize: { w: 440, h: 520 },
  },
  terminal: {
    id: "terminal",
    title: "Terminal",
    icon: "💻",
    defaultSize: { w: 560, h: 360 },
  },
  settings: {
    id: "settings",
    title: "Settings",
    icon: "⚙️",
    defaultSize: { w: 480, h: 420 },
  },
};

export const DESKTOP_ICONS = [
  { appId: "finder", label: "Finder" },
  { appId: "browser", label: "Browser" },
  { appId: "notes", label: "Notes" },
  { appId: "terminal", label: "Terminal" },
  { appId: "settings", label: "Settings" },
];
