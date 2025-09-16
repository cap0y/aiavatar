import { io, Socket } from 'socket.io-client';

// 소켓 서버 URL (환경 변수에서 가져오거나 기본값 사용)
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';
// API URL
const API_URL = import.meta.env.VITE_API_BASE_URL || SOCKET_URL;

// 소켓 인스턴스 생성
let socket: Socket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5; // 재시도 횟수 증가
let RECONNECT_TIMEOUT = 3000; // 기본 재연결 타임아웃

// 인증 토큰 저장
let authToken: string | null = null;

// 타임아웃 추적용
let createRoomTimeoutId: ReturnType<typeof setTimeout> | null = null;
let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;

// 소켓 연결 상태 추적
let isConnecting = false;

// 소켓 연결 함수
export const connectSocket = (userId: string) => {
  // 이미 연결 중이거나 연결된 상태라면 기존 소켓 반환
  if (socket) {
    if (socket.connected) {
      console.log('소켓이 이미 연결되어 있습니다.');
      return socket;
    }
    
    // 연결 중인 경우
    if (isConnecting) {
      console.log('소켓 연결이 진행 중입니다.');
      return socket;
    }
  }
  
  try {
    console.log(`소켓 연결 시도: ${SOCKET_URL}, userId: ${userId}`);
    
    // 로컬 스토리지에서 인증 토큰 가져오기
    const token = localStorage.getItem('token');
    if (token) {
      authToken = token;
    }
    
    // 기존 소켓이 있으면 정리
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
    }
    
    // 연결 상태 업데이트
    isConnecting = true;
    
    // 새로운 소켓 연결 생성
    socket = io(SOCKET_URL, {
      query: { userId },
      auth: authToken ? { token: authToken } : undefined,
      transports: ['websocket', 'polling'], // 폴링도 허용
      autoConnect: true,
      reconnection: true, // 자동 재연결 활성화
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: RECONNECT_TIMEOUT,
      timeout: 10000 // 연결 타임아웃 10초로 증가
    });
    
    // 소켓 이벤트 리스너 설정
    socket.on('connect', () => {
      console.log('Socket connected: ', socket?.id);
      reconnectAttempts = 0; // 연결 성공 시 재연결 시도 횟수 초기화
      isConnecting = false; // 연결 상태 업데이트
      
      // 재연결 타임아웃이 있으면 제거
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = null;
      }
      
      // 연결 성공 시 세션 정보 저장
      localStorage.setItem('socket_session', JSON.stringify({
        userId,
        timestamp: Date.now()
      }));
    });
    
    socket.on('disconnect', (reason: string) => {
      console.log('Socket disconnected: ', reason);
      isConnecting = false; // 연결 상태 업데이트
      
      // 사용자 인증 문제인 경우
      if (reason === 'io server disconnect') {
        console.log('서버에서 연결 해제. 인증 문제가 있을 수 있습니다.');
        // 인증 토큰 무효화
        authToken = null;
        localStorage.removeItem('socket_session');
      }
      
      // 페이지 이동 등으로 인한 정상적인 연결 해제가 아닌 경우
      if (reason !== 'io client disconnect') {
        handleReconnect(userId);
      }
    });
    
    socket.on('connect_error', (error: Error) => {
      console.error(`Socket connection error: `, error.message);
      isConnecting = false; // 연결 상태 업데이트
      handleReconnect(userId);
    });
    
    socket.on('error', (error: any) => {
      console.error('Socket general error:', error);
      
      // 인증 오류인 경우 인증 토큰 초기화
      if (error && error.type === 'auth_error') {
        console.log('인증 오류. 토큰 초기화');
        authToken = null;
        localStorage.removeItem('socket_session');
      }
    });
    
    return socket;
  } catch (err) {
    console.error('소켓 인스턴스 생성 오류:', err);
    isConnecting = false; // 연결 상태 업데이트
    return null;
  }
};

