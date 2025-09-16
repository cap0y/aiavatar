// @ts-nocheck
import { initializeApp } from "firebase/app";
// @ts-ignore
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  getDocs,
  doc, 
  setDoc,
  onSnapshot,
  serverTimestamp,
  where
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Local declaration to satisfy TypeScript when vite/client types are not present
declare global {
  interface ImportMetaEnv {
    VITE_FIREBASE_API_KEY: string;
    VITE_FIREBASE_AUTH_DOMAIN: string;
    VITE_FIREBASE_PROJECT_ID: string;
    VITE_FIREBASE_STORAGE_BUCKET: string;
    VITE_FIREBASE_MESSAGING_SENDER_ID: string;
    VITE_FIREBASE_APP_ID: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

// Firebase Web SDK 구성 – 환경변수 대신 코드에 직접 명시
// (보안 이슈는 없지만 필요 시 콘솔에서 키를 재발급하여 교체 가능)
const firebaseConfig = {
  apiKey: "AIzaSyDOsUbIc65GEm1D-gzOgZd21BIDB5uMvio",
  authDomain: "aiavata.firebaseapp.com",
  projectId: "aiavata",
  storageBucket: "aiavata.firebasestorage.app",
  messagingSenderId: "745860952539",
  appId: "1:745860952539:web:cea0108676b30b8d98b7fe",
  measurementId: "G-NHLSMT16L9"
};

// Initialize Firebase only once
const app = initializeApp(firebaseConfig);

// 인증 인스턴스 가져오기
export const auth = getAuth(app);

// Firestore 인스턴스 초기화
export const db = getFirestore(app);

// Storage 인스턴스 초기화
export const storage = getStorage(app);

// 인증 상태 지속성 설정 - 로컬 스토리지에 저장
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("Firebase 인증 상태 지속성이 로컬 스토리지로 설정되었습니다.");
  })
  .catch((error) => {
    console.error("인증 상태 지속성 설정 오류:", error);
  });

// 구글 인증 프로바이더 설정
export const googleProvider = new GoogleAuthProvider();

// 구글 프로바이더에 커스텀 파라미터 추가
googleProvider.setCustomParameters({
  // 항상 계정 선택 화면을 표시하도록 설정
  prompt: 'select_account',
  // 새 창이 아닌 현재 창에서 인증하도록 설정
  auth_type: 'reauthenticate'
});

// === 채팅 관련 Firestore 함수 ===

// 이미지 업로드 함수 추가
export const uploadImage = async (file: File, path: string) => {
  try {
    // 이미지 파일 경로 설정
    const storageRef = ref(storage, path);
    
    // 이미지 업로드
    const snapshot = await uploadBytes(storageRef, file);
    
    // 업로드된 이미지의 다운로드 URL 가져오기
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return { success: true, url: downloadURL };
  } catch (error) {
    console.error("이미지 업로드 오류:", error);
    return { success: false, error };
  }
};

// 채팅방 생성 또는 기존 채팅방 가져오기
export const createOrGetChatRoom = async (userId: string, targetId: string) => {
  try {
    // 인증 상태 확인
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("사용자가 인증되지 않았습니다.");
    }

    console.log("현재 인증된 사용자:", currentUser.uid, currentUser.email);
    
    // 두 사용자 ID를 정렬하여 항상 동일한 채팅방 ID가 생성되도록 함
    const ids = [userId, targetId].sort();
    const roomId = `chat_${ids[0]}_${ids[1]}`;
    
    console.log("채팅방 ID 생성:", roomId, "참가자:", ids);
    
    // 채팅방 문서 참조
    const roomRef = doc(db, "chatRooms", roomId);
    
    // 채팅방 정보 설정 (없으면 생성)
    console.log("채팅방 문서 생성 시도...");
    await setDoc(roomRef, {
      participants: ids,
      createdAt: serverTimestamp(),
      lastMessage: null,
      lastActivity: serverTimestamp()
    }, { merge: true });
    
    console.log("채팅방 생성 완료:", roomId);
    return { roomId, success: true };
  } catch (error) {
    console.error("채팅방 생성 오류:", error);
    
    // 구체적인 오류 정보 로깅
    if (error?.code) {
      console.error("Firebase 오류 코드:", error.code);
      console.error("Firebase 오류 메시지:", error.message);
    }
    
    return { success: false, error };
  }
};

