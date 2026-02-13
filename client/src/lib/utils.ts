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

// Live2D 감정 명령 파싱 함수
export function parseEmotionMessage(text: string): {
  emotion: string | null;
  cleanText: string;
} {
  // [emotion] 패턴을 모두 찾는 정규식 (대소문자 무관, 전역 매칭)
  const emotionRegex = /\[([^\]]+)\]/gi;
  const matches = Array.from(text.matchAll(emotionRegex));
  
  if (matches.length > 0) {
    // 첫 번째 매칭된 감정을 사용
    const emotion = matches[0][1].toLowerCase().trim();
    // 모든 [emotion] 패턴을 제거한 텍스트
    const cleanText = text.replace(emotionRegex, '').trim();
    
    return {
      emotion,
      cleanText
    };
  }
  
  return {
    emotion: null,
    cleanText: text
  };
}

// Live2D 지원 감정 목록
export const SUPPORTED_EMOTIONS = [
  'neutral',
  'joy',
  'happy',
  'sad',
  'angry',
  'surprised',
  'fear',
  'disgust',
  'smile',
  'laugh',
  'cry',
  'excited',
  'confused',
  'sleepy'
] as const;

export type EmotionType = typeof SUPPORTED_EMOTIONS[number];

// 감정 유효성 검사
export function isValidEmotion(emotion: string): emotion is EmotionType {
  return SUPPORTED_EMOTIONS.includes(emotion as EmotionType);
}
