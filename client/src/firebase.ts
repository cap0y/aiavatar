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
  getDoc,
  onSnapshot,
  serverTimestamp,
  where,
  writeBatch,
  updateDoc,
  deleteDoc
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
    // userId 유효성 확인
    if (!userId) {
      throw new Error("사용자 ID가 필요합니다.");
    }

    console.log("채팅방 생성 요청 - 사용자 ID:", userId);
    
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

// 메시지 전송 (이미지 URL, 답글 포함)
export const sendChatMessage = async (
  roomId: string, 
  content: string, 
  senderId: string, 
  imageUrl?: string, 
  replyTo?: string,
  senderName?: string,
  senderPhotoURL?: string
) => {
  try {
    // senderId 유효성 확인
    if (!senderId) {
      throw new Error("사용자 ID가 필요합니다.");
    }

    console.log("메시지 전송 시도:", roomId, content.substring(0, 20) + "...");
    
    // 사용자 정보: 파라미터로 받은 값 우선, 없으면 Firebase auth에서 가져오기
    let finalSenderName = senderName;
    let finalPhotoURL = senderPhotoURL;
    
    if (!finalSenderName || !finalPhotoURL) {
      const currentUser = auth.currentUser;
      if (!finalSenderName) {
        finalSenderName = currentUser?.displayName || currentUser?.email || '사용자';
      }
      if (!finalPhotoURL) {
        finalPhotoURL = currentUser?.photoURL || null;
      }
    }
    
    console.log("💾 저장할 사용자 정보:", { 
      senderId, 
      senderName: finalSenderName, 
      photoURL: finalPhotoURL 
    });
    
    // 채팅방의 메시지 컬렉션에 새 메시지 추가
    const messagesRef = collection(db, "chatRooms", roomId, "messages");
    const newMessage = {
      content,
      senderId,
      senderName: finalSenderName,
      photoURL: finalPhotoURL,
      timestamp: serverTimestamp(),
      read: false,
      reactions: {}, // 빈 반응 객체
      isDeleted: false // 삭제 상태
    };
    
    // 이미지 URL이 있으면 추가
    if (imageUrl) {
      newMessage.imageUrl = imageUrl;
    }
    
    // 답글 대상이 있으면 추가
    if (replyTo) {
      newMessage.replyTo = replyTo;
      console.log("📝 Firebase에 답글 정보 저장:", { replyTo, messageContent: content });
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

// 메시지에 반응 추가/제거
export const updateMessageReaction = async (roomId: string, messageId: string, emoji: string, userId: string, isAdd: boolean) => {
  try {
    const messageRef = doc(db, "chatRooms", roomId, "messages", messageId);
    
    // 현재 메시지 데이터 가져오기
    const messageDoc = await getDoc(messageRef);
    if (!messageDoc.exists()) {
      throw new Error("메시지를 찾을 수 없습니다.");
    }
    
    const messageData = messageDoc.data();
    const reactions = { ...(messageData.reactions || {}) };
    const userReactions = reactions[emoji] || [];
    
    if (isAdd && !userReactions.includes(userId)) {
      // 반응 추가
      reactions[emoji] = [...userReactions, userId];
    } else if (!isAdd && userReactions.includes(userId)) {
      // 반응 제거
      reactions[emoji] = userReactions.filter(uid => uid !== userId);
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    }
    
    await setDoc(messageRef, { reactions }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error("반응 업데이트 오류:", error);
    return { success: false, error };
  }
};

// 메시지 삭제 (소프트 삭제)
export const deleteMessage = async (roomId: string, messageId: string, userId: string) => {
  try {
    const messageRef = doc(db, "chatRooms", roomId, "messages", messageId);
    
    // 메시지 소유자 확인
    const messageDoc = await getDoc(messageRef);
    if (!messageDoc.exists()) {
      throw new Error("메시지를 찾을 수 없습니다.");
    }
    
    const messageData = messageDoc.data();
    if (messageData.senderId !== userId) {
      throw new Error("메시지 삭제 권한이 없습니다.");
    }
    
    await setDoc(messageRef, { 
      content: "삭제된 메시지입니다.",
      isDeleted: true 
    }, { merge: true });
    
    return { success: true };
  } catch (error) {
    console.error("메시지 삭제 오류:", error);
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

// ===== 친구 시스템 =====

import { Friend, FriendRequest, UserPresence } from '@/types/friend';

// 사용자 정보를 Firestore에 저장/업데이트
export const saveUserToFirestore = async (user: {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}) => {
  try {
    if (!user.uid || !user.email) {
      console.warn("사용자 정보 저장 실패: uid 또는 email이 없습니다.", user);
      return { success: false, error: "필수 정보가 없습니다." };
    }

    const userRef = doc(db, "users", user.uid);
    const userData: any = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email.split('@')[0],
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(), // 새 사용자인 경우에만 설정됨
    };

    // photoURL이 있는 경우에만 추가 (undefined 방지)
    if (user.photoURL !== undefined && user.photoURL !== null) {
      userData.photoURL = user.photoURL;
    }

    // merge: true로 설정하여 기존 데이터는 유지하고 새로운 데이터만 업데이트
    await setDoc(userRef, userData, { merge: true });
    
    console.log("사용자 정보 Firestore 저장 완료:", userData);
    return { success: true };
  } catch (error) {
    console.error("Firestore 사용자 정보 저장 오류:", error);
    return { success: false, error };
  }
};

// 친구 요청 보내기
export const sendFriendRequest = async (fromUserId: string, toUserEmail: string, message?: string) => {
  try {
    console.log("친구 요청 전송 시작:", { fromUserId, toUserEmail });

    // 현재 로그인된 사용자 정보 먼저 Firestore에 저장 (없으면)
    const currentUser = auth.currentUser;
    if (currentUser) {
      console.log("📝 현재 사용자 정보 Firestore 저장 확인");
      await saveUserToFirestore({
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL
      });
    }

    // 이메일로 사용자 찾기
    const usersQuery = query(
      collection(db, "users"),
      where("email", "==", toUserEmail)
    );
    console.log("🔍 Firestore에서 사용자 검색 중:", toUserEmail);
    
    const usersSnapshot = await getDocs(usersQuery);
    console.log("📊 검색 결과:", {
      isEmpty: usersSnapshot.empty,
      size: usersSnapshot.size,
      docs: usersSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }))
    });
    
    if (usersSnapshot.empty) {
      console.error("❌ 사용자 검색 실패. Firestore users 컬렉션 확인 필요");
      
      // 전체 users 컬렉션 확인 (디버깅용)
      const allUsersQuery = query(collection(db, "users"));
      const allUsersSnapshot = await getDocs(allUsersQuery);
      console.log("📋 전체 사용자 목록:", {
        totalUsers: allUsersSnapshot.size,
        users: allUsersSnapshot.docs.map(doc => ({ 
          id: doc.id, 
          email: doc.data().email,
          displayName: doc.data().displayName 
        }))
      });
      
      return { success: false, error: "해당 이메일의 사용자를 찾을 수 없습니다. 해당 사용자가 한 번 로그인해야 합니다." };
    }

    const toUserDoc = usersSnapshot.docs[0];
    const toUserId = toUserDoc.id;
    const toUserData = toUserDoc.data();

    // 자기 자신에게 요청하는지 확인
    if (fromUserId === toUserId) {
      return { success: false, error: "자기 자신에게는 친구 요청을 보낼 수 없습니다." };
    }

    // 이미 친구인지 확인
    const friendshipQuery = query(
      collection(db, "friendships"),
      where("participants", "array-contains", fromUserId)
    );
    const friendshipSnapshot = await getDocs(friendshipQuery);
    
    const existingFriendship = friendshipSnapshot.docs.find(doc => 
      doc.data().participants.includes(toUserId)
    );

    if (existingFriendship) {
      return { success: false, error: "이미 친구입니다." };
    }

    // 이미 친구 요청이 있는지 확인
    const requestQuery = query(
      collection(db, "friendRequests"),
      where("fromUserId", "==", fromUserId),
      where("toUserId", "==", toUserId),
      where("status", "==", "pending")
    );
    const requestSnapshot = await getDocs(requestQuery);

    if (!requestSnapshot.empty) {
      return { success: false, error: "이미 친구 요청을 보냈습니다." };
    }

    // 반대 방향 요청 확인
    const reverseRequestQuery = query(
      collection(db, "friendRequests"),
      where("fromUserId", "==", toUserId),
      where("toUserId", "==", fromUserId),
      where("status", "==", "pending")
    );
    const reverseRequestSnapshot = await getDocs(reverseRequestQuery);

    if (!reverseRequestSnapshot.empty) {
      return { success: false, error: "해당 사용자가 이미 당신에게 친구 요청을 보냈습니다." };
    }

    // 현재 사용자 정보 가져오기
    const fromUserDoc = await getDoc(doc(db, "users", fromUserId));
    const fromUserData = fromUserDoc.data();

    // 친구 요청 생성
    const friendRequestRef = doc(collection(db, "friendRequests"));
    const friendRequest: FriendRequest = {
      id: friendRequestRef.id,
      fromUserId,
      toUserId,
      fromUserName: fromUserData?.displayName || "알 수 없는 사용자",
      fromUserPhoto: fromUserData?.photoURL || null,
      toUserName: toUserData?.displayName || "알 수 없는 사용자",
      toUserPhoto: toUserData?.photoURL || null,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(message && { message }) // message가 있을 때만 포함
    };

    await setDoc(friendRequestRef, friendRequest);

    console.log("친구 요청 전송 완료:", friendRequest);
    return { success: true, request: friendRequest };
  } catch (error) {
    console.error("친구 요청 전송 오류:", error);
    return { success: false, error };
  }
};

// 받은 친구 요청 목록 조회
export const getPendingFriendRequests = async (userId: string) => {
  try {
    const q = query(
      collection(db, "friendRequests"),
      where("toUserId", "==", userId),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
    );
    
    const snapshot = await getDocs(q);
    const requests = snapshot.docs.map(doc => doc.data() as FriendRequest);
    
    return { success: true, requests };
  } catch (error) {
    console.error("친구 요청 조회 오류:", error);
    return { success: false, error, requests: [] };
  }
};

// 친구 요청 응답 (수락/거절)
export const respondToFriendRequest = async (requestId: string, response: 'accepted' | 'rejected') => {
  try {
    const requestRef = doc(db, "friendRequests", requestId);
    const requestDoc = await getDoc(requestRef);
    
    if (!requestDoc.exists()) {
      return { success: false, error: "친구 요청을 찾을 수 없습니다." };
    }

    const requestData = requestDoc.data() as FriendRequest;

    // 요청 상태 업데이트
    await updateDoc(requestRef, {
      status: response,
      updatedAt: new Date().toISOString()
    });

    // 수락한 경우 친구 관계 생성
    if (response === 'accepted') {
      const friendshipRef = doc(collection(db, "friendships"));
      await setDoc(friendshipRef, {
        id: friendshipRef.id,
        participants: [requestData.fromUserId, requestData.toUserId],
        createdAt: new Date().toISOString(),
        status: 'active'
      });

      // 양쪽 사용자의 친구 목록에 추가
      const batch = writeBatch(db);
      
      // 요청 보낸 사용자의 친구 목록에 추가 (친구의 UID를 문서 ID로 사용)
      const fromUserFriendRef = doc(db, "users", requestData.fromUserId, "friends", requestData.toUserId);
      batch.set(fromUserFriendRef, {
        uid: requestData.toUserId,
        displayName: requestData.toUserName,
        photoURL: requestData.toUserPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(requestData.toUserName)}&background=6366f1&color=fff&size=96`,
        email: requestData.toUserName, // 이메일 정보가 없으면 이름 사용
        addedAt: new Date().toISOString(),
        isOnline: false,
        lastSeen: new Date().toISOString(),
        status: 'offline'
      });

      // 요청 받은 사용자의 친구 목록에 추가 (요청자의 UID를 문서 ID로 사용)
      const toUserFriendRef = doc(db, "users", requestData.toUserId, "friends", requestData.fromUserId);
      batch.set(toUserFriendRef, {
        uid: requestData.fromUserId,
        displayName: requestData.fromUserName,
        photoURL: requestData.fromUserPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(requestData.fromUserName)}&background=6366f1&color=fff&size=96`,
        email: requestData.fromUserName, // 이메일 정보가 없으면 이름 사용
        addedAt: new Date().toISOString(),
        isOnline: false,
        lastSeen: new Date().toISOString(),
        status: 'offline'
      });

      await batch.commit();
    }

    return { success: true };
  } catch (error) {
    console.error("친구 요청 응답 오류:", error);
    return { success: false, error };
  }
};

// 친구 목록 조회
export const getFriends = async (userId: string) => {
  try {
    const friendsQuery = query(
      collection(db, "users", userId, "friends"),
      orderBy("displayName")
    );
    
    const snapshot = await getDocs(friendsQuery);
    const friends = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Friend));

    return { success: true, friends };
  } catch (error) {
    console.error("친구 목록 조회 오류:", error);
    return { success: false, error, friends: [] };
  }
};

