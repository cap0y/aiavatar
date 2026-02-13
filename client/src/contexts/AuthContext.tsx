// @ts-nocheck
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
// @ts-ignore – local Firebase wrapper
import { auth, googleProvider, saveUserToFirestore } from "@/firebase";
// @ts-ignore
import * as firebaseAuth from "firebase/auth";

// Extract Firebase auth functions
const {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  updateProfile,
} = firebaseAuth;

type FirebaseUser = firebaseAuth.User;

// 사용자 타입 정의
export type UserType = 'customer' | 'careManager' | 'admin';
export type UserGrade = 'bronze' | 'silver' | 'gold' | 'platinum';

// 상수들을 최상단으로 이동하여 어디서든 접근 가능하게 함
export const SUPER_ADMIN_EMAIL = "decom2soft@gmail.com";

// 슈퍼 관리자 여부 확인 유틸리티 함수
export function isSuperAdmin(email: string | null): boolean {
  if (!email) return false;
  return email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}

// 사용자 객체에 슈퍼 관리자 권한 적용 함수
export function ensureAdminRights(user: any): any {
  if (!user || !user.email) return user;

  // 슈퍼 관리자인 경우 항상 admin 권한 부여
  if (isSuperAdmin(user.email)) {
    console.log("슈퍼 관리자 권한 강제 적용:", user.email);
    return {
      ...user,
      userType: 'admin' as UserType,
      isApproved: true
    };
  }

  return user;
}

// Kakao 로그인 설정
const KAKAO_REST_KEY = "4fe991b7974e24feba7aa4ce137fa324";
const KAKAO_REDIRECT_URI = `${window.location.origin}/oauth/kakao/callback`;
const KAKAO_SDK_URL = "https://developers.kakao.com/sdk/js/kakao.js";

interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  userType: UserType;
  grade?: UserGrade;
  isApproved?: boolean;
}