// 메시지 전송 (이미지 URL 포함)
export const sendChatMessage = async (roomId: string, content: string, senderId: string, imageUrl?: string) => {
  try {
    // 인증 상태 확인
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("사용자가 인증되지 않았습니다.");
    }

    console.log("메시지 전송 시도:", roomId, content.substring(0, 20) + "...");
    
    // 채팅방의 메시지 컬렉션에 새 메시지 추가
    const messagesRef = collection(db, "chatRooms", roomId, "messages");
    const newMessage = {
      content,
      senderId,
      timestamp: serverTimestamp(),
      read: false
    };
    
    // 이미지 URL이 있으면 추가
    if (imageUrl) {
      newMessage.imageUrl = imageUrl;
    }
    
    console.log("메시지 데이터:", newMessage);
    const docRef = await addDoc(messagesRef, newMessage);
    console.log("메시지 전송 완료:", docRef.id);
    
    // 채팅방 문서가 존재하지 않을 수도 있으므로 try-catch로 감싸기
    try {
      const roomRef = doc(db, "chatRooms", roomId);
      await setDoc(roomRef, {
        lastMessage: imageUrl ? "📷 이미지가 전송되었습니다." : content,
        lastActivity: serverTimestamp(),
        participants: [senderId] // 최소한의 참가자 정보
      }, { merge: true });
      console.log("채팅방 정보 업데이트 완료");
    } catch (roomUpdateError) {
      console.warn("채팅방 정보 업데이트 실패 (메시지 전송은 성공):", roomUpdateError);
    }
    
    return { success: true, messageId: docRef.id };
  } catch (error) {
    console.error("메시지 전송 오류:", error);
    
    // 구체적인 오류 정보 로깅
    if (error?.code) {
      console.error("Firebase 오류 코드:", error.code);
      console.error("Firebase 오류 메시지:", error.message);
    }
    
    return { success: false, error };
  }
};

// 메시지 내역 불러오기
export const getChatMessages = async (roomId: string, messageLimit = 50) => {
  try {
    const messagesRef = collection(db, "chatRooms", roomId, "messages");
    const q = query(messagesRef, orderBy("timestamp"), limit(messageLimit));
    
    const snapshot = await getDocs(q);
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date()
    }));
    
    return { success: true, messages };
  } catch (error) {
    console.error("메시지 내역 조회 오류:", error);
    return { success: false, error };
  }
};

// 실시간 메시지 리스너 설정
export const subscribeToMessages = (roomId: string, callback) => {
  try {
    const messagesRef = collection(db, "chatRooms", roomId, "messages");
    const q = query(messagesRef, orderBy("timestamp"));
    
    // 실시간 리스너 설정 및 반환 (구독 취소용)
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }));
      callback(messages);
    }, (error) => {
      console.error("메시지 리스너 오류:", error);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error("메시지 구독 설정 오류:", error);
    return null;
  }
};

// 사용자의 채팅방 목록 가져오기
export const getUserChatRooms = async (userId: string) => {
  try {
    const roomsRef = collection(db, "chatRooms");
    const q = query(
      roomsRef, 
      where("participants", "array-contains", userId),
      orderBy("lastActivity", "desc")
    );
    
    const snapshot = await getDocs(q);
    const rooms = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return { success: true, rooms };
  } catch (error) {
    console.error("채팅방 목록 조회 오류:", error);
    return { success: false, error };
  }
};

