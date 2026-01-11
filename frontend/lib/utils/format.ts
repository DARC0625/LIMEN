/**
 * 포맷팅 유틸리티
 */

/**
 * 바이트를 읽기 쉬운 형식으로 변환
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * 날짜를 읽기 쉬운 형식으로 변환
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) {
    return 'Invalid Date';
  }
  
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) {
    return 'Just now';
  } else if (minutes < 60) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (hours < 24) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (days < 7) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else {
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}

/**
 * 숫자를 천 단위 구분자로 포맷팅
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * 퍼센트 포맷팅
 */
export function formatPercent(value: number, total: number): string {
  if (total === 0) return '0%';
  const percent = (value / total) * 100;
  return `${percent.toFixed(1)}%`;
}

/**
 * 시간을 읽기 쉬운 형식으로 변환
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}초`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0
      ? `${minutes}분 ${remainingSeconds}초`
      : `${minutes}분`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
  }
}

/**
 * 한국어 로케일 날짜 포맷팅
 */
export function formatDateKR(isoString: string): string {
  if (!isoString) return '-';
  try {
    return new Date(isoString).toLocaleString('ko-KR', { 
      timeZone: 'Asia/Seoul', 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  } catch {
    return isoString;
  }
}

/**
 * 상대 시간 포맷팅 (예: "2분 전", "1시간 전")
 */
export function formatRelativeTime(date: Date | string): string {
  if (!date) return '-';
  
  const now = new Date();
  const target = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - target.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 60) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  
  return formatDateKR(target.toISOString());
}

/**
 * 날짜를 간단한 형식으로 변환 (예: "2024-01-14")
 */
export function formatDateSimple(date: Date | string): string {
  if (!date) return '-';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * 시간을 간단한 형식으로 변환 (예: "14:30")
 */
export function formatTimeSimple(date: Date | string): string {
  if (!date) return '-';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  
  return `${hour}:${minute}`;
}