interface AuthProviderProps {
  children: ReactNode;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean; // 사용자 로딩 상태 추가
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
  login: (user: User) => void; // For email/password flows
  emailPasswordLogin: (email: string, password: string) => Promise<void>; // 서버 API 로그인 추가
  logout: () => Promise<void>;
  googleLogin: () => Promise<void>;
  kakaoLogin: () => Promise<void>;
  updateUserType: (userType: UserType) => Promise<void>;
  updateUserPhoto: (photoURL: string) => Promise<boolean>; // 새로운 함수 추가
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// 이메일로 사용자 타입 결정 (실제로는 API에서 받아온 값을 사용)
function determineUserType(email: string | null): UserType {
  if (!email) return "customer";
  if (email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) return "admin";
  return "customer";
}

// 로컬 스토리지에 사용자 타입 저장
function saveUserType(email: string, userType: UserType) {
  try {
    // 슈퍼 관리자 이메일인 경우 항상 admin으로 저장
    if (email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      userType = 'admin';
    }

    const userTypes = JSON.parse(localStorage.getItem("user_types") || "{}");
    userTypes[email] = userType;
    localStorage.setItem("user_types", JSON.stringify(userTypes));
    console.log(`사용자 타입 저장됨: ${email} => ${userType}`);
  } catch (error) {
    console.error("Error saving user type to local storage:", error);
  }
}

// 로컬 스토리지에서 사용자 타입 가져오기
function getSavedUserType(email: string): UserType | null {
  try {
    const userTypes = JSON.parse(localStorage.getItem("user_types") || "{}");
    return userTypes[email] || null;
  } catch (error) {
    console.error("Error getting user type from local storage:", error);
    return null;
  }
}

// Kakao SDK 로드 함수
async function loadKakaoSdk() {
  return new Promise<void>((resolve, reject) => {
    if (window.Kakao) {
      if (!window.Kakao.isInitialized()) {
        try {
          window.Kakao.init(KAKAO_REST_KEY);
          console.log("Kakao SDK 초기화 완료");
        } catch (error) {
          console.error("Kakao SDK 초기화 실패:", error);
        }
      }
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = KAKAO_SDK_URL;

    script.onload = () => {
      if (window.Kakao) {
        try {
          window.Kakao.init(KAKAO_REST_KEY);
          console.log("Kakao SDK 로드 및 초기화 성공");
          resolve();
        } catch (error) {
          console.error("Kakao SDK 초기화 중 오류:", error);
          reject(error);
        }
      } else {
        console.error("Kakao SDK가 로드되었지만 window.Kakao 객체를 찾을 수 없음");
        reject(new Error("Kakao SDK 로드 실패"));
      }
    };

    script.onerror = (error) => {
      console.error("Kakao SDK 로드 실패:", error);
      reject(new Error("Kakao SDK 로드 실패"));
    };

    document.head.appendChild(script);
  });
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // 사용자 로딩 상태 추가

  useEffect(() => {
    // 이벤트 리스너 등록: 로그인 모달 표시
    const handleShowLogin = () => {
      console.log("로그인 모달 표시 이벤트 감지");
      setShowAuthModal(true);
    };

    window.addEventListener("showLogin", handleShowLogin);

    // 이벤트 리스너 정리
    return () => {
      window.removeEventListener("showLogin", handleShowLogin);
    };
  }, []);

  useEffect(() => {
    // 로컬 스토리지 초기화 함수
    const resetLocalStorage = () => {
      try {
        console.log("로컬 스토리지 초기화 및 슈퍼 관리자 설정 확인");

        // 기존 사용자 타입 정보 유지
        const existingUserTypes = localStorage.getItem("user_types");
        let userTypes = existingUserTypes ? JSON.parse(existingUserTypes) : {};

        // 슈퍼 관리자 설정 추가 (기존 설정 덮어쓰지 않음)
        if (!userTypes[SUPER_ADMIN_EMAIL]) {
          userTypes[SUPER_ADMIN_EMAIL] = 'admin';
          localStorage.setItem("user_types", JSON.stringify(userTypes));
          console.log("슈퍼 관리자 설정 완료:", userTypes);
        }
      } catch (error) {
        console.error("로컬 스토리지 초기화 오류:", error);
      }
    };

    // 앱 시작 시 한 번 초기화
    resetLocalStorage();

    // 인증 지속성 설정 - LOCAL로 설정
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        console.log("Firebase 인증 지속성이 LOCAL로 설정되었습니다.");
      })
      .catch((error) => {
        console.error("인증 지속성 설정 오류:", error);
      });

    // Firebase auth state listener
    const unsub = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      console.log("Firebase 인증 상태 변경:", {
        firebaseUser: firebaseUser ? {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName
        } : null
      });

      if (firebaseUser) {
        const mappedUser = await mapFirebaseUser(firebaseUser);
        console.log("매핑된 사용자:", mappedUser);
        setUser(mappedUser);

        // Firestore에 사용자 정보 저장
        saveUserToFirestore({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL || null // undefined 대신 null 사용
        }).catch(error => {
          console.warn("Firestore 사용자 정보 저장 실패:", error);
        });

        // 서버 데이터베이스에도 사용자 정보 저장 (Firebase 사용자)
        if (firebaseUser.email) {
          try {
            const serverUserData = {
              uid: firebaseUser.uid, // Firebase UID를 id로 사용하기 위해 전달
              username: firebaseUser.displayName || firebaseUser.email.split('@')[0],
              displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
              email: firebaseUser.email,
              password: firebaseUser.uid, // Firebase UID를 임시 비밀번호로 사용
              userType: 'customer', // 기본값으로 customer 설정
              photoURL: firebaseUser.photoURL
            };

            console.log("Firebase 사용자를 서버 DB에 저장 시도:", serverUserData);
            
            const response = await fetch('/api/auth/register-firebase-user', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(serverUserData),
            });

            if (response.ok) {
              console.log("✅ Firebase 사용자 서버 DB 저장 성공");
            } else {
              console.log("⚠️ 이미 존재하는 사용자이거나 저장 실패 (정상적일 수 있음)");
            }
          } catch (error) {
            console.warn("Firebase 사용자 서버 DB 저장 실패:", error);
          }
        }

        // 로그인 성공 시 항상 인증 모달 닫기
        console.log("로그인 성공 - 인증 모달 닫기");
        setShowAuthModal(false);

        // 로그인 성공 시 체크아웃 페이지 리다이렉트 처리
        // 체크아웃 데이터가 있고 현재 페이지가 홈이 아니고 체크아웃이 아닌 경우에만 리다이렉션
        const checkoutData = localStorage.getItem('checkoutData');
        if (checkoutData && window.location.pathname !== "/checkout" && window.location.pathname !== "/") {
          console.log("체크아웃 데이터 발견, 체크아웃 페이지로 리다이렉션");
          // 인증 상태가 완전히 설정된 후 리다이렉션할 수 있도록 충분한 시간 지연
          setTimeout(() => {
            window.location.href = "/checkout";
          }, 1000); // 1초로 지연 시간 증가
        }
      } else {
        console.log("사용자 로그아웃 또는 인증되지 않음");
        setUser(null);
      }
      setIsLoading(false); // 인증 상태 확인 완료
    });

    // 리디렉션 결과 처리
    const handleRedirectResult = async () => {
      try {
        // 리디렉션 결과 확인
        const result = await getRedirectResult(auth);

        if (result && result.user) {
          console.log("구글 로그인 리디렉션 성공:", result.user.email);

          // decom2soft@gmail.com 이메일 직접 확인
          if (result.user.email?.toLowerCase() === "decom2soft@gmail.com") {
            console.log("★★★ 슈퍼 관리자 계정 감지: decom2soft@gmail.com ★★★");

            // 로컬 스토리지 완전히 초기화
            localStorage.clear();

            // 관리자 권한 설정
            const userTypes = {};
            userTypes[result.user.email] = 'admin';
            localStorage.setItem("user_types", JSON.stringify(userTypes));
            console.log("관리자 권한 설정 완료:", JSON.stringify(userTypes));

            // 직접 관리자 페이지로 이동
            setTimeout(() => {
              console.log("관리자 페이지로 강제 이동합니다...");
              window.location.href = "/profile";
            }, 1000);
          }

          // 이전 페이지로 이동 (선택적)
          if (localStorage.getItem('pending_admin_check')) {
            localStorage.removeItem('pending_admin_check');
            window.location.href = "/profile"; // 프로필 페이지로 강제 이동
          }
        }
      } catch (error) {
        console.error("리디렉션 결과 처리 오류:", error);
      }
    };

    // 리디렉션 결과 처리 실행
    handleRedirectResult();

    // Load Kakao SDK once
    loadKakaoSdk();

    // 로컬 스토리지에 저장된 슈퍼 관리자 정보 재설정
    try {
      const userTypes = JSON.parse(localStorage.getItem("user_types") || "{}");
      Object.keys(userTypes).forEach(email => {
        if (email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
          userTypes[email] = 'admin';
          console.log(`로컬 스토리지에서 슈퍼 관리자 감지 및 재설정: ${email}`);
        }
      });
      localStorage.setItem("user_types", JSON.stringify(userTypes));
    } catch (error) {
      console.error("로컬 스토리지 업데이트 오류:", error);
    }

    return () => unsub();
  }, []);

  const mapFirebaseUser = async (fbUser: FirebaseUser): Promise<User> => {
    // 커스텀 클레임 가져오기
    let customClaims: any = {};
    try {
      const idTokenResult = await fbUser.getIdTokenResult();
      customClaims = idTokenResult.claims;
      console.log("🔑 Firebase 커스텀 클레임:", customClaims);
    } catch (error) {
      console.warn("⚠️ 커스텀 클레임 가져오기 실패:", error);
    }

    // 슈퍼 관리자 이메일 직접 확인 - 대소문자 구분 없이
    const email = customClaims.email || fbUser.email || "";

    // 슈퍼 관리자 확인 로직 강화
    let userType: UserType = customClaims.userType || 'customer';

    // 디버깅을 위한 상세 로그 추가
    console.log("Firebase 사용자 매핑 - 이메일:", email);

    // decom2soft@gmail.com 계정은 무조건 admin 권한 부여 (대소문자 무시)
    if (email.toLowerCase() === "decom2soft@gmail.com") {
      console.log("decom2soft@gmail.com 계정 감지 - 무조건 admin으로 설정");
      userType = 'admin';

      // 로컬 스토리지 초기화 및 admin 설정
      const userTypes = {};
      userTypes[email] = 'admin';
      localStorage.setItem("user_types", JSON.stringify(userTypes));
      console.log("관리자 권한 로컬 스토리지에 저장 완료");

      return {
        uid: fbUser.uid,
        email: customClaims.email || fbUser.email,
        displayName: customClaims.displayName || fbUser.displayName,
        photoURL: customClaims.photoURL || fbUser.photoURL,
        userType: 'admin',
        grade: 'platinum',
        isApproved: true,
      };
    }

    // 슈퍼 관리자 여부 확인 - isSuperAdmin 유틸리티 함수 사용
    if (isSuperAdmin(email)) {
      userType = 'admin';
      console.log("Firebase 인증 후 슈퍼 관리자 감지 - admin 타입 설정");

      // 강제로 로컬 스토리지 업데이트
      try {
        const existingUserTypes = localStorage.getItem("user_types");
        const userTypes = existingUserTypes ? JSON.parse(existingUserTypes) : {};
        userTypes[email] = 'admin';
        localStorage.setItem("user_types", JSON.stringify(userTypes));
        console.log("슈퍼 관리자 로컬 스토리지 강제 업데이트");
      } catch (e) {
        console.error("로컬 스토리지 업데이트 오류", e);
      }
    } else {
      // 기존 저장된 유형이 있으면 사용
      userType = getSavedUserType(email) || determineUserType(email);
    }

    console.log("최종 설정된 사용자 타입:", userType);

    const mappedUser = {
      uid: fbUser.uid,
      email: customClaims.email || fbUser.email,
      displayName: customClaims.displayName || fbUser.displayName,
      photoURL: customClaims.photoURL || fbUser.photoURL,
      userType,
      grade: 'bronze',  // 기본 등급 설정
      isApproved: userType !== 'careManager' || false,  // AI아바타가 아니면 승인 불필요
    };

    // 슈퍼 관리자 권한 최종 확인 및 적용
    return ensureAdminRights(mappedUser);
  };

  const login = (localUser: User) => {
    // 사용자 타입 저장 (기존 타입이 있으면 그대로 사용)
    if (localUser.email) {
      console.log("로그인 시도 - 원본 유저 정보:", localUser);

      // 슈퍼 관리자 확인 강제 적용
      let userType = localUser.userType;
      if (localUser.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
        userType = 'admin';
        console.log("로그인 함수에서 슈퍼 관리자 감지! 강제 admin 설정");

        // 관리자 사용자 타입을 강제로 설정 - 기존 객체 속성 직접 수정
        localUser.userType = 'admin';
      } else {
        userType = userType || determineUserType(localUser.email);
      }

      // 타입 정보가 없는 경우 기본 타입으로 추가
      const updatedUser = {
        ...localUser,
        userType,
        grade: localUser.grade || 'bronze',
        isApproved: localUser.isApproved !== undefined ? localUser.isApproved : (userType !== 'careManager' || false),
      };

      console.log("업데이트된 유저 정보:", updatedUser);

      // 로컬 스토리지에 사용자 타입 저장
      saveUserType(localUser.email, userType);

      // 사용자 정보를 업데이트된 내용으로 설정
      setUser(updatedUser);
      setShowAuthModal(false);
    } else {
      setUser(localUser);
      setShowAuthModal(false);
    }
  };

  // 서버 API를 통한 이메일/비밀번호 로그인
  const emailPasswordLogin = async (email: string, password: string) => {
    try {
      console.log("서버 API 로그인 시도:", email);
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("로그인 API 오류:", errorData);
        throw new Error(errorData.error || '로그인에 실패했습니다.');
      }

      const data = await response.json();
      console.log("서버 API 로그인 성공:", data);

      if (data.user) {
        // 슈퍼 관리자 확인 로직 - 명확한 비교 추가
        if (email && email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
          console.log(`슈퍼 관리자 감지: ${email}`);
          // 직접 userType 속성 설정
          data.user.userType = 'admin';
          console.log("관리자로 사용자 타입 설정:", data.user);

          // 강제로 로컬 스토리지 업데이트
          try {
            const userTypes = JSON.parse(localStorage.getItem("user_types") || "{}");
            userTypes[email] = 'admin';
            localStorage.setItem("user_types", JSON.stringify(userTypes));
            console.log("이메일 로그인: 슈퍼 관리자 로컬 스토리지 강제 업데이트");
          } catch (e) {
            console.error("로컬 스토리지 업데이트 오류", e);
          }
        }

        // Firestore에 사용자 정보 저장 (서버 API 로그인)
        saveUserToFirestore({
          uid: data.user.uid,
          email: data.user.email,
          displayName: data.user.displayName || data.user.name,
          photoURL: data.user.photoURL || null // undefined 대신 null 사용
        }).catch(error => {
          console.warn("서버 로그인 후 Firestore 사용자 정보 저장 실패:", error);
        });

        login(data.user);
        setShowAuthModal(false);
        return data.user;
      } else {
        throw new Error('서버에서 사용자 정보를 반환하지 않았습니다.');
      }
    } catch (error) {
      console.error("이메일/비밀번호 로그인 오류:", error);
      throw error;
    }
  };

  const googleLogin = async () => {
    try {
      // 로그인 시작 전에 decom2soft@gmail.com 확인을 위한 상태 설정
      localStorage.setItem('pending_admin_check', 'true');

      console.log("구글 로그인 시작: 페이지 새로고침 방식으로 인증 진행");

      // 팝업 방식으로 로그인 (정책상 iframe 금지)
      await signInWithPopup(auth, googleProvider);

      // 인증 UI 닫기
      setShowAuthModal(false);
    } catch (error) {
      console.error("구글 로그인 오류:", error);
    }
  };

  const kakaoLogin = async () => {
    // Ensure SDK init
    // @ts-ignore
    if (!window.Kakao || !window.Kakao.isInitialized()) loadKakaoSdk();

    // @ts-ignore
    window.Kakao.Auth.authorize({
      redirectUri: KAKAO_REDIRECT_URI,
      throughTalk: false,
    });
  };

  const logout = async () => {
    // Firebase 로그아웃
    await signOut(auth);

    // 로컬 스토리지의 인증 관련 데이터 삭제
    localStorage.removeItem("socket_session");
    localStorage.removeItem("current_chat_request");

    // 상태 초기화
    setUser(null);
  };

  // 사용자 타입 업데이트
  const updateUserType = async (userType: UserType) => {
    if (!user || !user.email) return;

    try {
      // API 호출하여 사용자 타입 업데이트 (실제 API 호출 코드로 대체 필요)
      const response = await fetch(`/api/users/${user.uid}/change-type`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userType }),
      });

      if (!response.ok) {
        throw new Error('사용자 타입 업데이트에 실패했습니다.');
      }

      // 로컬 스토리지에 사용자 타입 저장
      saveUserType(user.email, userType);

      // 상태 업데이트
      setUser({
        ...user,
        userType,
        isApproved: userType !== 'careManager' || false,  // AI아바타로 변경 시 승인 필요
      });
    } catch (error) {
      console.error('사용자 타입 업데이트 오류:', error);
      throw error;
    }
  };

  // 사용자 프로필 사진 업데이트 
  const updateUserPhoto = async (photoURL: string) => {
    if (!user) return false;

    try {
      console.log("🖼️ 프로필 사진 업데이트 시작:", {
        userId: user.uid || user.id,
        photoURLLength: photoURL?.length,
        isBase64: photoURL?.startsWith('data:'),
        isHttpUrl: photoURL?.startsWith('http')
      });

      // photoURL이 너무 길거나 base64인 경우 체크
      const isValidUrl = photoURL && 
                         photoURL.startsWith('http') && 
                         photoURL.length < 1000; // Firebase photoURL 최대 길이 제한

      // Firebase 사용자 프로필 업데이트 (유효한 URL이고 Firebase 사용자인 경우에만)
      const currentUser = auth.currentUser;
      if (currentUser && isValidUrl) {
        try {
          await updateProfile(currentUser, { photoURL });
          console.log("✅ Firebase 프로필 업데이트 완료");
        } catch (firebaseError: any) {
          console.warn("⚠️ Firebase 프로필 업데이트 실패 (계속 진행):", firebaseError.message);
          // Firebase 업데이트 실패해도 서버 업데이트는 계속 진행
        }
      } else if (!isValidUrl) {
        console.log("⚠️ Firebase 프로필 업데이트 건너뜀: URL이 너무 길거나 유효하지 않음");
      }

      // 서버 API 호출 - 사용자 프로필 사진 업데이트
      try {
        const userId = user.uid || user.id;
        console.log("🖼️ 프로필 사진 서버 업데이트 시작:", userId);
        
        const response = await fetch(`/api/users/${userId}/profile-photo`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photoURL }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || '프로필 사진 업데이트 실패');
        }

        const data = await response.json();
        console.log("✅ 프로필 사진 서버 업데이트 완료:", data);
        
        // 서버에서 반환된 실제 photoURL 사용
        const finalPhotoURL = data.photoURL || photoURL;

        // 상태 업데이트
        setUser({
          ...user,
          photoURL: finalPhotoURL
        });

        // Firestore 사용자 정보도 업데이트 (uid와 email이 있는 경우에만)
        if (currentUser && currentUser.uid && (currentUser.email || user.email)) {
          try {
            await saveUserToFirestore({
              uid: currentUser.uid,
              email: currentUser.email || user.email,
              displayName: currentUser.displayName || user.displayName || user.name,
              photoURL: finalPhotoURL
            });
            console.log("✅ Firestore 사용자 정보 업데이트 완료");
          } catch (firestoreError) {
            console.warn("⚠️ Firestore 업데이트 실패 (계속 진행):", firestoreError);
          }
        }

        return true;
      } catch (error) {
        console.error('서버 프로필 사진 업데이트 오류:', error);
        throw error;
      }
    } catch (error) {
      console.error('사용자 프로필 사진 업데이트 오류:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    isLoading, // 사용자 로딩 상태 추가
    showAuthModal,
    setShowAuthModal,
    login,
    emailPasswordLogin,
    logout,
    googleLogin,
    kakaoLogin,
    updateUserType,
    updateUserPhoto,  // 새로운 함수 추가
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};