// 친구 삭제
export const removeFriend = async (userId: string, friendId: string) => {
  try {
    console.log("🗑️ 친구 삭제 시작:", { userId, friendId });
    
    const batch = writeBatch(db);

    // 본인의 친구 목록에서 제거
    const userFriendRef = doc(db, "users", userId, "friends", friendId);
    const userFriendDoc = await getDoc(userFriendRef);
    if (userFriendDoc.exists()) {
      batch.delete(userFriendRef);
      console.log("✅ 본인 친구 목록에서 제거:", userFriendRef.path);
    } else {
      console.warn("⚠️ 본인 친구 문서가 존재하지 않음:", userFriendRef.path);
    }

    // 상대방의 친구 목록에서도 제거
    const friendUserRef = doc(db, "users", friendId, "friends", userId);
    const friendUserDoc = await getDoc(friendUserRef);
    if (friendUserDoc.exists()) {
      batch.delete(friendUserRef);
      console.log("✅ 상대방 친구 목록에서 제거:", friendUserRef.path);
    } else {
      console.warn("⚠️ 상대방 친구 문서가 존재하지 않음:", friendUserRef.path);
    }

    // friendship 관계도 제거
    const friendshipQuery = query(
      collection(db, "friendships"),
      where("participants", "array-contains", userId)
    );
    const friendshipSnapshot = await getDocs(friendshipQuery);
    
    const friendship = friendshipSnapshot.docs.find(doc => 
      doc.data().participants.includes(friendId)
    );

    if (friendship) {
      batch.delete(friendship.ref);
      console.log("✅ Friendship 관계 제거:", friendship.id);
    } else {
      console.warn("⚠️ Friendship 관계를 찾을 수 없음");
    }

    await batch.commit();
    console.log("✅ 친구 삭제 완료");
    return { success: true };
  } catch (error) {
    console.error("❌ 친구 삭제 오류:", error);
    return { success: false, error };
  }
};

