import { Server as HTTPServer } from 'http';
import { Server as IOServer, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { IncomingMessage, ServerResponse } from 'http';

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

// HTTP REST API 핸들러
const handleChatApiRequest = (req: IncomingMessage, res: ServerResponse) => {
  if (req.url !== '/api/chats/create' || req.method !== 'POST') {
    return false; // 다른 엔드포인트는 처리하지 않음
  }
  
  console.log('REST API를 통한 채팅방 생성 요청 수신');
  let body = '';
  
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', () => {
    try {
      console.log(`API 요청 본문: ${body}`);
      const { userId, targetId } = JSON.parse(body);
      console.log(`API 채팅방 생성 요청: userId=${userId}, targetId=${targetId}`);
      
      // 채팅방 생성 또는 기존 채팅방 가져오기
      const { roomId, isNew } = createOrGetChatRoom(userId, targetId);
      
      if (isNew) {
        console.log(`API를 통한 채팅방 생성: ${roomId}`);
      } else {
        console.log(`API를 통한 기존 채팅방 사용: ${roomId}`);
      }
      
      // 응답이 이미 전송되었는지 확인
      if (!res.headersSent) {
        // 성공 응답
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const responseData = { success: true, roomId };
        console.log(`API 응답: ${JSON.stringify(responseData)}`);
        res.end(JSON.stringify(responseData));
      } else {
        console.log('응답이 이미 전송되었습니다. 추가 응답을 보내지 않습니다.');
      }
    } catch (error) {
      console.error(`API 채팅방 생성 오류: ${error}`);
      
      // 응답이 이미 전송되었는지 확인
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        const errorResponse = { success: false, error: '채팅방 생성 실패' };
        console.log(`API 오류 응답: ${JSON.stringify(errorResponse)}`);
        res.end(JSON.stringify(errorResponse));
      } else {
        console.log('응답이 이미 전송되었습니다. 추가 오류 응답을 보내지 않습니다.');
      }
    }
  });
  
  return true; // 이 요청은 처리됨
};

export function setupSocketServer(httpServer: HTTPServer) {
  const io = new IOServer(httpServer, {
    cors: {
      origin: '*', // 개발 환경에서만 사용. 프로덕션에서는 제한해야 함
      methods: ['GET', 'POST']
    }
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

    // 연결 해제
    socket.on('disconnect', () => {
      console.log(`사용자 연결 해제: ${userId}`);
      activeUsers.delete(userId);
    });
    
    // 에러 처리
    socket.on('error', (error) => {
      console.error(`소켓 에러 (${userId}): ${error}`);
    });
  });

  // HTTP 라우트 핸들러 - 채팅방 생성 API (REST API)
  httpServer.on('request', (req: IncomingMessage, res: ServerResponse) => {
    // 채팅 API만 처리하고, 나머지는 Express에 맡김
    if (req.url === '/api/chats/create' && req.method === 'POST') {
      handleChatApiRequest(req, res);
    }
  });

  console.log('소켓 서버 초기화 완료');
  return io;
} 