// D3: short browser-specific recovery guidance after a microphone denial. Platform from the UA; keys map to i18n.
export type Platform = 'iosSafari' | 'androidChrome' | 'desktopChrome' | 'desktopSafari' | 'firefox' | 'other';
export function platform(ua = navigator.userAgent): Platform {
  const u = ua.toLowerCase();
  const ios = /iphone|ipad|ipod/.test(u) || (/macintosh/.test(u) && navigator.maxTouchPoints > 1);
  if (ios) return 'iosSafari';
  if (/android/.test(u) && /chrome|crios/.test(u)) return 'androidChrome';
  if (/firefox|fxios/.test(u)) return 'firefox';
  if (/edg\/|chrome\//.test(u) && !/opr\//.test(u)) return 'desktopChrome';
  if (/safari/.test(u) && !/chrome/.test(u)) return 'desktopSafari';
  return 'other';
}
