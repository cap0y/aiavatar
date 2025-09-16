import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { productAPI } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Package,
  Plus,
  Edit,
  Trash2,
  Search,
  Star,
  Eye,
  X,
  Save,
  Upload,
  Truck,
  ShoppingBag,
  FileText,
  Code,
  Monitor,
  Store,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Bell,
  ArrowLeft,
  XCircle,
  ImageIcon,
  CheckCircle,
  AlertCircle,
  Clock,
  Send,
  ArrowUpDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { normalizeImageUrl, normalizeHtmlImageSrc } from "@/lib/url";

// 국내 주요 택배사 목록
const KOREAN_CARRIERS = [
  "CJ대한통운",
  "우체국택배",
  "롯데택배",
  "한진택배",
  "로젠택배",
  "일양로지스",
  "경동택배",
  "대신택배",
  "합동택배",
  "CU 편의점택배",
  "GS Postbox",
  "기타(직접입력)",
];

// 이미지 URL을 추출하는 헬퍼 함수
const getImageUrl = (image: any): string => {
  if (!image) return "";

  // 문자열인 경우 (단순 URL 또는 Base64)
  if (typeof image === "string") {
    // Base64 데이터인 경우 그대로 반환
    if (image.startsWith("data:")) {
      return image;
    }

    // 이미 완전한 URL인 경우 (http:// 또는 https://)
    if (image.startsWith("http://") || image.startsWith("https://")) {
      return image;
    }

    // 상대 경로인 경우 현재 호스트 사용
    if (image.startsWith("/uploads/") || image.startsWith("/api/uploads/") || 
        image.startsWith("/images/") || image.startsWith("/images/item/")) {
      // 경로에서 /api 접두사 제거 (필요한 경우)
      const cleanPath = image.startsWith("/api/") ? image.substring(4) : image;
      // 개발 환경에서는 서버가 5000 포트에서 실행되므로 이미지 URL을 서버 URL로 변경
      return `${cleanPath}`;
    }

    return image;
  }

  // 객체인 경우 (url 속성이 있는 객체)
  if (image && typeof image === "object") {
    if ("url" in image) {
      const url = image.url;
      if (typeof url === "string") {
        // Base64 데이터인 경우 그대로 반환
        if (url.startsWith("data:")) {
          return url;
        }

        // 이미 완전한 URL인 경우
        if (url.startsWith("http://") || url.startsWith("https://")) {
          return url;
        }

        // 상대 경로인 경우 현재 호스트 사용
        if (url.startsWith("/uploads/") || url.startsWith("/api/uploads/") || 
            url.startsWith("/images/") || url.startsWith("/images/item/")) {
          // 경로에서 /api 접두사 제거 (필요한 경우)
          const cleanPath = url.startsWith("/api/") ? url.substring(4) : url;
          // 개발 환경에서는 서버가 5000 포트에서 실행되므로 이미지 URL을 서버 URL로 변경
          return `${cleanPath}`;
        }
      }
      return url || "";
    }
  }

  return "";
};

// 상품 옵션 타입 정의
interface ProductOptionValue {
  value: string;
  price_adjust: number;
}

interface ProductOption {
  id?: string;
  name: string;
  values: ProductOptionValue[];
}

// Product 타입 확장
interface ExtendedProduct {
  id?: string;
  title?: string;
  description?: string;
  price?: number | string;
  discountPrice?: number | string;
  stock?: number | string;
  category_id?: string | number;
  status?: string;
  images?: any[];
  options?: ProductOption[];
}

const ShopPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [productTab, setProductTab] = useState("list"); // 상품 관리 서브 탭
  const [editingProduct, setEditingProduct] = useState<ExtendedProduct | null>(null);
  const [productForm, setProductForm] = useState({
    title: "",
    price: "",
    discount_price: "",
    description: "",
    stock: "",
    category_id: "",
    status: "active",
    images: [] as string[]
  });
  
  // HTML 에디터 관련 상태 추가
  const [descriptionMode, setDescriptionMode] = useState<'html' | 'preview'>('html');

  // 상품 옵션 관련 상태
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [optionName, setOptionName] = useState<string>("");
  const [optionValues, setOptionValues] = useState<string>("");
  const [additionalPrice, setAdditionalPrice] = useState<string>("");
  const [tempOptionValues, setTempOptionValues] = useState<ProductOptionValue[]>([]);
  
  // 이미지 업로드 관련
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const descriptionImageInputRef = React.useRef<HTMLInputElement>(null); // 상품 설명용 이미지 업로드

  // 주문/배송 관련 상태
  const [orderStatus, setOrderStatus] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [trackingDialog, setTrackingDialog] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shippingCompany, setShippingCompany] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [customCarrier, setCustomCarrier] = useState(false);

  // 상품 데이터 가져오기
  const { data: products = [] } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      try {
        const response = await productAPI.getProducts({ limit: 50 });
        return Array.isArray(response) ? response : response?.products || [];
      } catch (error) {
        console.error("상품 로드 오류:", error);
        return [];
      }
    },
    enabled: activeTab === "products",
  });

  // 카테고리 목록 가져오기
  const { data: categoriesData } = useQuery({
    queryKey: ["product-categories"],
    queryFn: async () => {
      try {
        const response = await productAPI.getCategories();
        if (response && response.categories && Array.isArray(response.categories)) {
          return ["전체", ...response.categories.map((cat: any) => cat.name || cat)];
        }
        return [
          "전체", "가공식품", "건강식품", "기타", "농산물", "디지털상품",
          "생활용품", "수산물", "전자제품", "주류", "축산물", "취미/게임",
          "카페/베이커리", "패션", "하드웨어"
        ];
      } catch (error) {
        console.error("카테고리 로드 오류:", error);
        return [
          "전체", "가공식품", "건강식품", "기타", "농산물", "디지털상품",
          "생활용품", "수산물", "전자제품", "주류", "축산물", "취미/게임",
          "카페/베이커리", "패션", "하드웨어"
        ];
      }
    },
  });

  // 주문 데이터 가져오기 (더미 데이터로 시작)
  const { data: orders, isLoading: isOrdersLoading } = useQuery({
    queryKey: ["admin-orders", orderStatus, sortOrder],
    queryFn: async () => {
      try {
        // 실제 API 호출
        const response = await fetch('/api/orders/admin', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            // 인증 토큰이 필요한 경우 추가
            // 'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('주문 데이터를 불러오는데 실패했습니다');
        }

        let ordersData = await response.json();
        
        // 배열이 아닌 경우 처리
        if (!Array.isArray(ordersData)) {
          ordersData = ordersData.orders || [];
        }

        // 주문 상태 필터링
        let filteredOrders = ordersData;
        if (orderStatus !== "all") {
          filteredOrders = ordersData.filter((order: any) => order.order_status === orderStatus);
        }

        // 정렬
        filteredOrders.sort((a: any, b: any) => {
          const dateA = new Date(a.createdAt || a.created_at).getTime();
          const dateB = new Date(b.createdAt || b.created_at).getTime();
          return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
        });

        return filteredOrders;
      } catch (error) {
        console.error("주문 데이터 로드 오류:", error);
        
        // 오류 발생 시 더미 데이터 반환 (개발 단계)
        const dummyOrders = [
          {
            id: "ORD-001",
            createdAt: "2024-01-20T10:30:00Z",
            customer_name: "김영희",
            customer_phone: "010-1234-5678",
            orderItems: [
              { product: { title: "신선한 사과" }, quantity: 2, price: 15000 }
            ],
            total_amount: 30000,
            payment_method: "카드결제",
            payment_status: "paid",
            order_status: "pending",
            shipping_address: {
              name: "김영희",
              phone: "010-1234-5678",
              address: "서울시 강남구 테헤란로 123",
            },
            tracking_number: "",
            shipping_company: "",
          },
          {
            id: "ORD-002", 
            createdAt: "2024-01-19T14:15:00Z",
            customer_name: "박철수",
            customer_phone: "010-9876-5432",
            orderItems: [
              { product: { title: "유기농 배" }, quantity: 1, price: 25000 }
            ],
            total_amount: 25000,
            payment_method: "무통장입금",
            payment_status: "paid",
            order_status: "shipped",
            shipping_address: {
              name: "박철수",
              phone: "010-9876-5432", 
              address: "부산시 해운대구 센텀중앙로 456",
            },
            tracking_number: "123456789",
            shipping_company: "CJ대한통운",
          }
        ];

        // 주문 상태 필터링
        let filteredOrders = dummyOrders;
        if (orderStatus !== "all") {
          filteredOrders = dummyOrders.filter((order: any) => order.order_status === orderStatus);
        }

        // 정렬
        filteredOrders.sort((a: any, b: any) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
        });

        return filteredOrders;
      }
    },
    enabled: activeTab === "orders",
  });

  // 알림 데이터 가져오기 (더미 데이터로 시작)
  const { data: notifications, isLoading: isNotificationsLoading } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: async () => {
      try {
        // 실제 API 호출
        const response = await fetch('/api/notifications/admin', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            // 인증 토큰이 필요한 경우 추가
            // 'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('알림 데이터를 불러오는데 실패했습니다');
        }

        let notificationsData = await response.json();
        
        // 배열이 아닌 경우 처리
        if (!Array.isArray(notificationsData)) {
          notificationsData = notificationsData.notifications || [];
        }

        return notificationsData;
      } catch (error) {
        console.error("알림 데이터 로드 오류:", error);
        
        // 오류 발생 시 더미 데이터 반환 (개발 단계)
        return [
          {
            id: "NOTIF-001",
            type: "shipping",
            message: "주문 #ORD-002의 배송이 시작되었습니다. 택배사: CJ대한통운, 운송장번호: 123456789",
            order_id: "ORD-002",
            reference_id: "ORD-002",
            is_read: false,
            status: "unread",
            createdAt: "2024-01-19T15:30:00Z",
          },
          {
            id: "NOTIF-002",
            type: "order",
            message: "새로운 주문이 접수되었습니다.",
            order_id: "ORD-001",
            reference_id: "ORD-001",
            is_read: true,
            status: "read",
            createdAt: "2024-01-20T10:30:00Z",
          }
        ];
      }
    },
    enabled: activeTab === "analytics",
  });

  // 통계 데이터 계산
  const totalProducts = products.length;
  const activeProducts = products.filter((p: any) => p.status === "active").length;
  const totalValue = products.reduce((sum: number, p: any) => sum + (p.price * p.stock), 0);
  const lowStockProducts = products.filter((p: any) => p.stock < 10).length;

  // 상품 생성/수정 뮤테이션
  const saveProductMutation = useMutation({
    mutationFn: async (product: any) => {
      if (product.id) {
        return await productAPI.updateProduct(product.id, product);
      } else {
        return await productAPI.createProduct(product);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      setProductTab("list");
      setEditingProduct(null);
      resetProductForm();
      toast({
        title: "상품 저장 완료",
        description: "상품이 성공적으로 저장되었습니다.",
      });
    },
    onError: (error) => {
      toast({
        title: "상품 저장 실패",
        description: `오류가 발생했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
        variant: "destructive",
      });
    },
  });

  // 상품 삭제 뮤테이션
  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      return await productAPI.deleteProduct(productId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast({
        title: "상품 삭제 완료",
        description: "상품이 성공적으로 삭제되었습니다.",
      });
    },
    onError: (error) => {
      toast({
        title: "상품 삭제 실패",
        description: `오류가 발생했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
        variant: "destructive",
      });
    },
  });

  // 주문 상태 변경 뮤테이션
  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      // 실제 API 호출로 교체 예정
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      
      if (!response.ok) {
        throw new Error('주문 상태 변경에 실패했습니다');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast({
        title: "주문 상태 변경 완료",
        description: "주문 상태가 성공적으로 변경되었습니다.",
      });
    },
    onError: (error) => {
      toast({
        title: "주문 상태 변경 실패",
        description: `오류가 발생했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
        variant: "destructive",
      });
    },
  });

  // 배송 정보 업데이트 뮤테이션
  const updateShippingMutation = useMutation({
    mutationFn: async ({ 
      orderId, 
      trackingNumber, 
      shippingCompany 
    }: { 
      orderId: string; 
      trackingNumber: string; 
      shippingCompany: string; 
    }) => {
      // 실제 API 호출로 교체 예정
      const response = await fetch(`/api/orders/${orderId}/shipping`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          tracking_number: trackingNumber,
          shipping_company: shippingCompany,
          status: 'shipped'
        }),
      });
      
      if (!response.ok) {
        throw new Error('배송 정보 업데이트에 실패했습니다');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast({
        title: "배송 정보 업데이트 완료",
        description: "배송 정보가 성공적으로 업데이트되었습니다.",
      });
      setTrackingDialog(false);
      setTrackingNumber("");
      setShippingCompany("");
    },
    onError: (error) => {
      toast({
        title: "배송 정보 업데이트 실패",
        description: `오류가 발생했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
        variant: "destructive",
      });
    },
  });

  // 알림 읽음 처리 뮤테이션
  const markNotificationAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      // 실제 API 호출로 교체 예정
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('알림 읽음 처리에 실패했습니다');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
      toast({
        title: "알림 읽음 처리 완료",
        description: "알림이 읽음 처리되었습니다.",
      });
    },
    onError: (error) => {
      toast({
        title: "알림 읽음 처리 실패", 
        description: `오류가 발생했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
        variant: "destructive",
      });
    },
  });

  // 상품 폼 초기화
  const resetProductForm = () => {
    setProductForm({
      title: "",
      price: "",
      discount_price: "",
      description: "",
      stock: "",
      category_id: "",
      status: "active",
      images: []
    });
  };

  // 상품 등록 시작
  const handleCreateProduct = () => {
    resetProductForm();
    setEditingProduct(null);
    setProductTab("register");
  };

  // 상품 수정 시작
  const handleEditProduct = (product: any) => {
    setEditingProduct(product);
    setProductForm({
      title: product.title || "",
      price: product.price?.toString() || "",
      discount_price: product.discountPrice?.toString() || "",
      description: product.description || "",
      stock: product.stock?.toString() || "",
      category_id: product.categoryId?.toString() || product.category_id?.toString() || "",
      status: product.status || "active",
      images: product.images || []
    });
    setProductTab("edit");
  };

  // 기존 상품 수정 시 옵션 데이터 로드
  React.useEffect(() => {
    if (!editingProduct?.id) {
      setProductOptions([]);
      return;
    }

    let rawOptions: any = editingProduct.options;
    let optionsArray: any[] = [];

    if (rawOptions) {
      if (typeof rawOptions === "string") {
        try {
          optionsArray = JSON.parse(rawOptions);
        } catch (e) {
          console.error("옵션 문자열 파싱 오류:", e);
          optionsArray = [];
        }
      } else {
        optionsArray = rawOptions as any[];
      }
    }

    if (!Array.isArray(optionsArray)) {
      optionsArray = [];
    }

    const parsedOptions: ProductOption[] = optionsArray.map((opt: any) => {
      if (!opt) return { name: "", values: [] };

      let values = opt.values ?? [];
      if (typeof values === "string") {
        try {
          values = JSON.parse(values);
        } catch (e) {
          console.error("옵션 값 파싱 오류:", e);
          values = [];
        }
      }

      if (!Array.isArray(values) || values.length === 0) {
        values = [{ value: "", price_adjust: 0 }];
      }

      return {
        name: opt.name ?? "",
        values: values.map((v: any) => ({
          value: v.value ?? "",
          price_adjust: Number(v.price_adjust) || 0,
        })),
      };
    });

    if (parsedOptions.length === 0) {
      parsedOptions.push({
        name: "",
        values: [{ value: "", price_adjust: 0 }],
      });
    }

    setProductOptions(parsedOptions);
  }, [editingProduct]);

  // 상품 저장
  const handleSaveProduct = () => {
    if (!productForm.title || !productForm.price || !productForm.description) {
      toast({
        title: "입력 오류",
        description: "상품명, 가격, 설명은 필수 입력 항목입니다.",
        variant: "destructive",
      });
      return;
    }

    const productData: any = {
      ...productForm,
      price: Number(productForm.price),
      discount_price: productForm.discount_price ? Number(productForm.discount_price) : null,
      stock: Number(productForm.stock) || 0,
      category_id: Number(productForm.category_id) || 1,
      seller_id: user?.uid || 1,
      options: productOptions, // 옵션 포함
    };

    if (editingProduct) {
      productData.id = editingProduct.id;
    }

    console.log("=== 상품 저장 디버깅 ===");
    console.log("1. productForm:", productForm);
    console.log("2. 전송할 데이터:", productData);
    console.log("=== 저장 디버깅 끝 ===");

    saveProductMutation.mutate(productData);
  };

  // 상품 삭제
  const handleDeleteProduct = (productId: string, productTitle: string) => {
    if (confirm(`'${productTitle}' 상품을 삭제하시겠습니까?`)) {
      deleteProductMutation.mutate(productId);
    }
  };

  // 이미지 업로드 처리
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    try {
      const file = e.target.files[0];

      // 파일 크기 제한 (10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "파일 크기 초과",
          description: "이미지 크기는 10MB 이하여야 합니다.",
          variant: "destructive",
        });
        return;
      }

      // 이미지 타입 체크
      if (!file.type.startsWith("image/")) {
        toast({
          title: "잘못된 파일 형식",
          description: "이미지 파일만 업로드 가능합니다.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "이미지 업로드 중",
        description: "서버에 이미지를 업로드하고 있습니다...",
      });

      // FormData 생성
      const formData = new FormData();
      formData.append('image', file);

      console.log("🛍️ 상품 이미지 업로드 시작:", {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });

      // 서버로 이미지 업로드 (상품 이미지 전용 API 사용)
      const response = await fetch('/api/upload/product-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("🛍️ 서버 오류 응답:", errorText);
        throw new Error(`이미지 업로드에 실패했습니다. (${response.status})`);
      }

      const result = await response.json();
      console.log("🛍️ 서버 응답 데이터:", result);
      
      if (result.success && result.imageUrl) {
        // 이미지 URL을 상태에 저장 (base64 대신 서버 URL 사용)
        const newImages = [...productForm.images, result.imageUrl];
        setProductForm({ ...productForm, images: newImages });

        toast({
          title: "이미지 업로드 성공",
          description: "이미지가 성공적으로 업로드되었습니다.",
          variant: "default",
        });
      } else {
        console.error("🛍️ 예상치 못한 응답 형식:", result);
        throw new Error('서버 응답이 올바르지 않습니다.');
      }

    } catch (error) {
      console.error("이미지 업로드 오류:", error);
      toast({
        title: "이미지 업로드 실패",
        description: error instanceof Error ? error.message : "이미지 업로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // 이미지 제거
  const removeImage = (index: number) => {
    const newImages = productForm.images.filter((_, i) => i !== index);
    setProductForm({ ...productForm, images: newImages });
  };

  // 옵션 값과 추가 가격 추가
  const addOptionValue = () => {
    if (!optionValues.trim()) {
      toast({
        title: "옵션 값을 입력하세요",
        variant: "destructive",
      });
      return;
    }

    const price = additionalPrice ? Number(additionalPrice) : 0;
    setTempOptionValues([
      ...tempOptionValues,
      { value: optionValues, price_adjust: price },
    ]);

    setOptionValues("");
    setAdditionalPrice("");
  };

  // 옵션 추가
  const addOption = () => {
    if (!optionName.trim()) {
      toast({
        title: "옵션 이름을 입력하세요",
        variant: "destructive",
      });
      return;
    }

    if (tempOptionValues.length === 0) {
      toast({
        title: "최소 하나 이상의 옵션 값을 추가하세요",
        variant: "destructive",
      });
      return;
    }

    const newOption: ProductOption = {
      name: optionName,
      values: tempOptionValues,
    };

    setProductOptions([...productOptions, newOption]);
    setOptionName("");
    setTempOptionValues([]);
  };

  // 옵션 삭제
  const removeOption = (index: number) => {
    const updatedOptions = [...productOptions];
    updatedOptions.splice(index, 1);
    setProductOptions(updatedOptions);
  };

  // 옵션 값 삭제
  const removeOptionValue = (index: number) => {
    const updatedValues = [...tempOptionValues];
    updatedValues.splice(index, 1);
    setTempOptionValues(updatedValues);
  };

  // 상품 설명용 이미지 업로드 처리
  const handleDescriptionImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    try {
      const file = e.target.files[0];

      // 파일 크기 제한 (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "파일 크기 초과",
          description: "이미지 크기는 5MB 이하여야 합니다.",
          variant: "destructive",
        });
        return;
      }

      // 이미지 타입 체크
      if (!file.type.startsWith("image/")) {
        toast({
          title: "잘못된 파일 형식",
          description: "이미지 파일만 업로드 가능합니다.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "이미지 업로드 중",
        description: "서버에 이미지를 업로드하고 있습니다...",
      });

      // FormData 생성
      const formData = new FormData();
      formData.append('image', file);

      console.log("🖼️ 이미지 업로드 시작:", {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });

      // 서버로 이미지 업로드 (일반 이미지 API 사용)
      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      });

      console.log("🖼️ 서버 응답 상태:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("🖼️ 서버 오류 응답:", errorText);
        throw new Error(`이미지 업로드에 실패했습니다. (${response.status})`);
      }

      const result = await response.json();
      console.log("🖼️ 서버 응답 데이터:", result);
      
      if (result.success && result.imageUrl) {
        // 현재 설명 내용 확인
        const currentDescription = productForm.description;
        console.log("🖼️ 현재 설명 길이:", currentDescription.length);
        
        // HTML 코드에 이미지 태그 삽입 (서버 URL 사용)
        const imageUrl = normalizeImageUrl(`${result.imageUrl}`);
        const imageHtml = `\n<img src="${imageUrl}" alt="상품설명이미지" style="max-width: 100%; height: auto; margin: 10px 0; border-radius: 8px;" />\n`;
        const newDescription = currentDescription + imageHtml;
        
        console.log("🖼️ 새로운 설명 길이:", newDescription.length);
        console.log("🖼️ 추가된 HTML:", imageHtml);
        
        setProductForm({ ...productForm, description: newDescription });

        // 파일 입력 필드 초기화
        if (descriptionImageInputRef.current) {
          descriptionImageInputRef.current.value = '';
        }

        toast({
          title: "✅ 이미지 업로드 성공!",
          description: `${file.name}이 상품 설명에 추가되었습니다. 미리보기 탭에서 확인해보세요.`,
          variant: "default",
        });
        
        // 미리보기 모드로 자동 전환
        setTimeout(() => {
          setDescriptionMode('preview');
        }, 1000);
      } else {
        console.error("🖼️ 예상치 못한 응답 형식:", result);
        throw new Error('서버 응답이 올바르지 않습니다.');
      }
    } catch (error) {
      console.error("이미지 업로드 오류:", error);
      toast({
        title: "이미지 업로드 실패",
        description: error instanceof Error ? error.message : "이미지 업로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // 주문 상태 변경 핸들러
  const handleOrderStatusChange = (orderId: string, newStatus: string) => {
    // 배송중 상태로 변경할 때는 운송장 번호 입력 다이얼로그 표시
    if (newStatus === "shipped") {
      setSelectedOrderId(orderId);
      setTrackingNumber("");
      setShippingCompany("");
      setTrackingDialog(true);
      return;
    }

    updateOrderStatusMutation.mutate({ orderId, status: newStatus });
  };

  // 배송 정보 업데이트 핸들러
  const handleShippingUpdate = () => {
    if (!selectedOrderId || !trackingNumber.trim() || !shippingCompany.trim()) {
      toast({
        title: "입력 오류",
        description: "운송장 번호와 택배사를 모두 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    updateShippingMutation.mutate({
      orderId: selectedOrderId,
      trackingNumber,
      shippingCompany,
    });
  };

  // 알림 읽음 처리 핸들러
  const handleMarkNotificationAsRead = (notificationId: string) => {
    markNotificationAsReadMutation.mutate(notificationId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Store className="h-6 w-6 text-blue-600" />
          쇼핑몰 관리
        </h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">개요</TabsTrigger>
          <TabsTrigger value="products">상품 관리</TabsTrigger>
          <TabsTrigger value="orders">주문/배송 관리</TabsTrigger>
          <TabsTrigger value="analytics">알림 관리</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* 통계 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 상품</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalProducts}</div>
                <p className="text-xs text-muted-foreground">
                  활성 상품: {activeProducts}개
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">재고 가치</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.floor(totalValue).toLocaleString()}원
                </div>
                <p className="text-xs text-muted-foreground">
                  총 재고 금액
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">재고 부족</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{lowStockProducts}</div>
                <p className="text-xs text-muted-foreground">
                  10개 미만 상품
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">오늘 주문</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">
                  신규 주문 건수
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 최근 활동 */}
          <Card>
            <CardHeader>
              <CardTitle>최근 활동</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <Bell className="h-4 w-4 text-blue-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">새로운 상품 등록됨</p>
                    <p className="text-xs text-muted-foreground">2시간 전</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Truck className="h-4 w-4 text-green-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">주문 배송 시작</p>
                    <p className="text-xs text-muted-foreground">4시간 전</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Package className="h-4 w-4 text-orange-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">재고 부족 알림</p>
                    <p className="text-xs text-muted-foreground">6시간 전</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-2">
                <CardTitle>상품 관리</CardTitle>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <Button 
                    variant={productTab === "list" ? "default" : "outline"}
                    onClick={() => setProductTab("list")}
                    className="flex-grow sm:flex-grow-0"
                  >
                    상품 목록
                  </Button>
                  <Button 
                    variant={productTab === "register" ? "default" : "outline"}
                    onClick={handleCreateProduct}
                    className="flex-grow sm:flex-grow-0"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    상품 등록
                  </Button>
                  {editingProduct && (
                    <Button 
                      variant={productTab === "edit" ? "default" : "outline"}
                      onClick={() => setProductTab("edit")}
                      className="flex-grow sm:flex-grow-0"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      상품 수정
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* 상품 목록 */}
              {productTab === "list" && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="상품명 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-64"
                      />
                    </div>
                  </div>
                  
                  {products.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b">
                            <th className="py-3 px-4">상품명</th>
                            <th className="py-3 px-4">가격</th>
                            <th className="py-3 px-4">재고</th>
                            <th className="py-3 px-4">상태</th>
                            <th className="py-3 px-4">관리</th>
                          </tr>
                        </thead>
                        <tbody>
                          {products
                            .filter((product: any) =>
                              product.title?.toLowerCase().includes(searchTerm.toLowerCase())
                            )
                            .slice(0, 10)
                            .map((product: any) => (
                              <tr key={product.id} className="border-b hover:bg-gray-50">
                                <td className="py-3 px-4">
                                  <div className="font-medium">{product.title}</div>
                                  <div className="text-sm text-gray-500">ID: {product.id}</div>
                                </td>
                                <td className="py-3 px-4">
                                  {Math.floor(product.price).toLocaleString()}원
                                </td>
                                <td className="py-3 px-4">
                                  <span className={product.stock < 10 ? "text-red-600 font-medium" : ""}>
                                    {product.stock}개
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <Badge
                                    variant={
                                      product.status === "active"
                                        ? "default"
                                        : product.status === "sold_out"
                                        ? "destructive"
                                        : "outline"
                                    }
                                  >
                                    {product.status === "active"
                                      ? "판매중"
                                      : product.status === "sold_out"
                                      ? "품절"
                                      : product.status === "hidden"
                                      ? "숨김"
                                      : "삭제됨"}
                                  </Badge>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex gap-1">
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => handleEditProduct(product)}
                                      title="상품 수정"
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="destructive"
                                      onClick={() => handleDeleteProduct(product.id, product.title)}
                                      title="상품 삭제"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      등록된 상품이 없습니다.
                    </div>
                  )}
                </div>
              )}

              {/* 상품 등록/수정 폼 */}
              {(productTab === "register" || productTab === "edit") && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      {productTab === "register" ? "새 상품 등록" : "상품 수정"}
                    </h3>
                    <Button 
                      variant="outline" 
                      onClick={() => setProductTab("list")}
                    >
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      목록으로
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 좌측 컬럼 */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">상품명</label>
                        <Input
                          value={productForm.title}
                          onChange={(e) => setProductForm({ ...productForm, title: e.target.value })}
                          placeholder="상품명을 입력하세요"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">가격</label>
                        <Input
                          type="number"
                          value={productForm.price}
                          onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                          placeholder="가격을 입력하세요"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">할인 가격</label>
                        <Input
                          type="number"
                          value={productForm.discount_price}
                          onChange={(e) => setProductForm({ ...productForm, discount_price: e.target.value })}
                          placeholder="할인 가격을 입력하세요"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">재고 수량</label>
                        <Input
                          type="number"
                          value={productForm.stock}
                          onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                          placeholder="재고 수량을 입력하세요"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">카테고리</label>
                        <select
                          className="w-full border rounded-md p-2"
                          value={productForm.category_id}
                          onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}
                        >
                          <option value="">카테고리 선택</option>
                          {(categoriesData || [])
                            .filter((cat: string) => cat !== "전체")
                            .map((category: string, index: number) => (
                              <option key={index} value={index + 1}>
                                {category}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">상태</label>
                        <select
                          className="w-full border rounded-md p-2"
                          value={productForm.status}
                          onChange={(e) => setProductForm({ ...productForm, status: e.target.value })}
                        >
                          <option value="active">판매중</option>
                          <option value="hidden">숨김</option>
                          <option value="sold_out">품절</option>
                        </select>
                      </div>

                      {/* 상품 이미지 */}
                      <div>
                        <label className="block text-sm font-medium mb-1">상품 이미지</label>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleImageUpload}
                          accept="image/*"
                          className="hidden"
                        />
                        <div
                          className="border-2 border-dashed rounded-md p-4 text-center cursor-pointer hover:bg-gray-50"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="h-6 w-6 mx-auto mb-2 text-gray-400" />
                          <p>이미지 업로드</p>
                          <p className="text-xs text-gray-500">클릭하여 이미지를 선택하세요</p>
                        </div>

                        {/* 업로드된 이미지 미리보기 */}
                        {productForm.images.length > 0 && (
                          <div className="mt-4">
                            <p className="text-sm font-medium mb-2">업로드된 이미지</p>
                            <div className="flex flex-wrap gap-2">
                              {productForm.images.map((img: string, index: number) => (
                                <div
                                  key={index}
                                  className="relative w-20 h-20 border rounded-md overflow-hidden group"
                                >
                                  <img
                                    src={getImageUrl(img)}
                                    alt={`상품 이미지 ${index + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                  <button 
                                    className="absolute top-0 right-0 bg-red-500 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeImage(index);
                                    }}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 우측 컬럼 - 상품 옵션 */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">상품 옵션</label>

                        {/* 등록된 옵션 목록 */}
                        {productOptions.length > 0 && (
                          <div className="mb-4 border rounded-md p-3 bg-gray-50">
                            <h4 className="font-medium text-sm mb-2">등록된 옵션</h4>
                            {productOptions.map((option, index) => (
                              <div
                                key={index}
                                className="mb-3 pb-3 border-b last:border-0"
                              >
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-medium">{option.name}</span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 text-red-500"
                                    onClick={() => removeOption(index)}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  {option.values.map((val, i) => (
                                    <div
                                      key={i}
                                      className="text-sm bg-white p-1 rounded border flex justify-between"
                                    >
                                      <span>{val.value}</span>
                                      <span className="text-blue-600">
                                        +{Math.floor(val.price_adjust).toLocaleString()}원
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 새 옵션 추가 폼 */}
                        <div className="border rounded-md p-3">
                          <div className="mb-3">
                            <label className="block text-xs mb-1">옵션명</label>
                            <Input
                              value={optionName}
                              onChange={(e) => setOptionName(e.target.value)}
                              placeholder="예: 사이즈, 색상"
                              className="flex-1"
                            />
                          </div>

                          {/* 옵션 값 추가 */}
                          <div className="mb-3">
                            <label className="block text-xs mb-1">옵션 값</label>
                            <div className="flex gap-2">
                              <Input
                                value={optionValues}
                                onChange={(e) => setOptionValues(e.target.value)}
                                placeholder="예: S, 빨강"
                                className="flex-1"
                              />
                              <Input
                                type="number"
                                value={additionalPrice}
                                onChange={(e) => setAdditionalPrice(e.target.value)}
                                placeholder="추가 가격"
                                className="w-32"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={addOptionValue}
                              >
                                추가
                              </Button>
                            </div>
                          </div>

                          {/* 임시 옵션 값 목록 */}
                          {tempOptionValues.length > 0 && (
                            <div className="mb-3">
                              <label className="block text-xs mb-1">추가된 옵션 값</label>
                              <div className="flex flex-wrap gap-2">
                                {tempOptionValues.map((val, index) => (
                                  <div
                                    key={index}
                                    className="flex items-center bg-gray-100 rounded px-2 py-1 text-sm"
                                  >
                                    <span>
                                      {val.value} (+{Math.floor(val.price_adjust).toLocaleString()}원)
                                    </span>
                                    <button 
                                      className="ml-1 text-red-500"
                                      onClick={() => removeOptionValue(index)}
                                    >
                                      <XCircle className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <Button
                            size="sm"
                            variant="secondary"
                            className="w-full"
                            onClick={addOption}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            옵션 그룹 추가
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 상품 설명 - HTML 에디터 */}
                  <div>
                    <label className="block text-sm font-medium mb-1">상품 설명</label>
                    <div className="border rounded-md overflow-hidden">
                      {/* 에디터 탭 */}
                      <div className="flex border-b bg-gray-50">
                        <button
                          type="button"
                          className={`px-3 py-2 text-sm flex items-center gap-1 ${
                            descriptionMode === 'html' 
                              ? 'bg-white border-b-2 border-blue-500 text-blue-600' 
                              : 'text-gray-600 hover:text-gray-800'
                          }`}
                          onClick={() => setDescriptionMode('html')}
                        >
                          <Code className="h-4 w-4" />
                          HTML 코드
                        </button>
                        <button
                          type="button"
                          className={`px-3 py-2 text-sm flex items-center gap-1 ${
                            descriptionMode === 'preview' 
                              ? 'bg-white border-b-2 border-blue-500 text-blue-600' 
                              : 'text-gray-600 hover:text-gray-800'
                          }`}
                          onClick={() => setDescriptionMode('preview')}
                        >
                          <Monitor className="h-4 w-4" />
                          미리보기
                        </button>
                        
                        {/* 이미지 업로드 버튼 */}
                        <div className="ml-auto flex items-center">
                          <input
                            type="file"
                            ref={descriptionImageInputRef}
                            onChange={handleDescriptionImageUpload}
                            accept="image/*"
                            className="hidden"
                          />
                          <button
                            type="button"
                            className="px-3 py-2 text-sm flex items-center gap-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100"
                            onClick={() => descriptionImageInputRef.current?.click()}
                            title="이미지 추가"
                          >
                            <ImageIcon className="h-4 w-4" />
                            이미지 추가
                          </button>
                        </div>
                      </div>

                      {/* 에디터 내용 */}
                      {descriptionMode === 'html' ? (
                        <div className="relative">
                          <textarea
                            className="w-full p-3 min-h-[200px] font-mono text-sm resize-none border-0 focus:outline-none focus:ring-0"
                            value={productForm.description}
                            onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                            placeholder={`HTML 코드를 입력하세요. 예시:

<h3>상품 특징</h3>
<ul>
  <li>고품질 재료 사용</li>
  <li>무료배송 지원</li>
</ul>

<h3>상품 이미지</h3>
<img src="이미지URL" alt="상품이미지" style="max-width: 100%; height: auto;" />

<h3>상세 설명</h3>
<p>이곳에 상세한 설명을 작성하세요.</p>

💡 우측 상단의 "이미지 추가" 버튼을 사용하여 이미지를 업로드할 수 있습니다.`}
                          />
                          
                          {/* HTML 입력 도움말 */}
                          <div className="absolute bottom-2 right-2">
                            <div className="group relative">
                              <button 
                                type="button"
                                className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-blue-600"
                              >
                                ?
                              </button>
                              <div className="absolute bottom-8 right-0 w-80 p-3 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                <div className="font-medium mb-2">HTML 태그 예시:</div>
                                <div className="space-y-1">
                                  <div><code>&lt;h3&gt;제목&lt;/h3&gt;</code> - 제목</div>
                                  <div><code>&lt;p&gt;내용&lt;/p&gt;</code> - 문단</div>
                                  <div><code>&lt;br&gt;</code> - 줄바꿈</div>
                                  <div><code>&lt;ul&gt;&lt;li&gt;목록&lt;/li&gt;&lt;/ul&gt;</code> - 목록</div>
                                  <div><code>&lt;img src="URL" alt="설명"&gt;</code> - 이미지</div>
                                  <div><code>&lt;a href="URL"&gt;링크&lt;/a&gt;</code> - 링크</div>
                                </div>
                                <div className="mt-2 pt-2 border-t border-gray-600">
                                  <div className="font-medium mb-1">💡 이미지 추가 팁:</div>
                                  <div>우측 상단의 "이미지 추가" 버튼을 클릭하여 쉽게 이미지를 업로드할 수 있습니다.</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div 
                          className="w-full p-3 min-h-[200px] bg-white prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ 
                            __html: normalizeHtmlImageSrc(productForm.description || "")
                          }}
                        />
                      )}
                    </div>
                    
                    {/* 설명 길이 표시 */}
                    <div className="flex justify-between items-center mt-1 text-xs text-gray-500">
                      <span>
                        {descriptionMode === 'html' && productForm.description.length > 0 && (
                          <>HTML 코드 길이: {productForm.description.length}자</>
                        )}
                      </span>
                      <span>
                        {productForm.description.length > 1000 && (
                          <span className="text-amber-600">
                            ⚠ 긴 설명은 로딩 속도에 영향을 줄 수 있습니다
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setProductTab("list")}
                    >
                      <X className="h-4 w-4 mr-1" />
                      취소
                    </Button>
                    <Button 
                      onClick={handleSaveProduct}
                      disabled={saveProductMutation.isPending}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      {saveProductMutation.isPending ? "저장 중..." : "저장"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>주문/배송 관리</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="주문번호 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <select
                  className="w-40 border rounded-md p-2"
                  value={orderStatus}
                  onChange={(e) => setOrderStatus(e.target.value)}
                >
                  <option value="all">모든 주문</option>
                  <option value="pending">대기 중</option>
                  <option value="paid">결제 완료</option>
                  <option value="shipped">배송 중</option>
                  <option value="completed">배송 완료</option>
                  <option value="cancelled">취소됨</option>
                </select>
                <select
                  className="w-32 border rounded-md p-2"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as "desc" | "asc")}
                >
                  <option value="desc">최신순</option>
                  <option value="asc">오래된순</option>
                </select>
              </div>

              {isOrdersLoading ? (
                <div className="text-center py-12 text-gray-500">
                  <Truck className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>주문 목록을 불러오는 중입니다...</p>
                </div>
              ) : (!orders || orders.length === 0) ? (
                <div className="text-center py-12 text-gray-500">
                  <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>검색된 주문이 없습니다.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b">
                        <th className="py-3 px-4">주문번호</th>
                        <th className="py-3 px-4">고객명</th>
                        <th className="py-3 px-4">총 금액</th>
                        <th className="py-3 px-4">결제 상태</th>
                        <th className="py-3 px-4">주문 상태</th>
                        <th className="py-3 px-4">배송 상태</th>
                        <th className="py-3 px-4">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(orders || [])
                        .filter((order: any) => order.id.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map((order: any) => (
                          <tr key={order.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div className="font-medium">{order.id}</div>
                              <div className="text-sm text-gray-500">
                                {new Date(order.createdAt).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div>{order.customer_name}</div>
                              <div className="text-sm text-gray-500">{order.customer_phone}</div>
                            </td>
                            <td className="py-3 px-4">
                              {Math.floor(order.total_amount).toLocaleString()}원
                            </td>
                            <td className="py-3 px-4">
                              <Badge
                                variant={order.payment_status === "paid" ? "default" : "outline"}
                              >
                                {order.payment_status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <Badge
                                variant={order.order_status === "pending" ? "default" : "outline"}
                              >
                                {order.order_status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <Badge
                                variant={order.tracking_number ? "default" : "outline"}
                              >
                                {order.tracking_number ? "배송 중" : "대기 중"}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col gap-2">
                                <select
                                  className="text-xs border rounded p-1 w-24"
                                  value={order.order_status}
                                  onChange={(e) => handleOrderStatusChange(order.id, e.target.value)}
                                  disabled={updateOrderStatusMutation.isPending}
                                >
                                  <option value="pending">주문접수</option>
                                  <option value="processing">처리중</option>
                                  <option value="shipped">배송중</option>
                                  <option value="delivered">배송완료</option>
                                  <option value="cancelled">주문취소</option>
                                </select>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedOrderId(order.id);
                                    setTrackingNumber(order.tracking_number || "");
                                    setShippingCompany(order.shipping_company || "");
                                    setTrackingDialog(true);
                                  }}
                                  title="운송장 정보 관리"
                                  className="text-xs h-7"
                                >
                                  <Truck className="h-3 w-3 mr-1" />
                                  운송장
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 추적 번호 입력 다이얼로그 */}
          <Dialog open={trackingDialog} onOpenChange={setTrackingDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>추적 번호 입력</DialogTitle>
                <DialogDescription>
                  주문번호 {selectedOrderId}의 추적 번호를 입력해주세요.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="tracking-number" className="text-right">
                    추적 번호:
                  </Label>
                  <Input
                    id="tracking-number"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="shipping-company" className="text-right">
                    택배사:
                  </Label>
                  <select
                    id="shipping-company"
                    value={shippingCompany}
                    onChange={(e) => setShippingCompany(e.target.value)}
                    className="col-span-3 border rounded-md p-2"
                  >
                    <option value="">택배사 선택</option>
                    {KOREAN_CARRIERS.map((carrier, index) => (
                      <option key={index} value={carrier}>
                        {carrier}
                      </option>
                    ))}
                    <option value="custom">기타 (직접 입력)</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setTrackingDialog(false)}>
                    취소
                  </Button>
                  <Button onClick={handleShippingUpdate}>
                    저장
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>알림 관리</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="알림 메시지 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <select
                  className="w-40 border rounded-md p-2"
                  value={searchTerm} // 검색어를 상태로 사용
                  onChange={(e) => setSearchTerm(e.target.value)}
                >
                  <option value="">모든 알림</option>
                  <option value="shipping">배송 관련</option>
                  <option value="order">주문 관련</option>
                </select>
              </div>

              {isNotificationsLoading ? (
                <div className="text-center py-12 text-gray-500">
                  <Bell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>알림 목록을 불러오는 중입니다...</p>
                </div>
              ) : (!notifications || notifications.length === 0) ? (
                <div className="text-center py-12 text-gray-500">
                  <Bell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>검색된 알림이 없습니다.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b">
                        <th className="py-3 px-4">알림 ID</th>
                        <th className="py-3 px-4">메시지</th>
                        <th className="py-3 px-4">타입</th>
                        <th className="py-3 px-4">주문 번호</th>
                        <th className="py-3 px-4">읽음 여부</th>
                        <th className="py-3 px-4">상태</th>
                        <th className="py-3 px-4">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(notifications || [])
                        .filter((notif: any) => notif.message.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map((notif: any) => (
                          <tr key={notif.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div className="font-medium">{notif.id}</div>
                              <div className="text-sm text-gray-500">
                                {new Date(notif.createdAt).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div>{notif.message}</div>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="outline">{notif.type}</Badge>
                            </td>
                            <td className="py-3 px-4">
                              <div>{notif.order_id}</div>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant={notif.is_read ? "default" : "outline"}>
                                {notif.is_read ? "읽음" : "안 읽음"}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="outline">{notif.status}</Badge>
                            </td>
                            <td className="py-3 px-4">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleMarkNotificationAsRead(notif.id)}
                                title="읽음 처리"
                              >
                                <CheckCircle className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ShopPage; 