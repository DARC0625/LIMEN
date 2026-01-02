/**
 * noVNC browser.js 패치 버전
 * c.isMac과 l.isWindows 문제를 해결하기 위한 패치
 * 
 * 원본: @novnc/novnc/lib/util/browser.js
 * 문제: 번들링 시 c.isMac과 l.isWindows로 변환되어 함수가 아닌 것으로 인식됨
 * 해결: isMac과 isWindows 함수를 항상 함수로 보장
 */

"use strict";

// OS 감지 함수 정의 (항상 함수로 보장)
function isMac() {
  return typeof navigator !== 'undefined' &&
         /Mac/i.test(navigator.platform || navigator.userAgent || '');
}

function isWindows() {
  return typeof navigator !== 'undefined' &&
         /Win/i.test(navigator.platform || navigator.userAgent || '');
}

function isIOS() {
  return typeof navigator !== 'undefined' &&
         (/iPad|iPhone|iPod/i.test(navigator.platform || navigator.userAgent || ''));
}

function isAndroid() {
  return typeof navigator !== 'undefined' &&
         !!navigator.userAgent.match('Android ');
}

function isChromeOS() {
  return typeof navigator !== 'undefined' &&
         !!navigator.userAgent.match(' CrOS ');
}

// Browser detection
function isSafari() {
  return typeof navigator !== 'undefined' &&
         !!navigator.userAgent.match('Safari/...') && 
         !navigator.userAgent.match('Chrome/...') && 
         !navigator.userAgent.match('Chromium/...') && 
         !navigator.userAgent.match('Epiphany/...');
}

function isFirefox() {
  return typeof navigator !== 'undefined' &&
         !!navigator.userAgent.match('Firefox/...') && 
         !navigator.userAgent.match('Seamonkey/...');
}

function isChrome() {
  return typeof navigator !== 'undefined' &&
         !!navigator.userAgent.match('Chrome/...') && 
         !navigator.userAgent.match('Chromium/...') && 
         !navigator.userAgent.match('Edg/...') && 
         !navigator.userAgent.match('OPR/...');
}

function isChromium() {
  return typeof navigator !== 'undefined' &&
         !!navigator.userAgent.match('Chromium/...');
}

function isOpera() {
  return typeof navigator !== 'undefined' &&
         !!navigator.userAgent.match('OPR/...');
}

function isEdge() {
  return typeof navigator !== 'undefined' &&
         !!navigator.userAgent.match('Edg/...');
}

// Engine detection
function isGecko() {
  return typeof navigator !== 'undefined' &&
         !!navigator.userAgent.match('Gecko/...');
}

function isWebKit() {
  return typeof navigator !== 'undefined' &&
         !!navigator.userAgent.match('AppleWebKit/...') && 
         !navigator.userAgent.match('Chrome/...');
}

function isBlink() {
  return typeof navigator !== 'undefined' &&
         !!navigator.userAgent.match('Chrome/...');
}

// Touch detection
var isTouchDevice = 'ontouchstart' in (typeof document !== 'undefined' ? document.documentElement : {}) ||
  (typeof document !== 'undefined' && document.ontouchstart !== undefined) ||
  (typeof navigator !== 'undefined' && (navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0));

if (typeof window !== 'undefined') {
  window.addEventListener('touchstart', function onFirstTouch() {
    isTouchDevice = true;
    window.removeEventListener('touchstart', onFirstTouch, false);
  }, false);
}

// Drag threshold
var dragThreshold = 10 * (typeof window !== 'undefined' && window.devicePixelRatio || 1);

// Cursor URI support (simplified)
var supportsCursorURIs = false;
var hasScrollbarGutter = true;
var supportsWebCodecsH264Decode = false;

// 전역 객체에 c와 l 설정 (번들링 시 참조될 수 있음)
if (typeof window !== 'undefined') {
  if (!window.c) {
    window.c = {};
  }
  Object.defineProperty(window.c, 'isMac', {
    get: function() { return isMac; },
    set: function() {},
    configurable: true,
    enumerable: true,
  });
  
  if (!window.l) {
    window.l = {};
  }
  Object.defineProperty(window.l, 'isWindows', {
    get: function() { return isWindows; },
    set: function() {},
    configurable: true,
    enumerable: true,
  });
}

// CommonJS export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isMac: isMac,
    isWindows: isWindows,
    isIOS: isIOS,
    isAndroid: isAndroid,
    isChromeOS: isChromeOS,
    isSafari: isSafari,
    isFirefox: isFirefox,
    isChrome: isChrome,
    isChromium: isChromium,
    isOpera: isOpera,
    isEdge: isEdge,
    isGecko: isGecko,
    isWebKit: isWebKit,
    isBlink: isBlink,
    isTouchDevice: isTouchDevice,
    dragThreshold: dragThreshold,
    supportsCursorURIs: supportsCursorURIs,
    hasScrollbarGutter: hasScrollbarGutter,
    supportsWebCodecsH264Decode: supportsWebCodecsH264Decode,
    // c와 l 객체도 export (번들링 시 참조될 수 있음)
    c: { isMac: isMac },
    l: { isWindows: isWindows },
  };
  
  // 개별 export도 설정
  module.exports.isMac = isMac;
  module.exports.isWindows = isWindows;
  module.exports.c = { isMac: isMac };
  module.exports.l = { isWindows: isWindows };
}

// ESM export
if (typeof exports !== 'undefined') {
  exports.isMac = isMac;
  exports.isWindows = isWindows;
  exports.isIOS = isIOS;
  exports.isAndroid = isAndroid;
  exports.isChromeOS = isChromeOS;
  exports.isSafari = isSafari;
  exports.isFirefox = isFirefox;
  exports.isChrome = isChrome;
  exports.isChromium = isChromium;
  exports.isOpera = isOpera;
  exports.isEdge = isEdge;
  exports.isGecko = isGecko;
  exports.isWebKit = isWebKit;
  exports.isBlink = isBlink;
  exports.isTouchDevice = isTouchDevice;
  exports.dragThreshold = dragThreshold;
  exports.supportsCursorURIs = supportsCursorURIs;
  exports.hasScrollbarGutter = hasScrollbarGutter;
  exports.supportsWebCodecsH264Decode = supportsWebCodecsH264Decode;
  exports.c = { isMac: isMac };
  exports.l = { isWindows: isWindows };
  exports.default = {
    isMac: isMac,
    isWindows: isWindows,
    isIOS: isIOS,
    isAndroid: isAndroid,
    isChromeOS: isChromeOS,
    isSafari: isSafari,
    isFirefox: isFirefox,
    isChrome: isChrome,
    isChromium: isChromium,
    isOpera: isOpera,
    isEdge: isEdge,
    isGecko: isGecko,
    isWebKit: isWebKit,
    isBlink: isBlink,
    isTouchDevice: isTouchDevice,
    dragThreshold: dragThreshold,
    supportsCursorURIs: supportsCursorURIs,
    hasScrollbarGutter: hasScrollbarGutter,
    supportsWebCodecsH264Decode: supportsWebCodecsH264Decode,
    c: { isMac: isMac },
    l: { isWindows: isWindows },
  };
}






