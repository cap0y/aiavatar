import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
console.log("API_BASE_URL:", API_BASE_URL);
console.log("현재 origin:", window.location.origin);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터 - 인증 토큰 추가
api.interceptors.request.use(
  (config) => {
    console.log("API 요청:", config.method?.toUpperCase(), config.url, config.data);
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error("API 요청 인터셉터 오류:", error);
    return Promise.reject(error);
  }
);

// 응답 인터셉터 - 오류 처리
api.interceptors.response.use(
  (response) => {
    console.log("API 응답 성공:", response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error("API 응답 오류:", error.response?.status, error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Mock data (백엔드 연결 실패 시 폴백용)
const mockProducts = [
  {
    id: "1",
    title: "프리미엄 김치",
    description: "전통 방식으로 만든 프리미엄 김치입니다.",
    price: 15000,
    discountPrice: 12000,
    stock: 50,
    images: ["https://images.unsplash.com/photo-1516684669134-de6f7c473a2a?w=300"],
    category_id: 1,
    category: "가공식품",
    tags: ["김치", "발효식품", "한식"],
    status: "active",
    rating: 4.5,
    reviewCount: 23,
    seller_id: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "2",
    title: "유기농 배추",
    description: "무농약으로 재배한 신선한 유기농 배추입니다.",
    price: 8000,
    stock: 30,
    images: ["https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=300"],
    category_id: 3,
    category: "농산물",
    tags: ["유기농", "배추", "농산물"],
    status: "active",
    rating: 4.3,
    reviewCount: 15,
    seller_id: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "3",
    title: "자연산 고등어",
    description: "신선한 자연산 고등어입니다.",
    price: 12000,
    discountPrice: 10000,
    stock: 20,
    images: ["https://images.unsplash.com/photo-1544943845-ad535c4eb135?w=300"],
    category_id: 4,
    category: "수산물",
    tags: ["고등어", "자연산", "수산물"],
    status: "active",
    rating: 4.7,
    reviewCount: 8,
    seller_id: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const mockCategories = [
  { id: 1, name: "가공식품", description: "가공된 식품류" },
  { id: 2, name: "건강식품", description: "건강 관련 식품" },
  { id: 3, name: "농산물", description: "신선한 농산물" },
  { id: 4, name: "수산물", description: "신선한 수산물" },
  { id: 5, name: "생활용품", description: "일상생활용품" }
];

// 상품 API
export const productAPI = {
  getProducts: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
      
      const url = `/api/products${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await api.get(url);
      
      // 임시로 인증 정보 추가 (서버에서 지원할 때까지)
      const data = response.data;
      
      // 인증된 판매자 목록을 캐싱하는 함수
      const getSellerCertificationCache = async () => {
        // 캐시가 있으면 캐시 사용
        if (window.sellerCertificationCache) {
          return window.sellerCertificationCache;
        }
        
        // 캐시 없으면 구성
        const cache = new Map();
        // 빈 캐시 맵 생성
        
        window.sellerCertificationCache = cache;
        return cache;
      };
      
      // 판매자 인증 상태 확인
      const isSellerCertified = async (sellerId: string | number) => {
        if (!sellerId) return false;
        
        const sellerIdStr = String(sellerId);
        const cache = await getSellerCertificationCache();
        
        // 캐시에 있으면 캐시 결과 반환
        if (cache.has(sellerIdStr)) {
          return cache.get(sellerIdStr);
        }
        
        try {
          // API로 실제 인증 상태 확인
          const certResponse = await api.get(`/api/users/${sellerIdStr}/certification`);
          const isCertified = certResponse.data?.isCertified || false;
          
          // 캐시에 결과 저장
          cache.set(sellerIdStr, isCertified);
          return isCertified;
        } catch (error) {
          console.error(`판매자 ${sellerIdStr} 인증 상태 확인 오류:`, error);
          
          // API 호출 실패 시 인증되지 않은 것으로 처리
          cache.set(sellerIdStr, false);
          return false;
        }
      };
      
      // 상품 목록에 인증 정보 추가
      const productsWithCertification = await Promise.all(
        Array.isArray(data.products) 
          ? data.products.map(async (product: { seller_id?: string | number; sellerId?: string | number; userId?: string | number; user_id?: string | number; [key: string]: any }) => {
              const sellerId = product.sellerId || product.seller_id || product.userId || product.user_id || "";
              return {
                ...product,
                isCertified: await isSellerCertified(sellerId)
              };
            })
          : Array.isArray(data)
            ? data.map(async (product) => {
                const sellerId = product.sellerId || product.seller_id || product.userId || product.user_id;
                return {
                  ...product,
                  isCertified: await isSellerCertified(sellerId)
                };
              })
            : []
      );
          
      return Array.isArray(data.products) ? {products: productsWithCertification} : productsWithCertification;
    } catch (error) {
      console.error("상품 목록 조회 실패:", error);
      // 백엔드 오류 시 목업 데이터 반환
      return mockProducts;
    }
  },

  getProduct: async (id: string) => {
    try {
      const response = await api.get(`/api/products/${id}`);
      
      if (response.data) {
        const product = response.data;
        
        // 판매자 ID 추출 - sellerId 필드 추가
        const sellerId = product.sellerId || product.seller_id || product.userId || product.user_id;
        
        // 판매자 인증 상태 확인
        let isCertified = false;
        
        try {
          if (sellerId) {
            const sellerIdStr = String(sellerId);
            
            // 캐시 확인
            if (window.sellerCertificationCache && window.sellerCertificationCache.has(sellerIdStr)) {
              isCertified = window.sellerCertificationCache.get(sellerIdStr) ?? false;
            } else {
              // API 호출
              try {
                const certResponse = await api.get(`/api/users/${sellerIdStr}/certification`);
                isCertified = certResponse.data?.isCertified || false;
                
                // 캐시 저장
                if (!window.sellerCertificationCache) {
                  window.sellerCertificationCache = new Map();
                }
                window.sellerCertificationCache.set(sellerIdStr, isCertified);
              } catch (error) {
                console.error(`인증 API 호출 오류: ${error}`);
                // 인증되지 않은 것으로 처리
                isCertified = false;
              }
            }
          }
        } catch (error) {
          console.error(`상품 상세페이지 판매자 ${sellerId} 인증 확인 실패:`, error);
          // 실패 시 인증되지 않은 것으로 처리
          isCertified = false;
        }
        
        console.log(`상품 ID ${id} 판매자 ID: ${sellerId}, 인증 여부: ${isCertified}`);
        
        return {
          ...product,
          isCertified
        };
      }
      return response.data;
    } catch (error) {
      console.error("상품 상세 조회 실패:", error);
      // 백엔드 오류 시 목업 데이터에서 찾기
      const mockProduct = mockProducts.find((p: any) => p.id === id);
      console.log("목업 데이터로 대체:", mockProduct);
      return mockProduct;
    }
  },

  getCategories: async () => {
    try {
      const response = await api.get('/api/products/categories');
      return response.data;
    } catch (error) {
      console.error("카테고리 목록 조회 실패:", error);
      // 백엔드 오류 시 목업 데이터 반환
      return { categories: mockCategories };
    }
  },

  createProduct: async (productData: any) => {
    try {
      console.log("상품 등록 요청 데이터:", productData);
      const response = await api.post('/api/products', productData);
      return response.data;
    } catch (error) {
      console.error("상품 등록 실패:", error);
      throw error;
    }
  },

  updateProduct: async (id: string, productData: any) => {
    try {
      const response = await api.put(`/api/products/${id}`, productData);
      return response.data;
    } catch (error) {
      console.error("상품 수정 실패:", error);
      throw error;
    }
  },

  deleteProduct: async (id: string) => {
    try {
      const response = await api.delete(`/api/products/${id}`);
      return response.data;
    } catch (error) {
      console.error("상품 삭제 실패:", error);
      throw error;
    }
  }
};

// 장바구니 API
export const cartAPI = {
  getCart: async (userId: string | number) => {
    const uid = String(userId);
    const { data } = await api.get(`/api/users/${uid}/cart`);
    return data;
  },
  addItem: async (userId: string | number, payload: { productId: string | number; quantity?: number; selected_options?: any }) => {
    const uid = String(userId);
    const body = {
      productId: Number(payload.productId),
      quantity: payload.quantity ?? 1,
      selected_options: payload.selected_options ?? null,
    };
    const { data } = await api.post(`/api/users/${uid}/cart`, body);
    return data;
  },
  updateItem: async (userId: string | number, itemId: string | number, payload: { quantity?: number; selected_options?: any }) => {
    const uid = String(userId);
    const { data } = await api.put(`/api/users/${uid}/cart/${itemId}`, payload);
    return data;
  },
  removeItem: async (userId: string | number, itemId: string | number) => {
    const uid = String(userId);
    const { data } = await api.delete(`/api/users/${uid}/cart/${itemId}`);
    return data;
  },
  clear: async (userId: string | number) => {
    const uid = String(userId);
    const { data } = await api.delete(`/api/users/${uid}/cart`);
    return data;
  },
};

// 즐겨찾기(케어 매니저 찜) API
export const favoritesAPI = {
  getFavorites: async (userId: string | number) => {
    const uid = String(userId);
    const { data } = await api.get(`/api/favorites/${uid}`);
    return data;
  },
  addFavorite: async (userId: string | number, careManagerId: string | number) => {
    const body = { userId: String(userId), careManagerId: Number(careManagerId) };
    const { data } = await api.post(`/api/favorites`, body);
    return data;
  },
  removeFavorite: async (favoriteId: string | number) => {
    const { data } = await api.delete(`/api/favorites/${favoriteId}`);
    return data;
  },
};

export async function changePassword(params: { userId: string | number; currentPassword: string; newPassword: string }) {
  const res = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '오류' }));
    throw new Error(err.error || '비밀번호 변경 실패');
  }
  return res.json();
}

export default api; 