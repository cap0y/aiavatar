import { api } from './axios-config';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// 인터셉터 설정
api.interceptors.request.use((config: any) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error: any) => {
  return Promise.reject(error);
});

api.interceptors.response.use(
  (response: any) => response,
  (error: any) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  // ... existing auth methods ...
};

export const productAPI = {
  // 상품 카테고리 목록 조회
  getCategories: async () => {
    const response = await api.get('/api/products/categories');
    return response.data;
  },

  // 상품 목록 조회
  getProducts: async (params: any = {}) => {
    const response = await api.get('/api/products', { params });
    return response.data;
  },

  // 상품 상세 조회
  getProduct: async (id: string) => {
    const response = await api.get(`/api/products/${id}`);
    return response.data;
  },

  // 상품 생성
  createProduct: async (product: any) => {
    const response = await api.post('/api/products', product);
    return response.data;
  },

  // 상품 수정
  updateProduct: async (id: string | number, product: any) => {
    const response = await api.put(`/api/products/${id}`, product);
    return response.data;
  },

  // 상품 삭제
  deleteProduct: async (id: string | number) => {
    const response = await api.delete(`/api/products/${id}`);
    return response.data;
  },
};

// 장바구니 API
export const cartAPI = {
  getCart: async (userId: string | number) => {
    const uid = String(userId);
    try {
      const { data } = await api.get(`/api/users/${uid}/cart`);
      // 서버가 { cartItems: [] } 형태로 응답하는 경우
      return data.cartItems || [];
    } catch (error: any) {
      if (error.response?.status === 500) {
        console.warn("장바구니 서버 연결 실패 - API 서버가 실행되지 않았을 수 있습니다.");
      } else {
        console.warn("장바구니 조회 일시적 오류:", error);
      }
      return []; // 오류 발생 시 빈 배열 반환
    }
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

// 즐겨찾기(크리에이터찜) API
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
  // 통합 엔드포인트 사용 (UUID 및 숫자 ID 모두 지원)
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