// 메시지 읽음 상태 업데이트
export const markMessagesAsRead = async (roomId: string, userId: string) => {
  try {
    // 특정 사용자가 보낸 메시지가 아니면서 읽지 않은 메시지만 조회
    const messagesRef = collection(db, "chatRooms", roomId, "messages");
    const q = query(
      messagesRef,
      where("senderId", "!=", userId),
      where("read", "==", false)
    );
    
    const snapshot = await getDocs(q);
    
    // 각 메시지를 읽음으로 업데이트
    const updatePromises = snapshot.docs.map(docSnapshot => {
      const messageRef = doc(db, "chatRooms", roomId, "messages", docSnapshot.id);
      return setDoc(messageRef, { read: true }, { merge: true });
    });
    
    await Promise.all(updatePromises);
    return { success: true, updatedCount: updatePromises.length };
  } catch (error) {
    console.error("메시지 읽음 상태 업데이트 오류:", error);
    return { success: false, error };
  }
}; 

// 초기 채팅방 생성 (테스트용)
// export const initializeTestChatRooms = async (userId: string) => {
//   try {
//     // 테스트 사용자 목록 - 실제 사용자 ID와 겹치지 않도록 확실한 접두사 사용
//     const testUsers = [
//       { id: 'test_manager1', name: '김민수 케어 매니저' },
//       { id: 'test_manager2', name: '이지영 케어 매니저' },
//       { id: 'test_manager3', name: '박준호 간호사' },
//     ];
//     
//     console.log("테스트 채팅방 초기화 시작...");
//     console.log("현재 사용자 ID:", userId);
//     
//     // 이전에 생성된 테스트 채팅방 정리 (선택적)
//     // 실제 구현 시에는 Firestore 규칙에 따라 가능하지 않을 수 있음
//     
//     // 각 테스트 사용자와 채팅방 생성
//     const results = [];
//     for (const testUser of testUsers) {
//       try {
//         // 자신과의 채팅방은 건너뜀
//         if (testUser.id === userId) {
//           console.log(`자신과의 채팅방 건너뜀: ${userId}`);
//           continue;
//         }
//         
//         // 채팅방 ID 생성 - 작은 ID가 앞에 오도록 정렬
//         const ids = [userId, testUser.id].sort();
//         const roomId = `chat_${ids[0]}_${ids[1]}`;
//         
//         console.log(`채팅방 생성 시도: ${roomId} - 참가자: ${userId}, ${testUser.id}`);
//         
//         // 채팅방 문서 참조
//         const roomRef = doc(db, "chatRooms", roomId);
//         
//         // 채팅방 정보 설정 - 명확히 배열로 참가자 지정
//         await setDoc(roomRef, {
//           participants: [userId, testUser.id],
//           createdAt: serverTimestamp(),
//           lastMessage: `${testUser.name}님과의 대화방입니다.`,
//           lastActivity: serverTimestamp()
//         });
//         
//         console.log(`채팅방 생성 완료: ${roomId}, 참가자: [${userId}, ${testUser.id}]`);
//         
//         // 초기 메시지 추가
//         const messagesRef = collection(db, "chatRooms", roomId, "messages");
//         
//         // 상대방 메시지
//         await addDoc(messagesRef, {
//           content: `안녕하세요, 저는 ${testUser.name}입니다. 무엇을 도와드릴까요?`,
//           senderId: testUser.id,
//           timestamp: serverTimestamp(),
//           read: false
//         });
//         
//         // 내 메시지
//         await addDoc(messagesRef, {
//           content: `안녕하세요, 상담 문의드립니다.`,
//           senderId: userId,
//           timestamp: serverTimestamp(),
//           read: true
//         });
//         
//         results.push({
//           roomId,
//           success: true
//         });
//       } catch (error) {
//         console.error(`테스트 채팅방 생성 오류 (${testUser.id}):`, error);
//         results.push({
//           userId: testUser.id,
//           success: false,
//           error
//         });
//       }
//     }
//     
//     console.log("테스트 채팅방 초기화 완료:", results);
//     return { success: true, results };
//   } catch (error) {
//     console.error("테스트 채팅방 초기화 오류:", error);
//     return { success: false, error };
//   }
// }; 