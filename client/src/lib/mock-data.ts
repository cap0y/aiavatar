// This file contains mock data for demonstration purposes
// In a real application, this would be fetched from APIs

export const mockBookings = [
  {
    id: 1,
    careManagerName: "김미영",
    careManagerImage: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=120&h=120",
    service: "병원 동행",
    date: "2025년 7월 20일 (일)",
    time: "14:00 - 17:00",
    location: "서울 강남구 삼성동",
    status: "confirmed",
    amount: 75000
  },
  {
    id: 2,
    careManagerName: "박정수",
    careManagerImage: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=120&h=120",
    service: "가사 도움",
    date: "2025년 7월 18일 (금)",
    time: "진행 중 - 1시간 30분",
    location: "서울 송파구 잠실동",
    status: "ongoing",
    amount: 69000
  }
];

export const mockMessages = [
  {
    id: 1,
    senderId: 1,
    senderName: "김미영",
    senderImage: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=120&h=120",
    lastMessage: "네, 내일 오후 2시에 병원 동행 가능합니다.",
    timestamp: "방금 전",
    unread: 1
  },
  {
    id: 2,
    senderId: 2,
    senderName: "박정수",
    senderImage: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=120&h=120",
    lastMessage: "서비스 관련해서 궁금한 점이 있으시면 언제든 연락주세요.",
    timestamp: "2시간 전",
    unread: 0
  }
];

export const mockChatMessages = [
  {
    id: 1,
    content: "안녕하세요! 병원 동행 서비스 문의드립니다.",
    sender: "user",
    timestamp: "14:20"
  },
  {
    id: 2,
    content: "네, 안녕하세요! 어떤 병원으로 동행이 필요하신가요?",
    sender: "manager",
    timestamp: "14:22"
  },
  {
    id: 3,
    content: "강남 세브란스병원 정형외과입니다. 내일 오후 2시 예약이에요.",
    sender: "user",
    timestamp: "14:25"
  },
  {
    id: 4,
    content: "네, 내일 오후 2시에 병원 동행 가능합니다. 1시 30분경에 댁으로 방문드리겠습니다.",
    sender: "manager",
    timestamp: "14:27"
  }
];
