export const APP_MODE = import.meta.env.VITE_APP_MODE ?? 'default';
export const IS_PREVIEW = APP_MODE === 'preview';
