// This file contains mock data for demonstration purposes
// In a real application, this would be fetched from APIs

export const mockBookings = [
  {
    id: 1,
    careManagerName: "아이린",
    careManagerImage: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=120&h=120",
    service: "대화 상담",
    date: "2025년 7월 20일 (일)",
    time: "14:00 - 17:00",
    location: "온라인 세션",
    status: "confirmed",
    amount: 45000
  },
  {
    id: 2,
    careManagerName: "루나",
    careManagerImage: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=120&h=120",
    service: "엔터테인먼트",
    date: "2025년 7월 18일 (금)",
    time: "진행 중 - 1시간 30분",
    location: "VR 채팅룸",
    status: "ongoing",
    amount: 35000
  }
];

export const mockMessages = [
  {
    id: 1,
    senderId: 1,
    senderName: "아이린",
    senderImage: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=120&h=120",
    lastMessage: "네, 내일 오후 2시에 대화 세션 가능합니다.",
    timestamp: "방금 전",
    unread: 1
  },
  {
    id: 2,
    senderId: 2,
    senderName: "루나",
    senderImage: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=120&h=120",
    lastMessage: "AI 서비스 관련해서 궁금한 점이 있으시면 언제든 연락주세요.",
    timestamp: "2시간 전",
    unread: 0
  }
];

export const mockChatMessages = [
  {
    id: 1,
    content: "안녕하세요! AI 아바타 대화 서비스 문의드립니다.",
    sender: "user",
    timestamp: "14:20"
  },
  {
    id: 2,
    content: "안녕하세요! 저는 AI 아바타 아이린입니다. 어떤 도움이 필요하신가요?",
    sender: "manager",
    timestamp: "14:22"
  },
  {
    id: 3,
    content: "스트레스 상담이나 일상 대화를 나누고 싶어요. 내일 오후 2시에 가능한가요?",
    sender: "user",
    timestamp: "14:25"
  },
  {
    id: 4,
    content: "네, 내일 오후 2시에 대화 세션이 가능합니다. 편안한 분위기에서 이야기를 나누어 보아요!",
    sender: "manager",
    timestamp: "14:27"
  }
];

// 기존 목업 데이터 유지 (아바타 관련 데이터 제거)

// 다른 목업 데이터가 있다면 유지
