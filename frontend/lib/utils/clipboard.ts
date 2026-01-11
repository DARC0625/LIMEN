/**
 * Clipboard API 폴리필
 * 
 * navigator.clipboard가 지원되지 않는 브라우저(특히 Firefox, Safari 구버전)를 위한 폴리필
 * 
 * 사용법:
 * import { copyToClipboard } from '@/lib/utils/clipboard';
 * await copyToClipboard('text to copy');
 */

/**
 * 클립보드에 텍스트 복사 (폴리필 포함)
 * 
 * @param text 복사할 텍스트
 * @returns 성공 여부
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // navigator.clipboard가 지원되는 경우 (Chrome, Firefox 63+, Safari 13.1+)
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard.writeText failed, falling back to legacy method:', err);
      // 폴백으로 전환
    }
  }

  // 폴백: execCommand 사용 (구형 브라우저 지원)
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    if (successful) {
      return true;
    } else {
      console.warn('execCommand("copy") failed');
      return false;
    }
  } catch (err) {
    console.error('Clipboard copy failed:', err);
    return false;
  }
}

/**
 * 클립보드에서 텍스트 읽기 (폴리필 포함)
 * 
 * @returns 읽은 텍스트 또는 null
 */
export async function readFromClipboard(): Promise<string | null> {
  // navigator.clipboard가 지원되는 경우
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
    try {
      return await navigator.clipboard.readText();
    } catch (err) {
      console.warn('navigator.clipboard.readText failed:', err);
      return null;
    }
  }

  // 폴백: execCommand 사용 (보안상 제한적)
  // 참고: execCommand('paste')는 사용자 상호작용이 필요하고 보안상 제한이 많음
  console.warn('Clipboard read not supported in this browser');
  return null;
}