// 사용자 온라인 상태 업데이트
export const updateUserPresence = async (userId: string, presence: Partial<UserPresence>) => {
  try {
    const presenceRef = doc(db, "presence", userId);
    
    await setDoc(presenceRef, {
      uid: userId,
      lastSeen: new Date().toISOString(),
      ...presence
    }, { merge: true });

    // 친구들의 친구 목록에서도 상태 업데이트
    const friendsQuery = query(collection(db, "users", userId, "friends"));
    const friendsSnapshot = await getDocs(friendsQuery);
    
    const batch = writeBatch(db);
    
    for (const friendDoc of friendsSnapshot.docs) {
      const friendId = friendDoc.data().uid;
      const friendUserRef = doc(db, "users", friendId, "friends", userId);
      
      const updateData: any = {
        isOnline: presence.status === 'online',
        status: presence.status || 'offline',
        lastSeen: new Date().toISOString()
      };
      
      // customStatus가 있을 때만 추가
      if (presence.customStatus !== undefined) {
        updateData.customStatus = presence.customStatus;
      }
      
      // 문서가 존재하는지 확인 후 업데이트 (수동 생성된 친구는 건너뜀)
      try {
        // 수동 생성된 사용자(manual_)에 대해서는 업데이트 시도하지 않음
        if (friendId.startsWith('manual_')) {
          console.log("수동 생성된 사용자, 상태 업데이트 건너뜀:", friendId);
          continue;
        }
        
        const friendUserDoc = await getDoc(friendUserRef);
        if (friendUserDoc.exists()) {
          batch.update(friendUserRef, updateData);
        } else {
          console.warn("친구 문서가 존재하지 않음:", friendUserRef.path);
        }
      } catch (error) {
        console.warn("친구 문서 확인 실패:", friendUserRef.path, error);
      }
    }
    
    await batch.commit();
    return { success: true };
  } catch (error) {
    console.error("사용자 상태 업데이트 오류:", error);
    return { success: false, error };
  }
};

