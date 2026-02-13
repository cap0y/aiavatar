import { Server as HTTPServer } from 'http';
import { Server as IOServer, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

// 메시지 타입 정의
interface Message {
  id: string;
  roomId: string;
  userId: string;
  content: string;
  timestamp: Date;
}

// 채팅방 타입 정의
interface ChatRoom {
  id: string;
  participants: string[]; // 사용자 ID 목록
  createdAt: Date;
  lastActivity: Date;
}

// 채팅 이벤트 데이터 타입 정의
interface JoinRoomData {
  roomId: string;
}

interface LeaveRoomData {
  roomId: string;
}

interface SendMessageData {
  roomId: string;
  content: string;
  timestamp: string | Date;
}

interface CreateRoomData {
  userId: string;
  targetId: string;
}

// 메시지 저장소 (실제 구현에서는 데이터베이스를 사용해야 합니다)
const messageStore: { [roomId: string]: Message[] } = {};

// 채팅방 저장소 (실제 구현에서는 데이터베이스를 사용해야 합니다)
const chatRoomStore: { [roomId: string]: ChatRoom } = {};

// 활성화된 유저 추적
const activeUsers = new Map<string, string>(); // userId -> socketId

// 음성/영상 채널 참여자 추적
const voiceChannelParticipants = new Map<string, Set<string>>(); // channelId -> Set<userId>
const userSocketMap = new Map<string, Socket>(); // userId -> Socket 객체

// 채팅방 생성 함수 - 소켓과 REST API에서 공통으로 사용
const createOrGetChatRoom = (userId: string, targetId: string): { roomId: string; isNew: boolean } => {
  // 두 사용자 ID를 정렬하여 일관된 채팅방 ID 생성
  const ids = [userId, targetId].sort();
  const roomId = `chat_${ids[0]}_${ids[1]}`;
  
  let isNew = false;
  
  // 이미 존재하는 채팅방인지 확인
  if (!chatRoomStore[roomId]) {
    chatRoomStore[roomId] = {
      id: roomId,
      participants: [userId, targetId],
      createdAt: new Date(),
      lastActivity: new Date()
    };
    isNew = true;
  } else {
    // 마지막 활동 시간 업데이트
    chatRoomStore[roomId].lastActivity = new Date();
  }
  
  return { roomId, isNew };
};

export function setupSocketServer(httpServer: HTTPServer) {
  const io = new IOServer(httpServer, {
    path: '/socket.io',
    cors: {
      origin: '*', // 개발 환경에서만 사용. 프로덕션에서는 제한해야 함
      methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
  });

  console.log('소켓 서버 초기화 중...');

  io.on('connection', (socket: Socket) => {
    const userId = socket.handshake.query.userId as string;
    
    if (!userId) {
      console.log('사용자 ID 없이 연결 시도. 연결 거부');
      socket.disconnect();
      return;
    }
    
    console.log(`사용자 연결: ${userId}, 소켓 ID: ${socket.id}`);
    activeUsers.set(userId, socket.id);
    userSocketMap.set(userId, socket);

    // 채팅방 생성
    socket.on('create_room', (data: CreateRoomData, callback) => {
      console.log(`채팅방 생성 요청 수신: userId=${data.userId}, targetId=${data.targetId}, 콜백 함수 유무=${callback ? '있음' : '없음'}`);
      
      try {
        const { userId, targetId } = data;
        
        // 채팅방 생성 또는 기존 채팅방 가져오기
        const { roomId, isNew } = createOrGetChatRoom(userId, targetId);
        
        if (isNew) {
          console.log(`새 채팅방 생성: ${roomId}, 참여자: ${userId}, ${targetId}`);
        } else {
          console.log(`기존 채팅방 사용: ${roomId}`);
        }
        
        // 채팅방 참여
        socket.join(roomId);
        
        // 성공 응답 - Socket.io v4 스타일 단순화
        if (typeof callback === 'function') {
          console.log(`채팅방 ${roomId} 생성 성공, 콜백 호출 준비`);
          try {
            callback({
              success: true,
              roomId,
              message: '채팅방이 성공적으로 생성되었습니다.'
            });
            console.log(`채팅방 ${roomId} 콜백 호출 완료`);
          } catch (callbackError) {
            console.error(`콜백 실행 오류: ${callbackError}`);
          }
        } else {
          console.log('콜백 함수가 제공되지 않았습니다');
        }
      } catch (error) {
        console.error(`채팅방 생성 오류: ${error}`);
        if (typeof callback === 'function') {
          try {
            callback({
              success: false,
              error: '채팅방 생성에 실패했습니다',
              details: error instanceof Error ? error.message : '알 수 없는 오류'
            });
          } catch (callbackError) {
            console.error(`오류 콜백 실행 오류: ${callbackError}`);
          }
        }
      }
    });

    // 채팅방 참여
    socket.on('join_room', (data: JoinRoomData) => {
      const { roomId } = data;
      console.log(`사용자 ${userId}가 채팅방 ${roomId}에 참여했습니다.`);
      socket.join(roomId);
      
      // 채팅방이 존재하는 경우에만 활동 시간 업데이트
      if (chatRoomStore[roomId]) {
        chatRoomStore[roomId].lastActivity = new Date();
      }
      
      // 이전 메시지 전송
      if (messageStore[roomId]) {
        socket.emit('previous_messages', messageStore[roomId]);
      }
    });

    // 채팅방 나가기
    socket.on('leave_room', (data: LeaveRoomData) => {
      const { roomId } = data;
      console.log(`사용자 ${userId}가 채팅방 ${roomId}에서 나갔습니다.`);
      socket.leave(roomId);
    });

    // 메시지 전송
    socket.on('send_message', (data: SendMessageData) => {
      const { roomId, content, timestamp } = data;
      console.log(`메시지 수신: ${content} (${roomId})`);
      
      // 메시지 객체 생성
      const message: Message = {
        id: uuidv4(),
        roomId,
        userId,
        content,
        timestamp: new Date(timestamp)
      };
      
      // 메시지 저장
      if (!messageStore[roomId]) {
        messageStore[roomId] = [];
      }
      messageStore[roomId].push(message);
      
      // 채팅방이 존재하는 경우 마지막 활동 시간 업데이트
      if (chatRoomStore[roomId]) {
        chatRoomStore[roomId].lastActivity = new Date();
      }
      
      // 같은 채팅방에 있는 모든 사용자에게 메시지 전달
      io.to(roomId).emit('receive_message', message);
    });

    // WebRTC 시그널링 이벤트들
    
    // 음성/영상 채널 참여
    socket.on('join_voice_channel', (data: { channelId: string; userName: string; photoURL?: string }) => {
      const { channelId, userName, photoURL } = data;
      console.log(`🎤 ${userName} (${userId})가 음성/영상 채널 ${channelId}에 참여`);
      
      // 채널에 참여자 추가
      if (!voiceChannelParticipants.has(channelId)) {
        voiceChannelParticipants.set(channelId, new Set());
      }
      voiceChannelParticipants.get(channelId)!.add(userId);
      
      // 소켓을 채널 룸에 추가
      socket.join(`voice-${channelId}`);
      
      // 기존 참여자들에게 새 참여자 알림
      socket.to(`voice-${channelId}`).emit('user_joined_channel', {
        userId,
        userName,
        photoURL
      });
      
      // 새 참여자에게 현재 참여자 목록 전송
      const participants = Array.from(voiceChannelParticipants.get(channelId) || []);
      socket.emit('channel_participants', {
        channelId,
        participants: participants.filter(id => id !== userId) // 자신은 제외
      });
      
      // 모든 클라이언트에게 채널별 참여자 수 브로드캐스트
      const channelCounts: { [channelId: string]: number } = {};
      voiceChannelParticipants.forEach((participants, chanId) => {
        channelCounts[chanId] = participants.size;
      });
      io.emit('voice_channel_counts', channelCounts);
      
      console.log(`📊 채널 ${channelId} 현재 참여자: ${participants.length}명`);
    });
    
    // 음성/영상 채널 나가기
    socket.on('leave_voice_channel', (data: { channelId: string }) => {
      const { channelId } = data;
      console.log(`👋 ${userId}가 음성/영상 채널 ${channelId}에서 나감`);
      
      // 채널에서 참여자 제거
      if (voiceChannelParticipants.has(channelId)) {
        voiceChannelParticipants.get(channelId)!.delete(userId);
        
        // 참여자가 없으면 채널 삭제
        if (voiceChannelParticipants.get(channelId)!.size === 0) {
          voiceChannelParticipants.delete(channelId);
        }
      }
      
      // 소켓을 채널 룸에서 제거
      socket.leave(`voice-${channelId}`);
      
      // 다른 참여자들에게 알림
      socket.to(`voice-${channelId}`).emit('user_left_channel', {
        userId
      });
      
      // 모든 클라이언트에게 채널별 참여자 수 브로드캐스트
      const channelCounts: { [channelId: string]: number } = {};
      voiceChannelParticipants.forEach((participants, chanId) => {
        channelCounts[chanId] = participants.size;
      });
      io.emit('voice_channel_counts', channelCounts);
    });
    
    // WebRTC Offer 전송
    socket.on('webrtc_offer', (data: { channelId: string; targetUserId: string; offer: any }) => {
      const { channelId, targetUserId, offer } = data;
      console.log(`📤 WebRTC Offer: ${userId} -> ${targetUserId}`);
      
      // 대상 사용자의 소켓 찾기
      const targetSocket = userSocketMap.get(targetUserId);
      if (targetSocket) {
        targetSocket.emit('webrtc_offer', {
          channelId,
          fromUserId: userId,
          offer
        });
      } else {
        console.log(`⚠️ 대상 사용자 ${targetUserId}를 찾을 수 없음`);
      }
    });
    
    // WebRTC Answer 전송
    socket.on('webrtc_answer', (data: { channelId: string; targetUserId: string; answer: any }) => {
      const { channelId, targetUserId, answer } = data;
      console.log(`📥 WebRTC Answer: ${userId} -> ${targetUserId}`);
      
      // 대상 사용자의 소켓 찾기
      const targetSocket = userSocketMap.get(targetUserId);
      if (targetSocket) {
        targetSocket.emit('webrtc_answer', {
          channelId,
          fromUserId: userId,
          answer
        });
      } else {
        console.log(`⚠️ 대상 사용자 ${targetUserId}를 찾을 수 없음`);
      }
    });
    
    // ICE Candidate 전송
    socket.on('webrtc_ice_candidate', (data: { channelId: string; targetUserId: string; candidate: any }) => {
      const { channelId, targetUserId, candidate } = data;
      console.log(`🧊 ICE Candidate: ${userId} -> ${targetUserId}`);
      
      // 대상 사용자의 소켓 찾기
      const targetSocket = userSocketMap.get(targetUserId);
      if (targetSocket) {
        targetSocket.emit('webrtc_ice_candidate', {
          channelId,
          fromUserId: userId,
          candidate
        });
      }
    });
    
    // 연결 해제
    socket.on('disconnect', () => {
      console.log(`사용자 연결 해제: ${userId}`);
      activeUsers.delete(userId);
      userSocketMap.delete(userId);
      
      // 모든 음성/영상 채널에서 제거
      let channelChanged = false;
      voiceChannelParticipants.forEach((participants, channelId) => {
        if (participants.has(userId)) {
          participants.delete(userId);
          channelChanged = true;
          
          // 다른 참여자들에게 알림
          io.to(`voice-${channelId}`).emit('user_left_channel', {
            userId
          });
          
          // 참여자가 없으면 채널 삭제
          if (participants.size === 0) {
            voiceChannelParticipants.delete(channelId);
          }
        }
      });
      
      // 채널에 변경이 있으면 참여자 수 브로드캐스트
      if (channelChanged) {
        const channelCounts: { [channelId: string]: number } = {};
        voiceChannelParticipants.forEach((participants, chanId) => {
          channelCounts[chanId] = participants.size;
        });
        io.emit('voice_channel_counts', channelCounts);
      }
    });
    
    // 에러 처리
    socket.on('error', (error) => {
      console.error(`소켓 에러 (${userId}): ${error}`);
    });
  });

  console.log('소켓 서버 초기화 완료');
  return io;
} 