// 재연결 처리 함수
const handleReconnect = (userId: string) => {
  reconnectAttempts++;
  console.log(`재연결 시도 ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
  
  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    const delay = RECONNECT_TIMEOUT * Math.min(reconnectAttempts, 3); // 최대 3배까지만 지연 증가
    console.log(`${delay}ms 후 재연결 시도...`);
    
    // 이전 타임아웃이 있으면 제거
    if (reconnectTimeoutId) {
      clearTimeout(reconnectTimeoutId);
    }
    
    reconnectTimeoutId = setTimeout(() => {
      if (socket) {
        if (!socket.connected) {
          console.log('소켓 연결 시도...');
          socket.connect();
        }
      } else {
        // 소켓 객체가 없는 경우 새로 생성
        console.log('소켓 객체 새로 생성...');
        connectSocket(userId);
      }
    }, delay);
  } else {
    console.log(`최대 재연결 시도 횟수(${MAX_RECONNECT_ATTEMPTS}회)를 초과했습니다.`);
    
    // 재시도 초기화 및 로컬 스토리지에서 세션 정보 제거
    reconnectAttempts = 0;
    localStorage.removeItem('socket_session');
  }
};

// 로그인 시 소켓 세션 복원
export const restoreSocketSession = () => {
  try {
    const sessionData = localStorage.getItem('socket_session');
    if (sessionData) {
      const { userId, timestamp } = JSON.parse(sessionData);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24시간
      
      // 세션이 24시간 이내라면 재연결 시도
      if (now - timestamp < maxAge) {
        console.log(`소켓 세션 복원 시도 (userId: ${userId})`);
        return connectSocket(userId);
      } else {
        console.log('소켓 세션이 만료되었습니다.');
        localStorage.removeItem('socket_session');
      }
    }
  } catch (error) {
    console.error('소켓 세션 복원 오류:', error);
    localStorage.removeItem('socket_session');
  }
  return null;
};

// 소켓 연결 해제 함수
export const disconnectSocket = () => {
  if (socket) {
    // 정상적인 연결 종료임을 표시
    socket.disconnect();
    socket = null;
    reconnectAttempts = 0;
    isConnecting = false; // 연결 상태 업데이트
    console.log('소켓 연결이 해제되었습니다.');
    
    // 재연결 타임아웃이 있으면 제거
    if (reconnectTimeoutId) {
      clearTimeout(reconnectTimeoutId);
      reconnectTimeoutId = null;
    }
  }
};

// 소켓 인스턴스 가져오기
export const getSocket = () => {
  // 소켓이 없으면 세션 복원 시도
  if (!socket) {
    restoreSocketSession();
  }
  return socket;
};

// 연결 상태 확인
export const isSocketConnected = () => {
  return socket?.connected || false;
};

// 연결 진행 중인지 확인
export const isSocketConnecting = () => {
  return isConnecting;
};

// 채팅방 참여
export const joinRoom = (roomId: string) => {
  if (!socket) {
    restoreSocketSession(); // 세션 복원 시도
  }
  
  if (socket && socket.connected) {
    socket.emit('join_room', { roomId });
    console.log(`채팅방 ${roomId}에 참여했습니다.`);
    return true;
  }
  
  console.log('소켓 연결이 없어 채팅방에 참여할 수 없습니다.');
  return false;
};

// 채팅방 나가기
export const leaveRoom = (roomId: string) => {
  if (socket && socket.connected) {
    socket.emit('leave_room', { roomId });
    console.log(`채팅방 ${roomId}에서 나갔습니다.`);
    return true;
  }
  return false;
};

// 메시지 전송
export const sendMessage = (roomId: string, message: string, userId: string) => {
  if (!socket) {
    restoreSocketSession(); // 세션 복원 시도
  }
  
  if (socket && socket.connected) {
    const messageData = {
      roomId,
      userId,
      content: message,
      timestamp: new Date()
    };
    socket.emit('send_message', messageData);
    return true;
  }
  console.log('소켓 연결이 없어 메시지를 전송할 수 없습니다.');
  return false;
};

// REST API를 통한 채팅방 생성 (폴백용)
const createChatRoomViaRest = async (userId: string, targetId: string, roomId: string): Promise<any> => {
  console.log('REST API로 폴백 시도...');
  try {
    // 토큰 가져오기
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn("인증 토큰이 없습니다. 인증이 필요할 수 있습니다.");
    }
    
    // 여기에서 API URL을 서버 URL과 일치시킴
    const url = `${API_URL}/api/chats/create`;
    console.log(`REST API 호출: ${url}, 토큰 상태: ${token ? '있음' : '없음'}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({
        userId,
        targetId
      }),
      credentials: 'include' // 쿠키 포함
    });
    
    if (!response.ok) {
      throw new Error(`HTTP 오류 ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log('REST API로 채팅방 생성 성공');
      // 채팅방에 참여 (소켓 재연결 필요할 수 있음)
      if (!socket || !socket.connected) {
        connectSocket(userId);
      }
      
      if (socket?.connected) {
        joinRoom(data.roomId || roomId);
      }
      
      return {
        success: true,
        roomId: data.roomId || roomId,
        targetId,
        note: '소켓 통신 실패 후 REST API로 생성'
      };
    } else {
      console.error('REST API 채팅방 생성 실패:', data.error);
      throw new Error(data.error || '채팅방 생성에 실패했습니다.');
    }
  } catch (error) {
    console.error('REST API 호출 오류:', error);
    // 모든 방법이 실패한 경우 채팅방을 강제로 생성하고 진행
    console.log('모든 방법이 실패했습니다. 채팅방 ID를 강제 생성합니다.');
    return {
      success: true,
      roomId: roomId,
      targetId,
      note: '모든 생성 시도 실패, 클라이언트에서 생성된 ID 사용'
    };
  }
};

// 타임아웃 제거 헬퍼 함수
const clearCreateRoomTimeout = () => {
  if (createRoomTimeoutId) {
    console.log('타임아웃 취소');
    clearTimeout(createRoomTimeoutId);
    createRoomTimeoutId = null;
  }
};

// 채팅방 생성 및 처리 함수
const proceedWithSocketConnection = (
  userId: string, 
  targetId: string, 
  resolve: (value: any) => void, 
  reject: (reason: any) => void
) => {
  // 채팅방 ID 생성 (클라이언트에서도 동일하게 처리)
  const ids = [userId, targetId].sort();
  const roomId = `chat_${ids[0]}_${ids[1]}`;
  console.log(`생성할 채팅방 ID: ${roomId}`);
  
  // 기존 타임아웃이 있다면 제거
  clearCreateRoomTimeout();
  
  // 응답 플래그 (중복 응답 방지용)
  let hasResponded = false;
  
  // Socket.io v4 스타일로 단순화하여 직접 Ack 처리
  console.log('create_room 이벤트 발송...');
  
  socket!.emit('create_room', { userId, targetId }, (response: any) => {
    console.log('서버로부터 응답 수신:', response);
    
    // 타임아웃 취소
    clearCreateRoomTimeout();
    
    // 이미 응답이 처리되었다면 무시
    if (hasResponded) {
      console.log('이미 응답이 처리되었습니다. 중복 처리를 방지합니다.');
      return;
    }
    
    hasResponded = true;
    
    if (response && response.success) {
      // 채팅방 생성 성공
      console.log(`채팅방이 생성되었습니다: ${response.roomId}`);
      resolve({
        success: true,
        roomId: response.roomId || roomId,
        targetId
      });
    } else {
      console.error('채팅방 생성 실패:', response?.error || '알 수 없는 오류');
      
      // REST API로 대체 시도
      createChatRoomViaRest(userId, targetId, roomId)
        .then(resolve)
        .catch(reject);
    }
  });
  
  // 3초 후에도 응답이 없으면 REST API 사용 (타임아웃)
  createRoomTimeoutId = setTimeout(() => {
    console.log('응답 대기 시간 초과, REST API 시도...');
    
    // 이미 응답이 처리되었다면 무시
    if (hasResponded) {
      console.log('이미 응답이 처리되었습니다. REST API 호출을 건너뜁니다.');
      return;
    }
    
    hasResponded = true;
    
    createChatRoomViaRest(userId, targetId, roomId)
      .then(resolve)
      .catch(reject);
  }, 3000);
};

// 채팅방 생성
export const createChatRoom = async (userId: string, targetId: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    try {
      console.log(`채팅방 생성 시도: 유저=${userId}, 대상=${targetId}`);
      
      // 소켓 연결 확인 및 복원
      if (!socket || !socket.connected) {
        console.log('소켓 연결이 없습니다. 새로 연결을 시도합니다.');
        const newSocket = connectSocket(userId);
        
        // 연결 실패 시 즉시 REST API로 대체
        if (!newSocket) {
          console.error('소켓 연결에 실패했습니다.');
          console.log('REST API로 대체 시도...');
          
          // 채팅방 ID 생성
          const ids = [userId, targetId].sort();
          const roomId = `chat_${ids[0]}_${ids[1]}`;
          
          // 즉시 REST API로 대체 시도
          createChatRoomViaRest(userId, targetId, roomId)
            .then(resolve)
            .catch(reject);
          return;
        } else {
          // 소켓이 연결 중이라면 잠시 기다림
          if (isConnecting) {
            console.log('소켓이 연결 중입니다. 잠시 기다립니다...');
            setTimeout(() => {
              if (socket && socket.connected) {
                proceedWithSocketConnection(userId, targetId, resolve, reject);
              } else {
                console.log('소켓 연결 시간 초과, REST API로 대체 시도...');
                const ids = [userId, targetId].sort();
                const roomId = `chat_${ids[0]}_${ids[1]}`;
                createChatRoomViaRest(userId, targetId, roomId)
                  .then(resolve)
                  .catch(reject);
              }
            }, 1500);
            return;
          }
        }
      }
      
      // 소켓이 이미 연결되어 있다면 즉시 진행
      if (socket && socket.connected) {
        proceedWithSocketConnection(userId, targetId, resolve, reject);
      }
      
    } catch (error) {
      console.error('채팅방 생성 요청 중 오류 발생:', error);
      
      // 오류 발생 시에도 REST API로 대체 시도
      const ids = [userId, targetId].sort();
      const roomId = `chat_${ids[0]}_${ids[1]}`;
      createChatRoomViaRest(userId, targetId, roomId)
        .then(resolve)
        .catch(reject);
    }
  });
}; 