// 친구들의 실시간 상태 구독
export const subscribeFriendsPresence = (userId: string, callback: (friends: Friend[]) => void) => {
  const friendsQuery = query(
    collection(db, "users", userId, "friends"),
    orderBy("displayName")
  );

  return onSnapshot(friendsQuery, (snapshot) => {
    const friends = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Friend));
    
    callback(friends);
  });
};

// 수동으로 사용자를 Firestore에 추가하고 즉시 친구로 만드는 함수 (개발/테스트용)
export const addUserAndMakeFriend = async (currentUserId: string, email: string, displayName?: string) => {
  try {
    console.log("🔧 수동으로 사용자 추가 및 친구 생성 시도:", email);
    
    // 현재 사용자 정보 가져오기
    const currentUserRef = doc(db, "users", currentUserId);
    const currentUserDoc = await getDoc(currentUserRef);
    const currentUserData = currentUserDoc.data();
    
    // 임시 사용자 정보 생성
    const displayNameToUse = displayName || email.split('@')[0];
    const tempUserData = {
      email: email,
      displayName: displayNameToUse,
      photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayNameToUse)}&background=6366f1&color=fff&size=96`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isManuallyAdded: true // 수동 추가 표시
    };

    // 이메일을 기반으로 임시 UID 생성
    const tempUid = `manual_${btoa(email).replace(/[^a-zA-Z0-9]/g, '')}`;
    
    // 사용자 추가
    const userRef = doc(db, "users", tempUid);
    await setDoc(userRef, tempUserData);
    
    // 즉시 친구 관계 생성 (테스트용)
    console.log("👥 양방향 친구 관계 생성 시작");
    
    const batch = writeBatch(db);
    
    // 현재 사용자의 친구 목록에 추가 (친구의 UID를 문서 ID로 사용)
    const currentUserFriendRef = doc(db, "users", currentUserId, "friends", tempUid);
    const currentUserFriendData = {
      uid: tempUid,
      displayName: tempUserData.displayName,
      photoURL: tempUserData.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(tempUserData.displayName)}&background=6366f1&color=fff&size=96`,
      email: tempUserData.email,
      addedAt: new Date().toISOString(),
      isOnline: false,
      lastSeen: new Date().toISOString(),
      status: 'offline'
    };
    batch.set(currentUserFriendRef, currentUserFriendData);
    console.log("📝 현재 사용자 친구 목록에 추가:", currentUserFriendRef.path, currentUserFriendData);

    // 추가된 사용자의 친구 목록에도 현재 사용자 추가 (현재 사용자의 UID를 문서 ID로 사용)
    const tempUserFriendRef = doc(db, "users", tempUid, "friends", currentUserId);
    const tempUserFriendData = {
      uid: currentUserId,
      displayName: currentUserData?.displayName || "사용자",
      photoURL: currentUserData?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserData?.displayName || "사용자")}&background=6366f1&color=fff&size=96`,
      email: currentUserData?.email,
      addedAt: new Date().toISOString(),
      isOnline: true, // 현재 사용자는 온라인
      lastSeen: new Date().toISOString(),
      status: 'online'
    };
    batch.set(tempUserFriendRef, tempUserFriendData);
    console.log("📝 상대방 친구 목록에 추가:", tempUserFriendRef.path, tempUserFriendData);

    // friendship 관계도 생성
    const friendshipRef = doc(collection(db, "friendships"));
    batch.set(friendshipRef, {
      id: friendshipRef.id,
      participants: [currentUserId, tempUid],
      createdAt: new Date().toISOString(),
      status: 'active'
    });

    await batch.commit();
    console.log("✅ 배치 커밋 완료");
    
    // 생성된 문서들 확인
    console.log("🔍 생성된 친구 문서 확인 중...");
    const currentUserFriendCheck = await getDoc(currentUserFriendRef);
    const tempUserFriendCheck = await getDoc(tempUserFriendRef);
    
    console.log("📄 현재 사용자 친구 문서 존재:", currentUserFriendCheck.exists());
    console.log("📄 상대방 친구 문서 존재:", tempUserFriendCheck.exists());
    
    console.log("✅ 수동으로 사용자 추가 및 친구 생성 완료:", tempUserData);
    return { success: true, userData: tempUserData, uid: tempUid };
  } catch (error) {
    console.error("❌ 수동 사용자 추가 및 친구 생성 오류:", error);
    return { success: false, error };
  }
};

// 기존 함수도 유지 (단순 사용자 추가용)
export const addUserManuallyToFirestore = async (email: string, displayName?: string) => {
  try {
    console.log("🔧 수동으로 사용자 추가 시도:", email);
    
    // 임시 사용자 정보 생성
    const displayNameToUse = displayName || email.split('@')[0];
    const tempUserData = {
      email: email,
      displayName: displayNameToUse,
      photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayNameToUse)}&background=6366f1&color=fff&size=96`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isManuallyAdded: true // 수동 추가 표시
    };

    // 이메일을 기반으로 임시 UID 생성 (실제 Firebase UID와 다를 수 있음)
    const tempUid = `manual_${btoa(email).replace(/[^a-zA-Z0-9]/g, '')}`;
    
    const userRef = doc(db, "users", tempUid);
    await setDoc(userRef, tempUserData);
    
    console.log("✅ 수동으로 사용자 추가 완료:", tempUserData);
    return { success: true, userData: tempUserData, uid: tempUid };
  } catch (error) {
    console.error("❌ 수동 사용자 추가 오류:", error);
    return { success: false, error };
  }
};

