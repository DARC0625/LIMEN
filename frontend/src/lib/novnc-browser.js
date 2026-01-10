export function isMac() {
  return typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
}
export function isWindows() {
  return typeof navigator !== 'undefined' && /Win/.test(navigator.platform);
}
export function isIOS() { return false; }
export function isAndroid() { return false; }
export function isSafari() { return false; }
export function isIE() { return false; }
export function isEdge() { return false; }
export function isFirefox() { return false; }
export function isChrome() { return false; } 
export function hasTouch() { return false; }
export const supportsCursorURIs = false;
export const isTouch = false;


