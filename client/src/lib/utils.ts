import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 날짜를 YYYY년 MM월 DD일 형식으로 포맷팅
 */
export function formatDate(dateString: string | Date): string {
  if (!dateString) return '';
  
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  // 유효하지 않은 날짜인 경우
  if (isNaN(date.getTime())) return '';
  
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/**
 * 시간을 HH:MM 형식으로 포맷팅
 */
export function formatTime(timeString: string): string {
  if (!timeString) return '';
  
  // HH:MM 형식이면 그대로 반환
  if (/^\d{1,2}:\d{2}$/.test(timeString)) {
    return timeString;
  }
  
  // 날짜가 포함된 문자열인 경우 시간만 추출
  try {
    const date = new Date(timeString);
    if (!isNaN(date.getTime())) {
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
  } catch (e) {
    console.error("시간 형식 변환 오류:", e);
  }
  
  return timeString;
}

/**
 * 숫자에 천 단위 콤마 추가
 */
export function formatNumber(num: number | string): string {
  if (num === undefined || num === null) return '0';
  return Number(num).toLocaleString();
}