// Custom channel functions
export const createCustomChannel = async (channelData: {
  id: string;
  name: string;
  description?: string;
  type: 'text' | 'voice' | 'video';
  isPrivate: boolean;
  ownerId: string;
  ownerName: string;
  members: string[];
  createdAt: string;
  updatedAt: string;
  maxUsers?: number;
}) => {
  try {
    // Firebase 인증 사용자 확인 (선택적)
    const currentUser = auth.currentUser;
    
    // channelData에 ownerId가 있으면 사용자 인증으로 간주
    // 일반 회원가입 사용자도 채널 생성 가능하도록 수정
    if (!channelData.ownerId) {
      throw new Error("사용자 ID가 필요합니다.");
    }

    console.log('🏗️ 커스텀 채널 생성:', channelData);

    // 채널 문서 생성
    const channelRef = doc(db, "customChannels", channelData.id);
    await setDoc(channelRef, {
      ...channelData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    console.log('✅ 커스텀 채널 생성 완료:', channelData.id);
    return { success: true, channelId: channelData.id };
  } catch (error) {
    console.error('❌ 커스텀 채널 생성 오류:', error);
    return { success: false, error };
  }
};

export const addChannelMember = async (channelId: string, userId: string, userName: string) => {
  try {
    console.log('👥 채널 멤버 추가:', { channelId, userId, userName });

    const channelRef = doc(db, "customChannels", channelId);
    const channelDoc = await getDoc(channelRef);

    if (!channelDoc.exists()) {
      throw new Error("채널을 찾을 수 없습니다.");
    }

    const channelData = channelDoc.data();
    const currentMembers = channelData.members || [];

    if (!currentMembers.includes(userId)) {
      await updateDoc(channelRef, {
        members: [...currentMembers, userId],
        updatedAt: serverTimestamp()
      });

      console.log('✅ 채널 멤버 추가 완료');
      return { success: true };
    } else {
      console.log('ℹ️ 이미 채널 멤버입니다');
      return { success: true, message: "이미 채널 멤버입니다." };
    }
  } catch (error) {
    console.error('❌ 채널 멤버 추가 오류:', error);
    return { success: false, error };
  }
};

export const getUserChannels = async (userId: string) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("사용자가 인증되지 않았습니다.");
    }

    console.log('📁 사용자 채널 목록 조회:', userId);

    const channelsRef = collection(db, "customChannels");
    const q = query(channelsRef, where("members", "array-contains", userId));
    const querySnapshot = await getDocs(q);

    const channels: any[] = [];
    querySnapshot.forEach((doc) => {
      channels.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log('✅ 사용자 채널 목록 조회 완료:', channels.length + '개');
    return { success: true, channels };
  } catch (error) {
    console.error('❌ 사용자 채널 목록 조회 오류:', error);
    return { success: false, error };
  }
};

export const deleteCustomChannel = async (channelId: string, userId: string) => {
  try {
    // userId가 유효한지 확인
    if (!userId) {
      throw new Error("사용자 ID가 필요합니다.");
    }

    console.log('🗑️ 커스텀 채널 삭제:', channelId);

    const channelRef = doc(db, "customChannels", channelId);
    const channelDoc = await getDoc(channelRef);

    if (!channelDoc.exists()) {
      throw new Error("채널을 찾을 수 없습니다.");
    }

    const channelData = channelDoc.data();
    
    // 채널 소유자만 삭제 가능
    if (channelData.ownerId !== userId) {
      throw new Error("채널을 삭제할 권한이 없습니다.");
    }

    await deleteDoc(channelRef);

    console.log('✅ 커스텀 채널 삭제 완료');
    return { success: true };
  } catch (error) {
    console.error('❌ 커스텀 채널 삭제 오류:', error);
    return { success: false, error };
  }
};

export const subscribeToUserChannels = (userId: string, callback: (channels: any[]) => void) => {
  try {
    console.log('🔔 사용자 채널 실시간 구독 시작:', userId);

    const channelsRef = collection(db, "customChannels");
    const q = query(channelsRef, where("members", "array-contains", userId));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const channels: any[] = [];
      querySnapshot.forEach((doc) => {
        channels.push({
          id: doc.id,
          ...doc.data()
        });
      });

      console.log('🔄 실시간 채널 업데이트:', channels.length + '개');
      callback(channels);
    }, (error) => {
      console.error('❌ 채널 실시간 구독 오류:', error);
    });

    return unsubscribe;
  } catch (error) {
    console.error('❌ 채널 구독 설정 오류:', error);
    return null;
  }
}; 

