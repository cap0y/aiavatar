// Window 인터페이스 확장 - 셀러 인증 캐시 지원
declare global {
  interface Window {
    sellerCertificationCache?: Map<string, boolean>;
  }
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";
import { api } from "../../lib/axios-config";
import React from "react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Booking, CareManager } from "@shared/schema";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { productAPI } from "@/lib/api";
import {
  Package,
  Store,
  Plus,
  Edit,
  Trash2,
  Search,
  TrendingUp,
  ArrowLeft,
  Save,
  X,
  Upload,
  XCircle,
  Code,
  Monitor,
  ImageIcon,
  CheckCircle,
  AlertCircle,
  Clock,
  Send,
  ArrowUpDown,
  MoreVertical,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import PortOne from "@portone/browser-sdk/v2"; // 포트원 SDK 추가
import { normalizeImageUrl, normalizeHtmlImageSrc } from "@/lib/url";
import { changePassword } from "@/lib/api";

// 배송사 목록
const KOREAN_CARRIERS = [
  { value: "cj", label: "CJ대한통운" },
  { value: "lotte", label: "롯데택배" },
  { value: "hanjin", label: "한진택배" },
  { value: "post", label: "우체국택배" },
  { value: "logen", label: "로젠택배" },
  { value: "epost", label: "우체국 EMS" },
  { value: "kgb", label: "KGB택배" },
  { value: "custom", label: "직접 입력" },
];

interface ProductOptionValue {
  value: string;
  price_adjust: number;
}

interface ProductOption {
  id?: string;
  name: string;
  values: ProductOptionValue[];
}

// 소개글 콘텐츠 인터페이스 추가
interface IntroContent {
  id: string;
  type: "text" | "image" | "link" | "youtube";
  content: string;
  link?: string;
  description?: string;
}

interface CareManagerProfileProps {
  user: any;
}

const CareManagerProfile = ({ user }: CareManagerProfileProps) => {
  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("bookings");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  // 서비스(일거리) 관리 상태
  const [servicesList, setServicesList] = useState<string[]>([]);
  const [newService, setNewService] = useState<string>("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingServiceName, setEditingServiceName] = useState<string>("");
  // 금액 입력 기능 제거: 가격 배열 유지하지만 UI에서는 사용하지 않음
  const [servicePrices, setServicePrices] = useState<number[]>([]);
  const [newServicePrice] = useState<number>(0);
  const [editingServicePrice] = useState<number>(0);
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [locationInput, setLocationInput] = useState<string>("");
  const [experience, setExperience] = useState<string>("");
  const [nameInput, setNameInput] = useState<string>("");
  const [ageInput, setAgeInput] = useState<number>(0);
  const [descriptionInput, setDescriptionInput] = useState<string>("");
  // 소개글 콘텐츠 상태 추가
  const [introContents, setIntroContents] = useState<IntroContent[]>([]);
  const [certifiedInput, setCertifiedInput] = useState<boolean>(false);
  const [certifications, setCertifications] = useState<string>(""); // 자격증 정보 상태 추가
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 인증 관련 상태 추가
  const [isCertified, setIsCertified] = useState<boolean>(false);
  const [certificationOpacity, setCertificationOpacity] = useState<number>(0.3);
  const [showCertificationPayment, setShowCertificationPayment] =
    useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const queryClient = useQueryClient();

  // 쇼핑몰 관련 상태
  const [searchTerm, setSearchTerm] = useState("");
  const [productTab, setProductTab] = useState("list"); // 상품 관리 서브 탭
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productForm, setProductForm] = useState({
    title: "",
    price: "",
    discount_price: "",
    description: "",
    stock: "",
    category_id: "",
    status: "active",
    images: [] as string[],
  });

  // 주문 관리 관련 상태
  const [orderStatus, setOrderStatus] = useState<string>("all");
  const [orderSearchTerm, setOrderSearchTerm] = useState<string>("");
  const [trackingDialog, setTrackingDialog] = useState<boolean>(false);
  const [trackingNumber, setTrackingNumber] = useState<string>("");
  const [shippingCompany, setShippingCompany] = useState<string>("cj");
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [customCarrier, setCustomCarrier] = useState<string>("");

  // HTML 에디터 관련 상태 추가
  const [descriptionMode, setDescriptionMode] = useState<"html" | "preview">(
    "html",
  );

  // 상품 옵션 관련 상태
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [optionName, setOptionName] = useState<string>("");
  const [optionValues, setOptionValues] = useState<string>("");
  const [additionalPrice, setAdditionalPrice] = useState<string>("");
  const [tempOptionValues, setTempOptionValues] = useState<
    ProductOptionValue[]
  >([]);

  // 케어매니저 정보 조회
  const careManagerId = user?.uid ? parseInt(user.uid) : 0;

  // 상품 설명용 이미지 업로드 ref 추가
  const descriptionImageInputRef = useRef<HTMLInputElement>(null);

  const { updateUserPhoto } = useAuth(); // 추가

  // 알림 시간 표시 포맷 함수
  const formatNotificationTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) {
      return "방금 전";
    } else if (diffMin < 60) {
      return `${diffMin}분 전`;
    } else if (diffHour < 24) {
      return `${diffHour}시간 전`;
    } else if (diffDay < 7) {
      return `${diffDay}일 전`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const { data: careManager } = useQuery<CareManager>({
    queryKey: ["/api/care-managers", careManagerId],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/care-managers/${careManagerId}`,
      );
      if (!response.ok)
        throw new Error("케어매니저 정보를 불러오는데 실패했습니다");
      return response.json();
    },
    enabled: !!careManagerId,
  });

  // 예약 목록 조회
  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ["/api/bookings/care-manager", careManagerId],
    queryFn: async () => {
      try {
        const response = await apiRequest(
          "GET",
          `/api/bookings/care-manager/${careManagerId}`,
        );
        if (!response.ok) {
          if (response.status === 404) {
            console.warn(
              `케어매니저 ${careManagerId}의 예약 목록 API가 구현되지 않았습니다.`,
            );
            return []; // 404 에러 시 빈 배열 반환
          }
          throw new Error("예약 목록을 불러오는데 실패했습니다");
        }
        return response.json();
      } catch (error) {
        console.warn("예약 목록 로드 실패:", error);
        return []; // 에러 시 빈 배열 반환
      }
    },
    enabled: !!careManagerId,
    retry: false, // 재시도 비활성화
    refetchOnWindowFocus: false, // 창 포커스 시 재요청 비활성화
  });

  // 날짜별 예약 조회
  const { data: dateBookings = [] } = useQuery<Booking[]>({
    queryKey: [
      "/api/bookings/care-manager-date",
      careManagerId,
      format(selectedDate, "yyyy-MM-dd"),
    ],
    queryFn: async () => {
      const formattedDate = format(selectedDate, "yyyy-MM-dd");
      const response = await apiRequest(
        "GET",
        `/api/bookings/care-manager-date/${careManagerId}/${formattedDate}`,
      );
      if (!response.ok)
        throw new Error("날짜별 예약을 불러오는데 실패했습니다");
      return response.json();
    },
    enabled: !!careManagerId && !!selectedDate,
  });

  // 케어매니저의 상품 목록 가져오기
  const { data: products = [] } = useQuery({
    queryKey: ["care-manager-products", user?.uid],
    queryFn: async () => {
      try {
        console.log("=== 케어매니저 상품 조회 디버깅 ===");
        console.log("1. user 전체 객체:", user);
        console.log("2. user?.uid:", user?.uid, "타입:", typeof user?.uid);
        console.log(
          "3. user?.id:",
          (user as any)?.id,
          "타입:",
          typeof (user as any)?.id,
        );
        console.log("4. user?.email:", user?.email);

        // 먼저 모든 상품을 조회해서 현재 어떤 상품들이 있는지 확인
        console.log("5. 전체 상품 조회 시작...");
        const allProductsResponse = await productAPI.getProducts({ limit: 50 });
        const allProducts = Array.isArray(allProductsResponse)
          ? allProductsResponse
          : allProductsResponse?.products || [];
        console.log("6. 전체 상품 수:", allProducts.length);
        console.log(
          "7. 전체 상품의 sellerId 목록:",
          allProducts.map((p: any) => ({
            id: p.id,
            title: p.title,
            sellerId: p.sellerId,
            sellerIdType: typeof p.sellerId,
            seller_id: p.seller_id,
          })),
        );

        // 케어매니저 상품 필터링 조회 - user.uid 먼저 시도
        console.log("8. 케어매니저 상품 필터링 조회 시작...");
        console.log("9. 필터링에 사용할 seller_id (uid):", user?.uid);
        let response = await productAPI.getProducts({
          seller_id: user?.uid,
          limit: 50,
        });
        console.log("10. uid로 필터링된 상품 조회 응답:", response);
        let filteredProducts = Array.isArray(response)
          ? response
          : response?.products || [];
        console.log("11. uid로 필터링된 상품 수:", filteredProducts.length);

        // uid로 결과가 없으면 user.id로 다시 시도
        if (filteredProducts.length === 0 && (user as any)?.id !== user?.uid) {
          console.log(
            "12. uid로 상품 없음, user.id로 재시도:",
            (user as any)?.id,
          );
          response = await productAPI.getProducts({
            seller_id: (user as any)?.id,
            limit: 50,
          });
          console.log("13. id로 필터링된 상품 조회 응답:", response);
          filteredProducts = Array.isArray(response)
            ? response
            : response?.products || [];
          console.log("14. id로 필터링된 상품 수:", filteredProducts.length);
        }

        // 그래도 없으면 이메일 기반으로 확인 (decom2@gmail.com의 경우 seller_id가 1일 수도 있음)
        if (
          filteredProducts.length === 0 &&
          user?.email === "decom2@gmail.com"
        ) {
          console.log("15. decom2@gmail.com 특별 처리, seller_id=1로 시도");
          response = await productAPI.getProducts({
            seller_id: 1,
            limit: 50,
          });
          console.log("16. seller_id=1로 필터링된 상품 조회 응답:", response);
          filteredProducts = Array.isArray(response)
            ? response
            : response?.products || [];
          console.log(
            "17. seller_id=1로 필터링된 상품 수:",
            filteredProducts.length,
          );
        }

        console.log("18. 최종 필터링된 상품 목록:", filteredProducts);
        console.log("=== 디버깅 끝 ===");

        return filteredProducts;
      } catch (error) {
        console.error("상품 로드 오류:", error);
        return [];
      }
    },
    enabled: !!user?.uid && activeTab === "shop",
  });

  // 케어매니저의 주문 목록 가져오기
  const { data: sellerOrders = [], isLoading: isOrdersLoading } = useQuery({
    queryKey: ["care-manager-orders", user?.uid],
    queryFn: async () => {
      try {
        const sellerId = user?.uid || (user as any)?.id || user?.email;
        const response = await fetch(`/api/orders/seller/${sellerId}`);

        if (!response.ok) {
          // API가 아직 구현되지 않았거나 오류가 발생한 경우 더미 데이터 반환
          console.warn(
            "주문 API가 아직 구현되지 않았거나 오류가 발생했습니다. 더미 데이터를 사용합니다.",
          );
          return [
            {
              id: "ORD-001",
              createdAt: new Date().toISOString(),
              customer_name: "김영희",
              customer_phone: "010-1234-5678",
              orderItems: [
                {
                  product: { title: "신선한 사과" },
                  quantity: 2,
                  price: 15000,
                },
              ],
              total_amount: 30000,
              payment_method: "카드결제",
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
              createdAt: new Date(Date.now() - 86400000).toISOString(),
              customer_name: "박철수",
              customer_phone: "010-9876-5432",
              orderItems: [
                { product: { title: "유기농 배" }, quantity: 1, price: 25000 },
              ],
              total_amount: 25000,
              payment_method: "무통장입금",
              order_status: "shipped",
              shipping_address: {
                name: "박철수",
                phone: "010-9876-5432",
                address: "부산시 해운대구 센텀중앙로 456",
              },
              tracking_number: "123456789",
              shipping_company: "CJ대한통운",
            },
          ];
        }

        return await response.json();
      } catch (error) {
        console.error("주문 로드 오류:", error);
        // 오류 발생 시 더미 데이터 반환
        return [
          {
            id: "ORD-001",
            createdAt: new Date().toISOString(),
            customer_name: "김영희",
            customer_phone: "010-1234-5678",
            orderItems: [
              { product: { title: "신선한 사과" }, quantity: 2, price: 15000 },
            ],
            total_amount: 30000,
            payment_method: "카드결제",
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
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            customer_name: "박철수",
            customer_phone: "010-9876-5432",
            orderItems: [
              { product: { title: "유기농 배" }, quantity: 1, price: 25000 },
            ],
            total_amount: 25000,
            payment_method: "무통장입금",
            order_status: "shipped",
            shipping_address: {
              name: "박철수",
              phone: "010-9876-5432",
              address: "부산시 해운대구 센텀중앙로 456",
            },
            tracking_number: "123456789",
            shipping_company: "CJ대한통운",
          },
        ];
      }
    },
    enabled: !!user?.uid && activeTab === "shop",
  });

  // 케어매니저의 알림 목록 가져오기
  const { data: sellerNotifications = [] } = useQuery({
    queryKey: ["care-manager-notifications", user?.uid],
    queryFn: async () => {
      try {
        const sellerId = user?.uid || (user as any)?.id || user?.email;
        const response = await fetch(`/api/notifications/seller/${sellerId}`);

        if (!response.ok) {
          // API가 아직 구현되지 않았거나 오류가 발생한 경우 더미 데이터 반환
          return [
            {
              id: "NOTIF-001",
              type: "order",
              message: "새로운 주문이 접수되었습니다: ORD-001",
              order_id: "ORD-001",
              is_read: false,
              createdAt: new Date().toISOString(),
            },
            {
              id: "NOTIF-002",
              type: "shipping",
              message:
                "주문 #ORD-002의 배송이 시작되었습니다. 택배사: CJ대한통운, 운송장번호: 123456789",
              order_id: "ORD-002",
              is_read: true,
              createdAt: new Date(Date.now() - 86400000).toISOString(),
            },
            {
              id: "NOTIF-003",
              type: "stock",
              message: "유기농 사과 상품의 재고가 10개 미만으로 떨어졌습니다.",
              product_id: "1",
              is_read: true,
              createdAt: new Date(Date.now() - 172800000).toISOString(),
            },
          ];
        }

        return await response.json();
      } catch (error) {
        console.error("알림 로드 오류:", error);
        // 오류 발생 시 더미 데이터 반환
        return [
          {
            id: "NOTIF-001",
            type: "order",
            message: "새로운 주문이 접수되었습니다: ORD-001",
            order_id: "ORD-001",
            is_read: false,
            createdAt: new Date().toISOString(),
          },
          {
            id: "NOTIF-002",
            type: "shipping",
            message:
              "주문 #ORD-002의 배송이 시작되었습니다. 택배사: CJ대한통운, 운송장번호: 123456789",
            order_id: "ORD-002",
            is_read: true,
            createdAt: new Date(Date.now() - 86400000).toISOString(),
          },
          {
            id: "NOTIF-003",
            type: "stock",
            message: "유기농 사과 상품의 재고가 10개 미만으로 떨어졌습니다.",
            product_id: "1",
            is_read: true,
            createdAt: new Date(Date.now() - 172800000).toISOString(),
          },
        ];
      }
    },
    enabled: !!user?.uid && activeTab === "shop",
  });

  // 카테고리 목록 가져오기
  const { data: categoriesData } = useQuery({
    queryKey: ["product-categories"],
    queryFn: async () => {
      try {
        const response = await productAPI.getCategories();
        if (
          response &&
          response.categories &&
          Array.isArray(response.categories)
        ) {
          return [
            "전체",
            ...response.categories.map((cat: any) => cat.name || cat),
          ];
        }
        return [
          "전체",
          "가공식품",
          "건강식품",
          "기타",
          "농산물",
          "디지털상품",
          "생활용품",
          "수산물",
          "전자제품",
          "주류",
          "축산물",
          "취미/게임",
          "카페/베이커리",
          "패션",
          "하드웨어",
        ];
      } catch (error) {
        console.error("카테고리 로드 오류:", error);
        return [
          "전체",
          "가공식품",
          "건강식품",
          "기타",
          "농산물",
          "디지털상품",
          "생활용품",
          "수산물",
          "전자제품",
          "주류",
          "축산물",
          "취미/게임",
          "카페/베이커리",
          "패션",
          "하드웨어",
        ];
      }
    },
  });

  // 예약 상태 변경 뮤테이션
  const updateBookingStatus = useMutation({
    mutationFn: async ({
      bookingId,
      status,
    }: {
      bookingId: number;
      status: string;
    }) => {
      const response = await apiRequest(
        "PUT",
        `/api/bookings/${bookingId}/status`,
        { status },
      );
      if (!response.ok) throw new Error("예약 상태 변경에 실패했습니다");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/bookings/care-manager"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/bookings/care-manager-date"],
      });
      toast({
        title: "예약 상태가 변경되었습니다",
        description: "예약 상태가 성공적으로 변경되었습니다.",
      });
    },
    onError: (error) => {
      toast({
        title: "예약 상태 변경 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  /**
   * 케어매니저 서비스 목록(일거리) 업데이트 뮤테이션
   */
  const updateProfileMutation = useMutation({
    mutationFn: async (payload: Partial<CareManager>) => {
      const response = await apiRequest(
        "PUT",
        `/api/care-managers/${careManagerId}`,
        payload,
      );
      if (!response.ok) throw new Error("프로필 업데이트에 실패했습니다");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/care-managers", careManagerId],
      });
      toast({
        title: "프로필이 업데이트되었습니다",
        description: "변경사항이 성공적으로 저장되었습니다.",
      });
    },
    onError: (error) => {
      toast({
        title: "프로필 업데이트 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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
      queryClient.invalidateQueries({
        queryKey: ["care-manager-products", user?.uid],
      });
      setProductTab("list");
      setEditingProduct(null);
      setProductForm({
        title: "",
        price: "",
        discount_price: "",
        description: "",
        stock: "",
        category_id: "",
        status: "active",
        images: [],
      });
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
      queryClient.invalidateQueries({
        queryKey: ["care-manager-products", user?.uid],
      });
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
      images: [],
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
      category_id:
        product.categoryId?.toString() || product.category_id?.toString() || "",
      status: product.status || "active",
      images: product.images || [],
    });
    setProductTab("edit");
  };

  // 상품 저장
  const handleSaveProduct = () => {
    if (!productForm.title || !productForm.price) {
      toast({
        title: "필수 정보 누락",
        description: "상품명과 가격은 필수입니다.",
        variant: "destructive",
      });
      return;
    }

    // 숫자 필드 정리
    const cleanForm = {
      ...productForm,
      id: editingProduct?.id, // id 속성을 추가 (없을 경우 undefined)
      price: productForm.price ? parseFloat(productForm.price) : 0,
      discount_price: productForm.discount_price
        ? parseFloat(productForm.discount_price)
        : undefined,
      stock: productForm.stock ? parseInt(productForm.stock) : 0,
      options: productOptions.map((opt) => ({
        ...opt,
        values: opt.values.map((val) => ({
          ...val,
          price_adjust: val.price_adjust,
        })),
      })),
      seller_id: parseInt(user.uid), // 현재 사용자 ID 저장
      userId: parseInt(user.uid), // 다양한 형태로 저장하여 호환성 확보
      user_id: parseInt(user.uid),
    };

    if (editingProduct) {
      cleanForm.id = editingProduct.id;
    }

    console.log("4. 전송할 상품 데이터:", cleanForm);
    console.log(
      "5. seller_id 값:",
      cleanForm.seller_id,
      "타입:",
      typeof cleanForm.seller_id,
    );
    console.log("=== 저장 디버깅 끝 ===");

    saveProductMutation.mutate(cleanForm);
  };

  // 상품 삭제
  const handleDeleteProduct = (productId: string, productTitle: string) => {
    if (confirm(`'${productTitle}' 상품을 삭제하시겠습니까?`)) {
      deleteProductMutation.mutate(productId);
    }
  };

  // 이미지 업로드 처리
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "파일 크기 초과",
        description: "이미지 크기는 5MB 이하여야 합니다.",
        variant: "destructive",
      });
      return;
    }

    try {
      // 파일 읽기
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setImageBase64(base64);

      // 이미지 업로드 API 호출 (실제 서버에 저장)
      const formData = new FormData();
      formData.append("image", file);
      formData.append("userId", user?.uid || ""); // 사용자 ID 추가

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("서버 오류 응답:", errorText);
        throw new Error(`이미지 업로드에 실패했습니다. (${response.status})`);
      }

      // 성공 메시지
      toast({
        title: "이미지 업로드 성공",
        description: "프로필 이미지가 업로드되었습니다.",
      });
    } catch (error) {
      console.error("이미지 업로드 오류:", error);
      toast({
        title: "이미지 업로드 실패",
        description:
          error instanceof Error
            ? error.message
            : "알 수 없는 오류가 발생했습니다.",
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

  // careManager 데이터 로드 후 서비스 리스트 동기화
  useEffect(() => {
    if (careManager?.services) {
      // services 필드가 문자열 배열 또는 객체 배열일 수 있음
      const svc = careManager.services as any[];
      setServicesList(svc.map((s) => (typeof s === "string" ? s : s.name)));
      setServicePrices(
        svc.map((s) => (typeof s === "string" ? 0 : (s.price ?? 0))),
      );
    }
    if (careManager) {
      setHourlyRate(careManager.hourlyRate || 0);
      setLocationInput(careManager.location || "");
      setExperience(careManager.experience || "");
      setNameInput(careManager.name || "");
      setAgeInput(careManager.age || 0);
      setDescriptionInput(careManager.description || "");
      setCertifiedInput(careManager.certified || false);
      setCertifications((careManager as any).certifications || ""); // 타입 단언 사용

      // 서비스 목록 설정
      if (careManager.services && Array.isArray(careManager.services)) {
        const serviceNames = careManager.services.map((service) =>
          typeof service === "string" ? service : service.name,
        );
        setServicesList(serviceNames);

        // 서비스 가격 설정 (있는 경우)
        const prices = careManager.services.map((service) =>
          typeof service === "string" ? 0 : service.price || 0,
        );
        setServicePrices(prices);
      }

      // 소개글 콘텐츠 로드
      loadIntroContents();
    }
  }, [careManager]);

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

  // 서비스 추가 핸들러
  const handleAddService = () => {
    if (!newService.trim()) return;
    if (servicesList.length >= 4) {
      toast({
        title: "최대 4개까지 등록 가능합니다",
        variant: "destructive",
      });
      return;
    }
    const updatedNames = [...servicesList, newService.trim()];
    const updatedPrices = [...servicePrices, 0];
    setServicesList(updatedNames);
    setServicePrices(updatedPrices);
    setNewService("");
    updateProfileMutation.mutate({
      services: updatedNames.map((n, idx) => ({
        name: n,
        price: updatedPrices[idx],
      })),
    });
  };

  // 서비스 편집 시작
  const startEditService = (index: number) => {
    setEditingIndex(index);
    setEditingServiceName(servicesList[index]);
    // 가격 입력 기능 제거
  };

  // 서비스 편집 저장
  const saveEditService = (index: number) => {
    if (!editingServiceName.trim()) return;
    const updatedNames = servicesList.map((s, i) =>
      i === index ? editingServiceName.trim() : s,
    );
    const updatedPrices = servicePrices.map((p, i) =>
      i === index ? editingServicePrice : p,
    );
    setServicesList(updatedNames);
    setServicePrices(updatedPrices);
    setEditingIndex(null);
    setEditingServiceName("");
    // 가격 입력 기능 제거
    updateProfileMutation.mutate({
      services: updatedNames.map((n, idx) => ({
        name: n,
        price: updatedPrices[idx],
      })),
    });
  };

  // 서비스 편집 취소
  const cancelEditService = () => {
    setEditingIndex(null);
    setEditingServiceName("");
    // 가격 입력 기능 제거
  };

  // 예약 승인 처리
  const handleApproveBooking = (bookingId: number) => {
    updateBookingStatus.mutate({ bookingId, status: "confirmed" });
  };

  // 예약 거절 처리
  const handleRejectBooking = (bookingId: number) => {
    updateBookingStatus.mutate({ bookingId, status: "canceled" });
  };

  // 통계 데이터 계산
  const pendingBookings = bookings.filter((b) => b.status === "pending").length;
  const confirmedBookings = bookings.filter(
    (b) => b.status === "confirmed",
  ).length;
  const completedBookings = bookings.filter(
    (b) => b.status === "completed",
  ).length;
  const canceledBookings = bookings.filter(
    (b) => b.status === "canceled",
  ).length;

  const totalEarnings = bookings
    .filter((b) => b.status === "completed")
    .reduce((sum, booking) => sum + booking.totalAmount, 0);

  const todayBookings = dateBookings.length;

  // 날짜에 예약이 있는지 확인하는 함수
  const hasBookingOnDate = (date: Date) => {
    const formattedDate = format(date, "yyyy-MM-dd");
    return bookings.some((booking) => {
      const bookingDate = new Date(booking.date);
      return format(bookingDate, "yyyy-MM-dd") === formattedDate;
    });
  };

  // 메뉴 클릭 핸들러
  const handleMenuClick = (action: string) => {
    switch (action) {
      case "bookings":
      case "schedule":
      case "notifications":
      case "services":
      case "reviews":
      case "earnings":
      case "settings":
      case "shop": // 쇼핑몰 관리 탭 추가
        setActiveTab(action);
        break;
      case "logout":
        logout();
        toast({
          title: "로그아웃",
          description: "성공적으로 로그아웃되었습니다.",
        });
        setLocation("/");
        break;
      default:
        break;
    }
  };

  // 프로필 저장 핸들러
  const handleSaveProfile = async () => {
    if (servicesList.length === 0) {
      toast({
        title: "서비스를 하나 이상 등록하세요",
        variant: "destructive",
      });
      return;
    }

    // hourly_rate가 null이 되지 않도록 검증
    const hourlyRateValue = hourlyRate || 0;

    // 프로필 정보 업데이트
    updateProfileMutation.mutate({
      name: nameInput,
      age: ageInput,
      hourlyRate: hourlyRateValue, // null 방지
      location: locationInput,
      experience,
      description: descriptionInput,
      certified: certifiedInput,
      imageUrl: imageBase64,
      services: servicesList.map((name, idx) => ({
        name,
        price: servicePrices[idx] || 0,
      })), // price null 방지
    } as any);

    // 소개글 콘텐츠 저장
    await saveIntroContents();
  };

  // 프로필 아바타 변경 핸들러
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "파일 크기 초과",
        description: "이미지 크기는 5MB 이하여야 합니다.",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "프로필 이미지 업로드 중",
        description: "잠시만 기다려주세요...",
      });

      // 이미지 업로드 API 호출 (실제 서버에 저장)
      const formData = new FormData();
      formData.append("image", file);

      // 사용자 ID를 숫자로 변환하여 전달
      const userId = parseInt(user?.uid || "0");
      formData.append("userId", userId.toString());

      console.log("프로필 이미지 업로드 - 사용자 ID:", userId);

      // 서버 기본 URL 설정
      const serverBaseUrl = ""; // 프로덕션에서는 환경변수 사용 권장

      // API 경로 수정: 서버에서 지원하는 엔드포인트로 변경
      const response = await fetch(`${serverBaseUrl}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("서버 오류 응답:", errorText);
        throw new Error(`이미지 업로드에 실패했습니다. (${response.status})`);
      }

      const result = await response.json();

      if (result.success && result.imageUrl) {
        // 서버에서 반환된 이미지 URL을 사용
        const fullImageUrl = `${serverBaseUrl}${result.imageUrl}`;
        console.log("프로필 이미지 업로드 성공:", fullImageUrl);

        // 로컬 상태 업데이트
        setImageBase64(fullImageUrl);

        // 케어 매니저 프로필 이미지 업데이트 (URL 저장)
        updateProfileMutation.mutate({ imageUrl: fullImageUrl });

        // Firebase 사용자 프로필 이미지도 함께 업데이트
        try {
          await updateUserPhoto(fullImageUrl);
        } catch (photoError) {
          console.error("Firebase 프로필 사진 업데이트 오류:", photoError);
        }
      } else {
        throw new Error("서버에서 이미지 URL을 반환하지 않았습니다.");
      }

      // 성공 메시지
      toast({
        title: "프로필 이미지 업로드 성공",
        description: "프로필 이미지가 업로드되었습니다.",
      });
    } catch (error) {
      console.error("이미지 업로드 오류:", error);
      toast({
        title: "이미지 업로드 실패",
        description:
          error instanceof Error
            ? error.message
            : "알 수 없는 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // 상품 설명용 이미지 업로드 처리
  const handleDescriptionImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
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
      formData.append("image", file);

      console.log("🖼️ 이미지 업로드 시작:", {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      });

      // 서버로 이미지 업로드 (상품 이미지 전용 API 사용)
      const response = await fetch("/api/upload/product-image", {
        method: "POST",
        body: formData,
      });

      console.log("🖼️ 서버 응답 상태:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("️ 서버 오류 응답:", errorText);
        throw new Error(`이미지 업로드에 실패했습니다. (${response.status})`);
      }

      const result = await response.json();
      console.log("🖼️ 서버 응답 데이터:", result);

      if (result.success && result.imageUrl) {
        // 현재 설명 내용 확인
        const currentDescription = productForm.description;
        console.log("🖼️ 현재 설명 길이:", currentDescription.length);

        // HTML 코드에 이미지 태그 삽입 (서버 URL 사용)
        const imageUrl = `${result.imageUrl}`;
        const imageHtml = `\n<img src="${imageUrl}" alt="상품설명이미지" style="max-width: 100%; height: auto; margin: 10px 0; border-radius: 8px;" />\n`;
        const newDescription = currentDescription + imageHtml;

        console.log("🖼️ 새로운 설명 길이:", newDescription.length);
        console.log("🖼️ 추가된 HTML:", imageHtml);

        setProductForm({ ...productForm, description: newDescription });

        // 파일 입력 필드 초기화
        if (descriptionImageInputRef.current) {
          descriptionImageInputRef.current.value = "";
        }

        toast({
          title: "✅ 이미지 업로드 성공!",
          description: `${file.name}이 상품 설명에 추가되었습니다. 미리보기 탭에서 확인해보세요.`,
          variant: "default",
        });

        // 미리보기 모드로 자동 전환
        setTimeout(() => {
          setDescriptionMode("preview");
        }, 1000);
      } else {
        console.error("🖼️ 예상치 못한 응답 형식:", result);
        throw new Error("서버 응답이 올바르지 않습니다.");
      }
    } catch (error) {
      console.error("이미지 업로드 오류:", error);
      toast({
        title: "이미지 업로드 실패",
        description:
          error instanceof Error
            ? error.message
            : "이미지 업로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // 주문 상태 변경 뮤테이션
  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({
      orderId,
      status,
    }: {
      orderId: string;
      status: string;
    }) => {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error("주문 상태 변경에 실패했습니다");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["care-manager-orders"] });
      toast({
        title: "주문 상태 변경 완료",
        description: "주문 상태가 성공적으로 변경되었습니다.",
      });
    },
    onError: (error) => {
      toast({
        title: "주문 상태 변경 실패",
        description:
          error instanceof Error
            ? error.message
            : "알 수 없는 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // 배송 정보 업데이트 뮤테이션
  const updateShippingMutation = useMutation({
    mutationFn: async ({
      orderId,
      trackingNumber,
      shippingCompany,
    }: {
      orderId: string;
      trackingNumber: string;
      shippingCompany: string;
    }) => {
      const response = await fetch(`/api/orders/${orderId}/shipping`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tracking_number: trackingNumber,
          shipping_company:
            shippingCompany === "custom"
              ? customCarrier
              : KOREAN_CARRIERS.find((c) => c.value === shippingCompany)
                  ?.label || shippingCompany,
        }),
      });

      if (!response.ok) {
        throw new Error("배송 정보 업데이트에 실패했습니다");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["care-manager-orders"] });
      setTrackingDialog(false);
      setTrackingNumber("");
      setShippingCompany("cj");
      setCustomCarrier("");
      setSelectedOrderId("");
      toast({
        title: "배송 정보 업데이트 완료",
        description: "운송장 정보가 성공적으로 등록되었습니다.",
      });
    },
    onError: (error) => {
      toast({
        title: "배송 정보 업데이트 실패",
        description:
          error instanceof Error
            ? error.message
            : "알 수 없는 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // 알림 읽음 표시 뮤테이션
  const markNotificationAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(
        `/api/notifications/${notificationId}/read`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error("알림 읽음 표시에 실패했습니다");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["care-manager-notifications"],
      });
    },
    onError: (error) => {
      toast({
        title: "알림 읽음 표시 실패",
        description:
          error instanceof Error
            ? error.message
            : "알 수 없는 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // 이미지 URL을 올바르게 처리하는 함수
  const getImageUrl = (image: string | undefined): string => {
    if (!image) return "";
    if (image.startsWith("data:")) return image;
    const normalized = normalizeImageUrl(image);
    if (!normalized) return "";
    if (
      normalized.startsWith("/images/") ||
      normalized.startsWith("/uploads/") ||
      normalized.startsWith("/public/")
    ) {
      return `${normalized}${normalized.includes("?") ? "&" : "?"}t=${Date.now()}`;
    }
    return normalized;
  };

  // careManager 데이터가 로드되면 폼 필드 초기화
  useEffect(() => {
    if (careManager) {
      setNameInput(careManager.name || "");
      setAgeInput(careManager.age || 0);
      setHourlyRate(careManager.hourlyRate || 0);
      setLocationInput(careManager.location || "");
      setExperience(careManager.experience || "");
      setDescriptionInput(careManager.description || "");
      setCertifiedInput(careManager.certified || false);
      setImageBase64(careManager.imageUrl || null);
    }
  }, [careManager]);

  // 소개글 콘텐츠 관련 함수들
  const generateId = () => {
    return Math.random().toString(36).substr(2, 9);
  };

  // 소개글 콘텐츠 추가
  const addIntroContent = (type: "text" | "image" | "link" | "youtube") => {
    const newContent: IntroContent = {
      id: generateId(),
      type,
      content: "",
    };
    setIntroContents([...introContents, newContent]);
  };

  // 소개글 콘텐츠 수정
  const updateIntroContent = (id: string, data: Partial<IntroContent>) => {
    setIntroContents(
      introContents.map((item) =>
        item.id === id ? { ...item, ...data } : item,
      ),
    );
  };

  // 소개글 콘텐츠 삭제
  const removeIntroContent = (id: string) => {
    setIntroContents(introContents.filter((item) => item.id !== id));
  };

  // 소개글 이미지 업로드 처리
  const handleIntroImageUpload = async (id: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "파일 크기 초과",
        description: "이미지 크기는 5MB 이하여야 합니다.",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "이미지 업로드 중",
        description: "잠시만 기다려주세요...",
      });

      // 이미지 업로드 API 호출
      const formData = new FormData();
      formData.append("image", file);
      formData.append("userId", user?.uid || "");

      // 서버 기본 URL 설정
      const serverBaseUrl = ""; // 프로덕션에서는 환경변수 사용 권장

      const response = await fetch(`${serverBaseUrl}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("서버 오류 응답:", errorText);
        throw new Error(`이미지 업로드에 실패했습니다. (${response.status})`);
      }

      const result = await response.json();

      // 이미지 URL을 콘텐츠에 업데이트
      if (result.success && result.imageUrl) {
        // 서버 URL과 이미지 경로 조합
        const imageUrl = normalizeImageUrl(
          `${serverBaseUrl}${result.imageUrl}`,
        );

        console.log("이미지 업로드 성공:", imageUrl);
        updateIntroContent(id, { content: imageUrl });

        toast({
          title: "이미지 업로드 성공",
          description: "이미지가 성공적으로 업로드되었습니다.",
        });
      } else {
        throw new Error("서버에서 이미지 URL을 반환하지 않았습니다.");
      }
    } catch (error) {
      console.error("이미지 업로드 오류:", error);
      toast({
        title: "이미지 업로드 실패",
        description:
          error instanceof Error
            ? error.message
            : "알 수 없는 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // 프로필 저장 시 소개글 콘텐츠도 함께 저장
  const saveIntroContents = async () => {
    try {
      const response = await fetch(
        `/api/caremanager/${user?.uid}/intro-contents`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ introContents }),
        },
      );

      if (!response.ok) {
        throw new Error("소개글 콘텐츠 저장에 실패했습니다.");
      }

      return true;
    } catch (error) {
      console.error("소개글 콘텐츠 저장 오류:", error);
      toast({
        title: "소개글 콘텐츠 저장 실패",
        description:
          error instanceof Error
            ? error.message
            : "알 수 없는 오류가 발생했습니다.",
        variant: "destructive",
      });
      return false;
    }
  };

  // 소개글 콘텐츠 불러오기
  const loadIntroContents = async () => {
    try {
      const response = await fetch(
        `/api/caremanager/${user?.uid}/intro-contents`,
      );

      if (!response.ok) {
        throw new Error("소개글 콘텐츠 로드에 실패했습니다.");
      }

      const data = await response.json();
      if (data.introContents) {
        const normalized = data.introContents.map((item: any) => ({
          ...item,
          content:
            item && item.type === "image"
              ? normalizeImageUrl(item.content)
              : item.content,
        }));
        setIntroContents(normalized);
      }
    } catch (error) {
      console.error("소개글 콘텐츠 로드 오류:", error);
    }
  };

  // 서비스 삭제 함수 추가
  const handleDeleteService = (index: number) => {
    const updatedServices = [...servicesList];
    const updatedPrices = [...servicePrices];

    // 해당 인덱스의 항목 제거
    updatedServices.splice(index, 1);
    updatedPrices.splice(index, 1);

    // 상태 업데이트
    setServicesList(updatedServices);
    setServicePrices(updatedPrices);
  };

  // 인증 결제 처리 함수
  const handleCertificationPayment = async () => {
    try {
      setIsProcessing(true);
      // 포트원 설정
      const PORTONE_CONFIG = {
        storeId: "store-a14a02cb-9976-411b-8b00-2eb029d02411",
        channelKey: "channel-key-689e9418-6654-4e1a-ae05-d035f87260bc",
      };

      // 결제 ID 생성 (랜덤)
      const generatePaymentId = () => {
        return Array.from(crypto.getRandomValues(new Uint32Array(2)))
          .map((word) => word.toString(16).padStart(8, "0"))
          .join("");
      };

      const paymentId = generatePaymentId();

      // 포트원 결제 요청
      const payment = await PortOne.requestPayment({
        storeId: PORTONE_CONFIG.storeId,
        channelKey: PORTONE_CONFIG.channelKey,
        paymentId,
        orderName: "케어링크 인증 서비스 등록",
        totalAmount: 1000000,
        currency: "KRW" as any,
        payMethod: "CARD" as any,
        customData: {
          userId: user?.uid || user?.email,
          certificationType: "care_manager_certification",
        },
        customer: {
          fullName: user?.displayName || "케어매니저",
          email: user?.email || "",
          phoneNumber: "01012345678", // 필수 필드 추가
        },
      });

      // 결제 응답 처리
      if (!payment) {
        throw new Error("결제 응답을 받지 못했습니다.");
      }

      if ("code" in payment && payment.code !== undefined) {
        throw new Error(`결제 실패: ${payment.message}`);
      }

      // 결제 성공
      await activateCertification(paymentId);
      setShowCertificationPayment(false);
      // toast 메시지는 activateCertification 함수 내에서 표시됩니다.
    } catch (error) {
      console.error("결제 오류:", error);
      toast({
        title: "결제 실패",
        description:
          error instanceof Error
            ? error.message
            : "결제 처리 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 인증 활성화
  const activateCertification = async (paymentId?: string) => {
    try {
      setIsProcessing(true);

      // API를 통해 인증 상태 저장
      const response = await api.post(`/api/users/${user.uid}/certification`, {
        paymentId: paymentId || `manual-${Date.now()}`,
      });

      if (response.data.success) {
        // 인증 상태 업데이트
        setIsCertified(true);
        setCertificationOpacity(1);

        // 토스트 메시지
        toast({
          title: "인증 완료",
          description: "성공적으로 인증되었습니다!",
          variant: "default",
        });

        // 캐시 갱신 (다른 컴포넌트에서 참조할 수 있도록)
        if (window.sellerCertificationCache) {
          window.sellerCertificationCache.set(user.uid, true);
        } else {
          window.sellerCertificationCache = new Map();
          window.sellerCertificationCache.set(user.uid, true);
        }
      } else {
        throw new Error("인증 활성화 실패");
      }
    } catch (error) {
      console.error("인증 활성화 오류:", error);
      toast({
        title: "인증 오류",
        description: "인증을 활성화하는 도중 문제가 발생했습니다.",
        variant: "destructive",
      });

      // 로컬 스토리지 폴백은 제거 (API 기반으로 전환)
    } finally {
      setIsProcessing(false);
      setShowCertificationPayment(false);
    }
  };

  // 인증 상태 로드 (useEffect 내)
  useEffect(() => {
    const loadCertificationStatus = async () => {
      try {
        // 서버에서 인증 상태 조회 - API가 아직 구현되지 않아 주석 처리
        // const response = await fetch(`http://localhost:5000/api/users/${user?.uid}/certification-status`);
        // const result = await response.json();

        // if (result.success && result.isCertified) {
        //   setIsCertified(true);
        //   setCertificationOpacity(1);
        // } else {
        // 현재는 API가 구현되지 않았으므로 로컬 스토리지만 확인
        const savedStatus = localStorage.getItem(`certification_${user?.uid}`);
        if (savedStatus === "true") {
          setIsCertified(true);
          setCertificationOpacity(1);
        }

        // 하드코딩된 특정 사용자(decom2@gmail.com, uid: 4)는 자동으로 인증 활성화
        if (user?.email === "decom2@gmail.com" || user?.uid === "4") {
          setIsCertified(true);
          setCertificationOpacity(1);
          localStorage.setItem(`certification_${user?.uid}`, "true");
        }
        // }
      } catch (error) {
        console.error("인증 상태 로드 오류:", error);
        // 오류 발생 시 로컬 스토리지 확인 (fallback)
        const savedStatus = localStorage.getItem(`certification_${user?.uid}`);
        if (savedStatus === "true") {
          setIsCertified(true);
          setCertificationOpacity(1);
        }

        // 하드코딩된 특정 사용자(decom2@gmail.com, uid: 4)는 자동으로 인증 활성화
        if (user?.email === "decom2@gmail.com" || user?.uid === "4") {
          setIsCertified(true);
          setCertificationOpacity(1);
          localStorage.setItem(`certification_${user?.uid}`, "true");
        }
      }
    };

    // URL 파라미터에서 인증 결제 완료 확인
    const checkCertificationPayment = () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("certificationComplete") === "true") {
        activateCertification();
        // 파라미터 제거를 위한 URL 업데이트
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
      }
    };

    if (user?.uid) {
      loadCertificationStatus();
      checkCertificationPayment();
    }
  }, [user?.uid]);

  // 비밀번호 변경 모달 상태
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  return (
    <>
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-sm shadow-sm px-4 py-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            케어 매니저/가맹점 대시보드
          </h1>
          <p className="text-gray-600">예약 관리와 서비스 현황을 확인하세요</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* 좌측 프로필 및 메뉴 섹션 */}
          <div className="lg:w-1/4">
            {/* 프로필 카드 */}
            <Card className="bg-white shadow-md mb-6">
              <CardContent className="p-6">
                {/* 숨겨진 프로필 사진 입력 필드 */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarFileChange}
                  accept="image/*"
                  className="hidden"
                />

                <div className="flex flex-col items-center mb-6">
                  {/* 프로필 사진 업로드 기능 */}
                  <div
                    className="relative cursor-pointer"
                    onClick={handleAvatarClick}
                  >
                    <Avatar className="w-24 h-24 border-4 border-purple-100">
                      <AvatarImage
                        src={
                          imageBase64 ||
                          normalizeImageUrl(
                            careManager?.imageUrl || undefined,
                          ) ||
                          user.photoURL ||
                          ""
                        }
                      />
                      <AvatarFallback className="bg-purple-500 text-white text-xl">
                        {user.displayName?.charAt(0) || user.email?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>

                    {/* 카메라 아이콘 표시 */}
                    <div className="absolute bottom-0 right-0 bg-purple-500 rounded-full p-1 shadow-md text-white">
                      <i className="fas fa-camera text-xs"></i>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <h2 className="text-xl font-bold">
                      {user.displayName || user.email?.split("@")[0]}
                    </h2>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowPasswordDialog(true)}
                    >
                      비번변경
                    </Button>
                  </div>
                  <p className="text-gray-500">{user.email}</p>
                  <Badge className="mt-2 bg-purple-500">케어 매니저</Badge>

                  {/* 인증 마크 섹션 */}
                  <div className="mt-4 flex flex-col items-center">
                    <div className="relative">
                      <img
                        src="/images/certify.png"
                        alt="인증 마크"
                        className="w-36 h-36 mb-2 transition-opacity duration-500"
                        style={{ opacity: certificationOpacity }}
                      />
                      {!isCertified && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs bg-black bg-opacity-60 text-white p-1 rounded">
                            미인증
                          </span>
                        </div>
                      )}
                    </div>

                    {!isCertified && (
                      <Button
                        className="mt-2 bg-gradient-to-r from-blue-600 to-blue-800 text-white hover:from-blue-700 hover:to-blue-900"
                        onClick={() => setShowCertificationPayment(true)}
                        disabled={isProcessing}
                      >
                        <i className="fas fa-check-circle mr-1"></i>
                        {isProcessing ? "처리 중..." : "인증 등록하기"}
                      </Button>
                    )}

                    {isCertified && (
                      <Badge className="mt-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
                        공식 인증 서비스
                      </Badge>
                    )}
                  </div>
                </div>

                {/* 통계 정보 */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-500 text-sm">오늘 예약</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {todayBookings}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-500 text-sm">승인 대기</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {pendingBookings}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-500 text-sm">등록 상품</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {products.length}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-500 text-sm">총 수익</p>
                    <p className="text-2xl font-bold text-green-600">
                      {totalEarnings.toLocaleString()}원
                    </p>
                  </div>
                </div>

                {/* 제공 서비스 섹션 추가 */}
                <div className="mb-6">
                  <h3 className="font-medium text-sm mb-2 text-gray-700">
                    제공 서비스
                  </h3>
                  <div className="space-y-2">
                    {servicesList.length > 0 ? (
                      servicesList.map((service, index) => (
                        <div
                          key={index}
                          className="flex items-center bg-gray-50 p-2 rounded"
                        >
                          <span className="text-sm">{service}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 italic">
                        등록된 서비스가 없습니다.
                      </p>
                    )}
                  </div>
                </div>

                {/* 메뉴 목록 */}
                <nav className="space-y-1">
                  <Button
                    variant={activeTab === "bookings" ? "default" : "ghost"}
                    className="w-full justify-start text-left"
                    onClick={() => handleMenuClick("bookings")}
                  >
                    <i className="fas fa-calendar-check mr-2"></i>
                    예약 관리
                  </Button>
                  <Button
                    variant={activeTab === "schedule" ? "default" : "ghost"}
                    className="w-full justify-start text-left"
                    onClick={() => handleMenuClick("schedule")}
                  >
                    <i className="fas fa-calendar-alt mr-2"></i>
                    스케줄 관리
                  </Button>
                  <Button
                    variant={activeTab === "shop" ? "default" : "ghost"}
                    className="w-full justify-start text-left"
                    onClick={() => handleMenuClick("shop")}
                  >
                    <i className="fas fa-store mr-2"></i>
                    상품 관리
                  </Button>
                  <Button
                    variant={activeTab === "earnings" ? "default" : "ghost"}
                    className="w-full justify-start text-left"
                    onClick={() => handleMenuClick("earnings")}
                  >
                    <i className="fas fa-wallet mr-2"></i>
                    수익 관리
                  </Button>
                  <Button
                    variant={activeTab === "services" ? "default" : "ghost"}
                    className="w-full justify-start text-left"
                    onClick={() => handleMenuClick("services")}
                  >
                    <i className="fas fa-briefcase mr-2"></i>
                    일거리 관리/명함
                  </Button>
                  <Button
                    variant={activeTab === "settings" ? "default" : "ghost"}
                    className="w-full justify-start text-left"
                    onClick={() => handleMenuClick("settings")}
                  >
                    <i className="fas fa-cog mr-2"></i>
                    명함 상세
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-left text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => handleMenuClick("logout")}
                  >
                    <i className="fas fa-sign-out-alt mr-2"></i>
                    로그아웃
                  </Button>
                </nav>
              </CardContent>
            </Card>

            {/* 비밀번호 변경 – 모달로 대체되어 비활성화 */}
            {false && (
              <Card className="bg-white shadow-md mb-6">
                <CardHeader>
                  <CardTitle>비밀번호 변경</CardTitle>
                </CardHeader>
                <CardContent>
                  <PasswordChangeForm userId={user?.uid || user?.id} />
                </CardContent>
              </Card>
            )}
          </div>

          {/* 우측 컨텐츠 섹션 */}
          <div className="lg:w-3/4">
            {/* 예약 관리 탭 */}
            {activeTab === "bookings" && (
              <Card className="bg-white shadow-md">
                <CardHeader className="border-b border-gray-100 bg-gray-50">
                  <h3 className="text-xl font-bold text-gray-800">예약 관리</h3>
                </CardHeader>
                <CardContent className="p-2">
                  <Tabs defaultValue="pending">
                    <TabsList className="mb-4">
                      <TabsTrigger value="pending">
                        승인 대기 ({pendingBookings})
                      </TabsTrigger>
                      <TabsTrigger value="confirmed">
                        승인예약 ({confirmedBookings})
                      </TabsTrigger>
                      <TabsTrigger value="completed">
                        완료예약 ({completedBookings})
                      </TabsTrigger>
                      <TabsTrigger value="canceled">
                        취소예약 ({canceledBookings})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent
                      value="pending"
                      className="space-y-2 sm:space-y-3"
                    >
                      {bookings.filter((b) => b.status === "pending").length ===
                      0 ? (
                        <p className="text-gray-500 text-center py-10">
                          대기 중인 예약이 없습니다.
                        </p>
                      ) : (
                        <div className="space-y-2 sm:space-y-3">
                          {bookings
                            .filter((booking) => booking.status === "pending")
                            .map((booking) => (
                              <div
                                key={booking.id}
                                className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow"
                              >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                  <div>
                                    <h4 className="font-bold text-base sm:text-lg">
                                      고객 {booking.userId}
                                    </h4>
                                    <p className="text-gray-600 text-sm sm:text-base">
                                      <i className="fas fa-calendar mr-1 text-gray-400"></i>{" "}
                                      {format(
                                        new Date(booking.date),
                                        "yyyy.MM.dd HH:mm",
                                        { locale: ko },
                                      )}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5 sm:mt-1">
                                      <Badge className="bg-blue-500">
                                        서비스 {booking.serviceId}
                                      </Badge>
                                      <span className="text-sm text-gray-500">
                                        {booking.totalAmount.toLocaleString()}원
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="border-red-300 text-red-500 hover:bg-red-50"
                                      onClick={() =>
                                        handleRejectBooking(booking.id)
                                      }
                                    >
                                      <i className="fas fa-times mr-1"></i>
                                      거절
                                    </Button>
                                    <Button
                                      variant="default"
                                      size="sm"
                                      onClick={() =>
                                        handleApproveBooking(booking.id)
                                      }
                                    >
                                      <i className="fas fa-check mr-1"></i>
                                      승인
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="confirmed">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>날짜</TableHead>
                            <TableHead>시간</TableHead>
                            <TableHead>고객</TableHead>
                            <TableHead>서비스</TableHead>
                            <TableHead>금액</TableHead>
                            <TableHead>관리</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bookings.filter((b) => b.status === "confirmed")
                            .length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={6}
                                className="text-center py-8 text-gray-500"
                              >
                                승인된 예약이 없습니다
                              </TableCell>
                            </TableRow>
                          ) : (
                            bookings
                              .filter(
                                (booking) => booking.status === "confirmed",
                              )
                              .map((booking) => (
                                <TableRow key={booking.id}>
                                  <TableCell>
                                    {format(
                                      new Date(booking.date),
                                      "yyyy.MM.dd",
                                      { locale: ko },
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {format(new Date(booking.date), "HH:mm", {
                                      locale: ko,
                                    })}
                                  </TableCell>
                                  <TableCell>고객 {booking.userId}</TableCell>
                                  <TableCell>
                                    서비스 {booking.serviceId}
                                  </TableCell>
                                  <TableCell>
                                    {booking.totalAmount.toLocaleString()}원
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 text-xs"
                                      onClick={() =>
                                        updateBookingStatus.mutate({
                                          bookingId: booking.id,
                                          status: "completed",
                                        })
                                      }
                                    >
                                      완료처리
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>

                    <TabsContent value="completed">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>날짜</TableHead>
                            <TableHead>시간</TableHead>
                            <TableHead>고객</TableHead>
                            <TableHead>서비스</TableHead>
                            <TableHead>금액</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bookings.filter((b) => b.status === "completed")
                            .length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                className="text-center py-8 text-gray-500"
                              >
                                완료된 예약이 없습니다
                              </TableCell>
                            </TableRow>
                          ) : (
                            bookings
                              .filter(
                                (booking) => booking.status === "completed",
                              )
                              .map((booking) => (
                                <TableRow key={booking.id}>
                                  <TableCell>
                                    {format(
                                      new Date(booking.date),
                                      "yyyy.MM.dd",
                                      { locale: ko },
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {format(new Date(booking.date), "HH:mm", {
                                      locale: ko,
                                    })}
                                  </TableCell>
                                  <TableCell>고객 {booking.userId}</TableCell>
                                  <TableCell>
                                    서비스 {booking.serviceId}
                                  </TableCell>
                                  <TableCell>
                                    {booking.totalAmount.toLocaleString()}원
                                  </TableCell>
                                </TableRow>
                              ))
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>

                    <TabsContent value="canceled">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>날짜</TableHead>
                            <TableHead>시간</TableHead>
                            <TableHead>고객</TableHead>
                            <TableHead>서비스</TableHead>
                            <TableHead>금액</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bookings.filter((b) => b.status === "canceled")
                            .length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                className="text-center py-8 text-gray-500"
                              >
                                취소된 예약이 없습니다
                              </TableCell>
                            </TableRow>
                          ) : (
                            bookings
                              .filter(
                                (booking) => booking.status === "canceled",
                              )
                              .map((booking) => (
                                <TableRow key={booking.id}>
                                  <TableCell>
                                    {format(
                                      new Date(booking.date),
                                      "yyyy.MM.dd",
                                      { locale: ko },
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {format(new Date(booking.date), "HH:mm", {
                                      locale: ko,
                                    })}
                                  </TableCell>
                                  <TableCell>고객 {booking.userId}</TableCell>
                                  <TableCell>
                                    서비스 {booking.serviceId}
                                  </TableCell>
                                  <TableCell>
                                    {booking.totalAmount.toLocaleString()}원
                                  </TableCell>
                                </TableRow>
                              ))
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}

            {/* 스케줄 관리 탭 */}
            {activeTab === "schedule" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="col-span-1 md:col-span-2 lg:col-span-1">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-medium mb-4">일정 캘린더</h3>
                    <div className="flex justify-center">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setSelectedDate(date)}
                        className="rounded-md border w-full overflow-visible min-w-[260px]"
                        modifiers={{
                          hasBooking: (date) => hasBookingOnDate(date),
                        }}
                        modifiersStyles={{
                          hasBooking: {
                            backgroundColor: "#ebf4ff",
                            fontWeight: "bold",
                            color: "#3182ce",
                          },
                        }}
                        fromDate={new Date()}
                        styles={{
                          month: { width: "100%" },
                          caption: { padding: "8px" },
                          caption_label: {
                            fontSize: "1rem",
                            fontWeight: "600",
                          },
                          nav_button: { padding: "6px" },
                        }}
                      />
                    </div>
                    <div className="mt-4">
                      <p className="text-sm text-gray-500">
                        선택한 날짜:{" "}
                        {format(selectedDate, "yyyy년 MM월 dd일", {
                          locale: ko,
                        })}
                      </p>
                      <p className="text-sm font-medium mt-2">
                        예약: {todayBookings}건
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="col-span-2">
                  <CardContent className="pt-6">
                    <h3 className="text-lg font-medium mb-4">
                      {format(selectedDate, "yyyy년 MM월 dd일", { locale: ko })}{" "}
                      예약
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>시간</TableHead>
                          <TableHead>고객</TableHead>
                          <TableHead>서비스</TableHead>
                          <TableHead>상태</TableHead>
                          <TableHead>관리</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dateBookings.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="text-center py-8 text-gray-500"
                            >
                              선택한 날짜에 예약이 없습니다
                            </TableCell>
                          </TableRow>
                        ) : (
                          dateBookings.map((booking) => (
                            <TableRow key={booking.id}>
                              <TableCell>
                                {format(new Date(booking.date), "HH:mm", {
                                  locale: ko,
                                })}
                              </TableCell>
                              <TableCell>고객 {booking.userId}</TableCell>
                              <TableCell>서비스 {booking.serviceId}</TableCell>
                              <TableCell>
                                <Badge
                                  className={
                                    booking.status === "pending"
                                      ? "bg-yellow-500"
                                      : booking.status === "confirmed"
                                        ? "bg-blue-500"
                                        : booking.status === "completed"
                                          ? "bg-green-500"
                                          : "bg-red-500"
                                  }
                                >
                                  {booking.status === "pending"
                                    ? "대기중"
                                    : booking.status === "confirmed"
                                      ? "확정"
                                      : booking.status === "completed"
                                        ? "완료"
                                        : "취소"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center space-x-2">
                                  {booking.status === "pending" && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 text-xs"
                                        onClick={() =>
                                          updateBookingStatus.mutate({
                                            bookingId: booking.id,
                                            status: "confirmed",
                                          })
                                        }
                                      >
                                        승인
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 text-xs border-red-500 text-red-500 hover:bg-red-50"
                                        onClick={() =>
                                          updateBookingStatus.mutate({
                                            bookingId: booking.id,
                                            status: "canceled",
                                          })
                                        }
                                      >
                                        거절
                                      </Button>
                                    </>
                                  )}
                                  {booking.status === "confirmed" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 text-xs"
                                      onClick={() =>
                                        updateBookingStatus.mutate({
                                          bookingId: booking.id,
                                          status: "completed",
                                        })
                                      }
                                    >
                                      완료처리
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 상품 관리 탭 */}
            {activeTab === "shop" && (
              <Card className="bg-white shadow-md">
                <CardHeader className="border-b border-gray-100 bg-gray-50">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-gray-800">
                      상품 관리
                    </h3>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <Tabs defaultValue="products">
                    <TabsList className="mb-4">
                      <TabsTrigger value="products">상품 관리</TabsTrigger>
                      <TabsTrigger value="orders">주문/배송 관리</TabsTrigger>
                      <TabsTrigger value="notifications">알림 관리</TabsTrigger>
                    </TabsList>

                    {/* 상품 관리 탭 */}
                    <TabsContent value="products" className="pt-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                        <h3 className="font-medium mb-2 sm:mb-0">상품 관리</h3>
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                          <Button
                            variant={
                              productTab === "list" ? "default" : "outline"
                            }
                            onClick={() => setProductTab("list")}
                            className="flex-grow-0 px-2 sm:px-4 py-1 h-8 sm:h-10 text-sm"
                          >
                            목록
                          </Button>
                          <Button
                            variant={
                              productTab === "register" ? "default" : "outline"
                            }
                            onClick={handleCreateProduct}
                            className="flex-grow-0 px-2 sm:px-4 py-1 h-8 sm:h-10 text-sm"
                          >
                            <Plus className="h-3 w-3 mr-1 sm:h-4 sm:w-4" />
                            <span className="hidden sm:inline">상품 등록</span>
                            <span className="inline sm:hidden">상품 등록</span>
                          </Button>
                          {editingProduct && (
                            <Button
                              variant={
                                productTab === "edit" ? "default" : "outline"
                              }
                              onClick={() => setProductTab("edit")}
                              className="flex-grow-0 px-2 sm:px-4 py-1 h-8 sm:h-10 text-sm"
                            >
                              <Edit className="h-3 w-3 mr-1 sm:h-4 sm:w-4" />
                              <span className="hidden sm:inline">
                                상품 수정
                              </span>
                              <span className="inline sm:hidden">수정</span>
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* 상품 목록 */}
                      {productTab === "list" && (
                        <div>
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
                                      product.title
                                        ?.toLowerCase()
                                        .includes(searchTerm.toLowerCase()),
                                    )
                                    .map((product: any) => (
                                      <tr
                                        key={product.id}
                                        className="border-b hover:bg-gray-50"
                                      >
                                        <td className="py-3 px-4">
                                          <div className="font-medium">
                                            {product.title}
                                          </div>
                                          <div className="text-sm text-gray-500">
                                            ID: {product.id}
                                          </div>
                                        </td>
                                        <td className="py-3 px-4">
                                          {Math.floor(
                                            product.price,
                                          ).toLocaleString()}
                                          원
                                        </td>
                                        <td className="py-3 px-4">
                                          <span
                                            className={
                                              product.stock < 10
                                                ? "text-red-600 font-medium"
                                                : ""
                                            }
                                          >
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
                                              onClick={() =>
                                                handleEditProduct(product)
                                              }
                                              title="상품 수정"
                                            >
                                              <Edit className="h-3 w-3" />
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="destructive"
                                              onClick={() =>
                                                handleDeleteProduct(
                                                  product.id,
                                                  product.title,
                                                )
                                              }
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
                              <Store className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                              <p>등록된 상품이 없습니다.</p>
                              <Button
                                className="mt-4"
                                onClick={handleCreateProduct}
                              >
                                첫 상품 등록하기
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 상품 등록/수정 폼 */}
                      {(productTab === "register" || productTab === "edit") && (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">
                              {productTab === "register"
                                ? "새 상품 등록"
                                : "상품 수정"}
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
                                <label className="block text-sm font-medium mb-1">
                                  상품명
                                </label>
                                <Input
                                  value={productForm.title}
                                  onChange={(e) =>
                                    setProductForm({
                                      ...productForm,
                                      title: e.target.value,
                                    })
                                  }
                                  placeholder="상품명을 입력하세요"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium mb-1">
                                  가격
                                </label>
                                <Input
                                  type="number"
                                  value={productForm.price}
                                  onChange={(e) =>
                                    setProductForm({
                                      ...productForm,
                                      price: e.target.value,
                                    })
                                  }
                                  placeholder="가격을 입력하세요"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium mb-1">
                                  할인 가격
                                </label>
                                <Input
                                  type="number"
                                  value={productForm.discount_price}
                                  onChange={(e) =>
                                    setProductForm({
                                      ...productForm,
                                      discount_price: e.target.value,
                                    })
                                  }
                                  placeholder="할인 가격을 입력하세요"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium mb-1">
                                  재고 수량
                                </label>
                                <Input
                                  type="number"
                                  value={productForm.stock}
                                  onChange={(e) =>
                                    setProductForm({
                                      ...productForm,
                                      stock: e.target.value,
                                    })
                                  }
                                  placeholder="재고 수량을 입력하세요"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium mb-1">
                                  카테고리
                                </label>
                                <select
                                  className="w-full border rounded-md p-2"
                                  value={productForm.category_id}
                                  onChange={(e) =>
                                    setProductForm({
                                      ...productForm,
                                      category_id: e.target.value,
                                    })
                                  }
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
                                <label className="block text-sm font-medium mb-1">
                                  상태
                                </label>
                                <select
                                  className="w-full border rounded-md p-2"
                                  value={productForm.status}
                                  onChange={(e) =>
                                    setProductForm({
                                      ...productForm,
                                      status: e.target.value,
                                    })
                                  }
                                >
                                  <option value="active">판매중</option>
                                  <option value="hidden">숨김</option>
                                  <option value="sold_out">품절</option>
                                </select>
                              </div>

                              {/* 상품 이미지 */}
                              <div>
                                <label className="block text-sm font-medium mb-1">
                                  상품 이미지
                                </label>
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
                                  <p className="text-xs text-gray-500">
                                    클릭하여 이미지를 선택하세요
                                  </p>
                                </div>

                                {/* 업로드된 이미지 미리보기 */}
                                {productForm.images.length > 0 && (
                                  <div className="mt-4">
                                    <p className="text-sm font-medium mb-2">
                                      업로드된 이미지
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {productForm.images.map(
                                        (img: string, index: number) => (
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
                                        ),
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* 우측 컬럼 - 상품 옵션 */}
                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium mb-2">
                                  상품 옵션
                                </label>

                                {/* 등록된 옵션 목록 */}
                                {productOptions.length > 0 && (
                                  <div className="mb-4 border rounded-md p-3 bg-gray-50">
                                    <h4 className="font-medium text-sm mb-2">
                                      등록된 옵션
                                    </h4>
                                    {productOptions.map((option, index) => (
                                      <div
                                        key={index}
                                        className="mb-3 pb-3 border-b last:border-0"
                                      >
                                        <div className="flex justify-between items-center mb-1">
                                          <span className="font-medium">
                                            {option.name}
                                          </span>
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
                                                +
                                                {Math.floor(
                                                  val.price_adjust,
                                                ).toLocaleString()}
                                                원
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
                                    <label className="block text-xs mb-1">
                                      옵션명
                                    </label>
                                    <Input
                                      value={optionName}
                                      onChange={(e) =>
                                        setOptionName(e.target.value)
                                      }
                                      placeholder="예: 사이즈, 색상"
                                      className="flex-1"
                                    />
                                  </div>

                                  {/* 옵션 값 추가 */}
                                  <div className="mb-3">
                                    <label className="block text-xs mb-1">
                                      옵션 값
                                    </label>
                                    <div className="flex gap-2">
                                      <Input
                                        value={optionValues}
                                        onChange={(e) =>
                                          setOptionValues(e.target.value)
                                        }
                                        placeholder="예: S, 빨강"
                                        className="flex-1"
                                      />
                                      <Input
                                        type="number"
                                        value={additionalPrice}
                                        onChange={(e) =>
                                          setAdditionalPrice(e.target.value)
                                        }
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
                                      <label className="block text-xs mb-1">
                                        추가된 옵션 값
                                      </label>
                                      <div className="flex flex-wrap gap-2">
                                        {tempOptionValues.map((val, index) => (
                                          <div
                                            key={index}
                                            className="flex items-center bg-gray-100 rounded px-2 py-1 text-sm"
                                          >
                                            <span>
                                              {val.value} (+
                                              {Math.floor(
                                                val.price_adjust,
                                              ).toLocaleString()}
                                              원)
                                            </span>
                                            <button
                                              className="ml-1 text-red-500"
                                              onClick={() =>
                                                removeOptionValue(index)
                                              }
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
                            <label className="block text-sm font-medium mb-1">
                              상품 설명
                            </label>
                            <div className="border rounded-md overflow-hidden">
                              {/* 에디터 탭 */}
                              <div className="flex border-b bg-gray-50">
                                <button
                                  type="button"
                                  className={`px-3 py-2 text-sm flex items-center gap-1 ${
                                    descriptionMode === "html"
                                      ? "bg-white border-b-2 border-blue-500 text-blue-600"
                                      : "text-gray-600 hover:text-gray-800"
                                  }`}
                                  onClick={() => setDescriptionMode("html")}
                                >
                                  <Code className="h-4 w-4" />
                                  HTML 코드
                                </button>
                                <button
                                  type="button"
                                  className={`px-3 py-2 text-sm flex items-center gap-1 ${
                                    descriptionMode === "preview"
                                      ? "bg-white border-b-2 border-blue-500 text-blue-600"
                                      : "text-gray-600 hover:text-gray-800"
                                  }`}
                                  onClick={() => setDescriptionMode("preview")}
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
                                    onClick={() =>
                                      descriptionImageInputRef.current?.click()
                                    }
                                    title="이미지 추가"
                                  >
                                    <ImageIcon className="h-4 w-4" />
                                    이미지 추가
                                  </button>
                                </div>
                              </div>

                              {/* 에디터 내용 */}
                              {descriptionMode === "html" ? (
                                <div className="relative">
                                  <textarea
                                    className="w-full p-3 min-h-[200px] font-mono text-sm resize-none border-0 focus:outline-none focus:ring-0"
                                    value={productForm.description}
                                    onChange={(e) =>
                                      setProductForm({
                                        ...productForm,
                                        description: e.target.value,
                                      })
                                    }
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
                                        <div className="font-medium mb-2">
                                          HTML 태그 예시:
                                        </div>
                                        <div className="space-y-1">
                                          <div>
                                            <code>
                                              &lt;h3&gt;제목&lt;/h3&gt;
                                            </code>{" "}
                                            - 제목
                                          </div>
                                          <div>
                                            <code>&lt;p&gt;내용&lt;/p&gt;</code>{" "}
                                            - 문단
                                          </div>
                                          <div>
                                            <code>&lt;br&gt;</code> - 줄바꿈
                                          </div>
                                          <div>
                                            <code>
                                              &lt;ul&gt;&lt;li&gt;목록&lt;/li&gt;&lt;/ul&gt;
                                            </code>{" "}
                                            - 목록
                                          </div>
                                          <div>
                                            <code>
                                              &lt;img src="URL" alt="설명"&gt;
                                            </code>{" "}
                                            - 이미지
                                          </div>
                                          <div>
                                            <code>
                                              &lt;a href="URL"&gt;링크&lt;/a&gt;
                                            </code>{" "}
                                            - 링크
                                          </div>
                                        </div>
                                        <div className="mt-2 pt-2 border-t border-gray-600">
                                          <div className="font-medium mb-1">
                                            💡 이미지 추가 팁:
                                          </div>
                                          <div>
                                            우측 상단의 "이미지 추가" 버튼을
                                            클릭하여 쉽게 이미지를 업로드할 수
                                            있습니다.
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className="w-full p-3 min-h-[200px] bg-white prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{
                                    __html: normalizeHtmlImageSrc(
                                      productForm.description ||
                                        '<p class="text-gray-400">미리보기 할 내용이 없습니다. HTML 코드 탭에서 내용을 작성해주세요.</p>',
                                    ),
                                  }}
                                />
                              )}
                            </div>

                            {/* 설명 길이 표시 */}
                            <div className="flex justify-between items-center mt-1 text-xs text-gray-500">
                              <span>
                                {descriptionMode === "html" &&
                                  productForm.description.length > 0 && (
                                    <>
                                      HTML 코드 길이:{" "}
                                      {productForm.description.length}자
                                    </>
                                  )}
                              </span>
                              <span>
                                {productForm.description.length > 1000 && (
                                  <span className="text-amber-600">
                                    ⚠ 긴 설명은 로딩 속도에 영향을 줄 수
                                    있습니다
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
                              {saveProductMutation.isPending
                                ? "저장 중..."
                                : "저장"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    {/* 주문/배송 관리 탭 */}
                    <TabsContent value="orders">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                              <Input
                                placeholder="주문 검색..."
                                className="pl-10 w-56"
                                value={orderSearchTerm}
                                onChange={(e) =>
                                  setOrderSearchTerm(e.target.value)
                                }
                              />
                            </div>
                            <select
                              className="border rounded-md p-2 text-sm"
                              value={orderStatus}
                              onChange={(e) => setOrderStatus(e.target.value)}
                            >
                              <option value="all">모든 상태</option>
                              <option value="pending">결제 완료</option>
                              <option value="processing">처리 중</option>
                              <option value="shipped">배송 중</option>
                              <option value="delivered">배송 완료</option>
                              <option value="canceled">취소됨</option>
                            </select>
                          </div>
                          <div>
                            <Button variant="outline" size="sm">
                              엑셀 다운
                            </Button>
                          </div>
                        </div>

                        <div className="overflow-x-auto border rounded-md">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>주문번호</TableHead>
                                <TableHead>주문일시</TableHead>
                                <TableHead>고객</TableHead>
                                <TableHead>상품</TableHead>
                                <TableHead>금액</TableHead>
                                <TableHead>상태</TableHead>
                                <TableHead>배송정보</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {isOrdersLoading ? (
                                <TableRow>
                                  <TableCell
                                    colSpan={7}
                                    className="text-center py-10"
                                  >
                                    <div className="flex justify-center">
                                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                    </div>
                                    <p className="mt-2 text-sm text-gray-500">
                                      주문 정보를 불러오는 중...
                                    </p>
                                  </TableCell>
                                </TableRow>
                              ) : sellerOrders.length === 0 ? (
                                <TableRow>
                                  <TableCell
                                    colSpan={7}
                                    className="text-center py-10"
                                  >
                                    <p className="text-gray-500">
                                      주문 내역이 없습니다.
                                    </p>
                                  </TableCell>
                                </TableRow>
                              ) : (
                                sellerOrders
                                  .filter((order: any) => {
                                    // 상태 필터링
                                    if (
                                      orderStatus !== "all" &&
                                      order.order_status !== orderStatus
                                    ) {
                                      return false;
                                    }

                                    // 검색어 필터링
                                    if (orderSearchTerm) {
                                      const searchLower =
                                        orderSearchTerm.toLowerCase();
                                      return (
                                        order.id
                                          .toLowerCase()
                                          .includes(searchLower) ||
                                        order.customer_name
                                          ?.toLowerCase()
                                          .includes(searchLower) ||
                                        order.orderItems?.some((item: any) =>
                                          item.product?.title
                                            ?.toLowerCase()
                                            .includes(searchLower),
                                        )
                                      );
                                    }

                                    return true;
                                  })
                                  .map((order: any) => (
                                    <TableRow key={order.id}>
                                      <TableCell className="font-medium">
                                        {order.id}
                                      </TableCell>
                                      <TableCell>
                                        {new Date(
                                          order.createdAt,
                                        ).toLocaleDateString()}
                                      </TableCell>
                                      <TableCell>
                                        {order.customer_name}
                                      </TableCell>
                                      <TableCell>
                                        {order.orderItems?.map(
                                          (item: any, idx: number) => (
                                            <div key={idx}>
                                              {item.product?.title}{" "}
                                              {item.quantity > 1
                                                ? `x${item.quantity}`
                                                : ""}
                                              {idx < order.orderItems.length - 1
                                                ? ", "
                                                : ""}
                                            </div>
                                          ),
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        {order.total_amount?.toLocaleString()}원
                                      </TableCell>
                                      <TableCell>
                                        <select
                                          className="border rounded p-1 text-sm w-full"
                                          value={order.order_status}
                                          onChange={(e) => {
                                            updateOrderStatusMutation.mutate({
                                              orderId: order.id,
                                              status: e.target.value,
                                            });
                                          }}
                                        >
                                          <option value="pending">
                                            결제완료
                                          </option>
                                          <option value="processing">
                                            처리중
                                          </option>
                                          <option value="shipped">
                                            배송중
                                          </option>
                                          <option value="delivered">
                                            배송완료
                                          </option>
                                          <option value="canceled">
                                            취소됨
                                          </option>
                                        </select>
                                      </TableCell>
                                      <TableCell>
                                        {order.tracking_number ? (
                                          <div className="text-xs">
                                            <div>{order.shipping_company}</div>
                                            <div>{order.tracking_number}</div>
                                          </div>
                                        ) : (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                              setSelectedOrderId(order.id);
                                              setTrackingDialog(true);
                                            }}
                                          >
                                            운송장 등록
                                          </Button>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      {/* 운송장 등록 다이얼로그 */}
                      <Dialog
                        open={trackingDialog}
                        onOpenChange={setTrackingDialog}
                      >
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>운송장 정보 등록</DialogTitle>
                            <DialogDescription>
                              주문 #{selectedOrderId}의 배송 정보를 입력하세요.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-2">
                            <div className="space-y-2">
                              <Label htmlFor="shipping-company">
                                배송 업체
                              </Label>
                              <select
                                id="shipping-company"
                                className="w-full border rounded-md p-2"
                                value={shippingCompany}
                                onChange={(e) =>
                                  setShippingCompany(e.target.value)
                                }
                              >
                                {KOREAN_CARRIERS.map((carrier) => (
                                  <option
                                    key={carrier.value}
                                    value={carrier.value}
                                  >
                                    {carrier.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {shippingCompany === "custom" && (
                              <div className="space-y-2">
                                <Label htmlFor="custom-carrier">
                                  직접 입력
                                </Label>
                                <Input
                                  id="custom-carrier"
                                  value={customCarrier}
                                  onChange={(e) =>
                                    setCustomCarrier(e.target.value)
                                  }
                                  placeholder="배송 업체명을 입력하세요"
                                />
                              </div>
                            )}

                            <div className="space-y-2">
                              <Label htmlFor="tracking-number">
                                운송장 번호
                              </Label>
                              <Input
                                id="tracking-number"
                                value={trackingNumber}
                                onChange={(e) =>
                                  setTrackingNumber(e.target.value)
                                }
                                placeholder="운송장 번호를 입력하세요"
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setTrackingDialog(false)}
                            >
                              취소
                            </Button>
                            <Button
                              onClick={() => {
                                if (!trackingNumber.trim()) {
                                  toast({
                                    title: "운송장 번호를 입력하세요",
                                    variant: "destructive",
                                  });
                                  return;
                                }

                                if (
                                  shippingCompany === "custom" &&
                                  !customCarrier.trim()
                                ) {
                                  toast({
                                    title: "배송 업체명을 입력하세요",
                                    variant: "destructive",
                                  });
                                  return;
                                }

                                updateShippingMutation.mutate({
                                  orderId: selectedOrderId,
                                  trackingNumber,
                                  shippingCompany,
                                });
                              }}
                              disabled={updateShippingMutation.isPending}
                            >
                              {updateShippingMutation.isPending
                                ? "저장 중..."
                                : "저장"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </TabsContent>

                    {/* 알림 관리 탭 */}
                    <TabsContent value="notifications">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-medium">알림 목록</h3>
                            <Badge
                              variant="outline"
                              className="bg-red-500 text-white border-0"
                            >
                              {
                                sellerNotifications.filter(
                                  (notif: any) => !notif.is_read,
                                ).length
                              }
                            </Badge>
                          </div>
                          <div className="flex gap-2">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                              <Input
                                placeholder="알림 검색..."
                                className="pl-10 w-56"
                              />
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // 모든 알림을 읽음 처리
                                sellerNotifications
                                  .filter((notif: any) => !notif.is_read)
                                  .forEach((notif: any) => {
                                    markNotificationAsReadMutation.mutate(
                                      notif.id,
                                    );
                                  });
                                toast({
                                  title: "모든 알림을 읽음 처리했습니다",
                                });
                              }}
                            >
                              모두 읽음 표시
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {sellerNotifications.length === 0 ? (
                            <div className="text-center py-10 border rounded-md">
                              <p className="text-gray-500">알림이 없습니다.</p>
                            </div>
                          ) : (
                            sellerNotifications.map((notification: any) => (
                              <div
                                key={notification.id}
                                className={`border rounded-md p-4 ${
                                  !notification.is_read
                                    ? "bg-blue-50 border-blue-200"
                                    : ""
                                }`}
                              >
                                <div className="flex justify-between">
                                  <div
                                    className={`font-medium ${!notification.is_read ? "text-blue-700" : ""}`}
                                  >
                                    {notification.type === "order" &&
                                      "새 주문 알림"}
                                    {notification.type === "shipping" &&
                                      "배송 상태 업데이트"}
                                    {notification.type === "stock" &&
                                      "재고 알림"}
                                    {notification.type === "system" &&
                                      "시스템 알림"}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {formatNotificationTime(
                                      new Date(notification.createdAt),
                                    )}
                                  </div>
                                </div>
                                <p
                                  className={`mt-1 ${notification.is_read ? "text-gray-600" : ""}`}
                                >
                                  {notification.message}
                                </p>
                                <div className="flex justify-between items-center mt-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs h-7 px-2"
                                    onClick={() => {
                                      // 알림 유형에 따라 다른 탭으로 이동
                                      if (
                                        notification.type === "order" &&
                                        notification.order_id
                                      ) {
                                        // 주문 관리 탭으로 이동
                                        const tabsElement =
                                          document.querySelector(
                                            '[data-value="orders"]',
                                          );
                                        if (tabsElement) {
                                          (tabsElement as HTMLElement).click();
                                          // 검색어 설정
                                          setOrderSearchTerm(
                                            notification.order_id,
                                          );
                                        }
                                      } else if (
                                        notification.type === "stock" &&
                                        notification.product_id
                                      ) {
                                        // 상품 관리 탭으로 이동
                                        const tabsElement =
                                          document.querySelector(
                                            '[data-value="products"]',
                                          );
                                        if (tabsElement) {
                                          (tabsElement as HTMLElement).click();
                                          // 검색어 설정
                                          setSearchTerm(
                                            notification.product_id,
                                          );
                                        }
                                      }
                                    }}
                                  >
                                    {notification.type === "order" &&
                                      "주문 보기"}
                                    {notification.type === "shipping" &&
                                      "배송 추적"}
                                    {notification.type === "stock" &&
                                      "상품 관리"}
                                    {notification.type === "system" &&
                                      "자세히 보기"}
                                  </Button>
                                  {!notification.is_read && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-xs h-7 px-2"
                                      onClick={() =>
                                        markNotificationAsReadMutation.mutate(
                                          notification.id,
                                        )
                                      }
                                    >
                                      읽음 표시
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}

            {/* 서비스 관리 탭 */}
            {activeTab === "services" && (
              <Card className="bg-white shadow-md">
                <CardHeader className="border-b border-gray-100 bg-gray-50">
                  <h3 className="text-xl font-bold text-gray-800">
                    서비스(일거리)/명함
                  </h3>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* 기본 정보 입력 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        이름
                      </label>
                      <Input
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        나이
                      </label>
                      <Input
                        type="number"
                        value={ageInput}
                        onChange={(e) =>
                          setAgeInput(parseInt(e.target.value, 10))
                        }
                      />
                    </div>
                    <div className="flex items-center mt-6 space-x-2">
                      <input
                        type="checkbox"
                        id="certified"
                        checked={certifiedInput}
                        onChange={(e) => setCertifiedInput(e.target.checked)}
                      />
                      <label htmlFor="certified" className="text-sm">
                        인증 여부
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        시간당 금액(원)
                      </label>
                      <Input
                        type="number"
                        value={hourlyRate}
                        onChange={(e) =>
                          setHourlyRate(parseInt(e.target.value, 10))
                        }
                        placeholder="예: 25000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        위치
                      </label>
                      <Input
                        value={locationInput}
                        onChange={(e) => setLocationInput(e.target.value)}
                        placeholder="예: 서울 강남구"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        경력 및 자격증
                      </label>
                      <textarea
                        className="w-full p-3 border rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="예: 요양보호사 5년&#10;대형병원 간병인 3년&#10;요양보호사 1급 자격증&#10;심폐소생술(CPR) 교육 이수"
                        value={experience}
                        onChange={(e) => setExperience(e.target.value)}
                        rows={4}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        경력과 자격증을 한 줄에 하나씩 입력해주세요.
                      </p>
                    </div>
                  </div>

                  {/* 서비스 추가 */}
                  <div className="flex flex-col md:flex-row md:items-center gap-2">
                    <Input
                      value={newService}
                      onChange={(e) => setNewService(e.target.value)}
                      placeholder="서비스명"
                      className="flex-1"
                    />
                    <Button
                      onClick={handleAddService}
                      disabled={servicesList.length >= 4}
                    >
                      추가
                    </Button>
                  </div>

                  {/* 서비스 목록 */}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-1/12 text-center">#</TableHead>
                        <TableHead>서비스명</TableHead>
                        <TableHead className="w-1/4 text-right">관리</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {servicesList.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="text-center py-6 text-gray-500"
                          >
                            등록된 서비스가 없습니다
                          </TableCell>
                        </TableRow>
                      ) : (
                        servicesList.map((service, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-center">
                              {idx + 1}
                            </TableCell>
                            <TableCell>
                              {editingIndex === idx ? (
                                <Input
                                  value={editingServiceName}
                                  onChange={(e) =>
                                    setEditingServiceName(e.target.value)
                                  }
                                  className="w-full"
                                />
                              ) : (
                                service
                              )}
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              {editingIndex === idx ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => saveEditService(idx)}
                                  >
                                    저장
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={cancelEditService}
                                  >
                                    취소
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => startEditService(idx)}
                                  >
                                    수정
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleDeleteService(idx)}
                                    className="ml-2"
                                  >
                                    삭제
                                  </Button>
                                </>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  <p className="text-sm text-gray-500">
                    최대 4개의 서비스만 등록할 수 있습니다.
                  </p>

                  {/* 프로필 요약 */}
                  <h4 className="text-md font-semibold mt-6 mb-2">
                    프로필 요약
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>이름</TableHead>
                        <TableHead>나이</TableHead>
                        <TableHead>시간당 금액(원)</TableHead>
                        <TableHead>위치</TableHead>
                        <TableHead>경력</TableHead>
                        <TableHead>인증</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>{nameInput}</TableCell>
                        <TableCell>{ageInput}</TableCell>
                        <TableCell>{hourlyRate.toLocaleString()}</TableCell>
                        <TableCell>{locationInput}</TableCell>
                        <TableCell>{experience}</TableCell>
                        <TableCell>{certifiedInput ? "O" : "X"}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>

                  {/* 저장 버튼 */}
                  <div className="text-right">
                    <Button
                      onClick={handleSaveProfile}
                      disabled={updateProfileMutation.isPending}
                    >
                      {updateProfileMutation.isPending ? "저장 중..." : "저장"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 매출 관리 탭 */}
            {activeTab === "earnings" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <Card className="col-span-1">
                    <CardContent className="pt-6">
                      <h3 className="text-lg font-medium mb-2">총 매출</h3>
                      <p className="text-3xl font-bold text-green-600">
                        {(
                          totalEarnings +
                          sellerOrders.reduce(
                            (sum: number, order: any) =>
                              sum + (order.total_amount || 0),
                            0,
                          )
                        ).toLocaleString()}
                        원
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        서비스 {completedBookings}건 + 상품{" "}
                        {sellerOrders.length}건
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="col-span-1">
                    <CardContent className="pt-6">
                      <h3 className="text-lg font-medium mb-2">서비스 매출</h3>
                      <p className="text-3xl font-bold text-blue-600">
                        {totalEarnings.toLocaleString()}원
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        완료된 예약 {completedBookings}건
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="col-span-1">
                    <CardContent className="pt-6">
                      <h3 className="text-lg font-medium mb-2">상품 매출</h3>
                      <p className="text-3xl font-bold text-purple-600">
                        {sellerOrders
                          .reduce(
                            (sum: number, order: any) =>
                              sum + (order.total_amount || 0),
                            0,
                          )
                          .toLocaleString()}
                        원
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        완료된 주문 {sellerOrders.length}건
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="mb-8">
                  <CardContent className="pt-6">
                    <h3 className="text-lg font-medium mb-4">
                      서비스 매출 내역
                    </h3>
                    <Table>
                      <TableCaption>
                        완료된 예약 기준 서비스 매출 내역
                      </TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead>날짜</TableHead>
                          <TableHead>시간</TableHead>
                          <TableHead>고객</TableHead>
                          <TableHead>서비스</TableHead>
                          <TableHead className="text-right">금액</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bookings.filter((b) => b.status === "completed")
                          .length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="text-center py-8 text-gray-500"
                            >
                              완료된 예약 내역이 없습니다
                            </TableCell>
                          </TableRow>
                        ) : (
                          bookings
                            .filter((b) => b.status === "completed")
                            .map((booking) => (
                              <TableRow key={booking.id}>
                                <TableCell>
                                  {format(
                                    new Date(booking.date),
                                    "yyyy.MM.dd",
                                    { locale: ko },
                                  )}
                                </TableCell>
                                <TableCell>
                                  {format(new Date(booking.date), "HH:mm", {
                                    locale: ko,
                                  })}
                                </TableCell>
                                <TableCell>고객 {booking.userId}</TableCell>
                                <TableCell>
                                  서비스 {booking.serviceId}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {booking.totalAmount.toLocaleString()}원
                                </TableCell>
                              </TableRow>
                            ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <h3 className="text-lg font-medium mb-4">상품 매출 내역</h3>
                    <Table>
                      <TableCaption>
                        완료된 주문 기준 상품 매출 내역
                      </TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead>주문번호</TableHead>
                          <TableHead>날짜</TableHead>
                          <TableHead>고객</TableHead>
                          <TableHead>상품</TableHead>
                          <TableHead className="text-right">금액</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sellerOrders.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="text-center py-8 text-gray-500"
                            >
                              완료된 주문 내역이 없습니다
                            </TableCell>
                          </TableRow>
                        ) : (
                          sellerOrders.map((order: any) => (
                            <TableRow key={order.id}>
                              <TableCell>{order.id}</TableCell>
                              <TableCell>
                                {format(
                                  new Date(order.createdAt),
                                  "yyyy.MM.dd",
                                  { locale: ko },
                                )}
                              </TableCell>
                              <TableCell>{order.customer_name}</TableCell>
                              <TableCell>
                                {order.orderItems && order.orderItems.length > 0
                                  ? order.orderItems[0].product.title +
                                    (order.orderItems.length > 1
                                      ? ` 외 ${order.orderItems.length - 1}건`
                                      : "")
                                  : "상품 정보 없음"}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {order.total_amount?.toLocaleString()}원
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}

            {/* 설정 탭 */}
            {activeTab === "settings" && (
              <div className="grid grid-cols-3 gap-6">
                <Card className="col-span-3">
                  <CardContent className="pt-6">
                    <h3 className="text-lg font-medium mb-4">소개 페이지</h3>
                    <div className="space-y-6">
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                          소개글
                        </label>
                        <textarea
                          className="w-full h-40 p-3 border rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="고객에게 보여질 소개글을 작성해주세요. 경력, 자격증, 전문 분야 등을 포함하면 좋습니다."
                          value={descriptionInput}
                          onChange={(e) => setDescriptionInput(e.target.value)}
                        />
                      </div>

                      {/* 추가 소개글 콘텐츠 */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-sm font-medium text-gray-700">
                            추가 소개 콘텐츠
                          </label>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addIntroContent("text")}
                            >
                              <i className="fas fa-font mr-1"></i>텍스트
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addIntroContent("image")}
                            >
                              <i className="fas fa-image mr-1"></i>이미지
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addIntroContent("link")}
                            >
                              <i className="fas fa-link mr-1"></i>링크
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addIntroContent("youtube")}
                            >
                              <i className="fab fa-youtube mr-1"></i>유튜브
                            </Button>
                          </div>
                        </div>

                        {/* 콘텐츠 목록 */}
                        <div className="space-y-4 mt-4">
                          {introContents.length === 0 && (
                            <p className="text-sm text-gray-500 italic p-4 border border-dashed rounded-md text-center">
                              콘텐츠를 추가하려면 위의 버튼을 클릭하세요.
                            </p>
                          )}

                          {introContents.map((content, index) => (
                            <div
                              key={content.id}
                              className="border rounded-md p-4 relative bg-white"
                            >
                              <Button
                                size="sm"
                                variant="ghost"
                                className="absolute top-2 right-2 text-red-500 hover:text-red-700 hover:bg-red-50 p-1 h-8 w-8"
                                onClick={() => removeIntroContent(content.id)}
                              >
                                <i className="fas fa-times"></i>
                              </Button>

                              <div className="flex items-center mb-2">
                                <span className="bg-gray-200 text-gray-700 rounded-md px-2 py-1 text-xs font-medium mr-2">
                                  {content.type === "text" && "텍스트"}
                                  {content.type === "image" && "이미지"}
                                  {content.type === "link" && "링크"}
                                  {content.type === "youtube" && "유튜브"}
                                </span>
                                <span className="text-sm font-medium">
                                  항목 {index + 1}
                                </span>
                              </div>

                              {/* 콘텐츠 타입별 편집 UI */}
                              {content.type === "text" && (
                                <div className="mt-2">
                                  <textarea
                                    className="w-full p-3 border rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="텍스트를 입력하세요"
                                    value={content.content}
                                    onChange={(e) =>
                                      updateIntroContent(content.id, {
                                        content: e.target.value,
                                      })
                                    }
                                    rows={3}
                                  />
                                </div>
                              )}

                              {content.type === "image" && (
                                <div className="mt-2 space-y-2">
                                  {content.content ? (
                                    <div className="relative">
                                      <img
                                        src={normalizeImageUrl(content.content)}
                                        alt="업로드된 이미지"
                                        className="w-full max-h-40 object-contain border rounded-md"
                                      />
                                    </div>
                                  ) : (
                                    <div className="border-2 border-dashed border-gray-300 rounded-md p-8 text-center">
                                      <Button
                                        variant="outline"
                                        onClick={() => {
                                          const input =
                                            document.createElement("input");
                                          input.type = "file";
                                          input.accept = "image/*";
                                          input.onchange = (e) => {
                                            const target =
                                              e.target as HTMLInputElement;
                                            if (
                                              target.files &&
                                              target.files[0]
                                            ) {
                                              handleIntroImageUpload(
                                                content.id,
                                                target.files[0],
                                              );
                                            }
                                          };
                                          input.click();
                                        }}
                                      >
                                        이미지 업로드
                                      </Button>
                                      <p className="text-xs text-gray-500 mt-2">
                                        JPG, PNG 형식 지원
                                      </p>
                                    </div>
                                  )}

                                  <div>
                                    <label className="text-sm font-medium mb-1 block">
                                      이미지 링크 (선택)
                                    </label>
                                    <input
                                      type="url"
                                      className="w-full p-2 border rounded-md"
                                      placeholder="https://example.com"
                                      value={content.link || ""}
                                      onChange={(e) =>
                                        updateIntroContent(content.id, {
                                          link: e.target.value,
                                        })
                                      }
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                      이미지 클릭시 이동할 URL
                                    </p>
                                  </div>
                                </div>
                              )}

                              {content.type === "link" && (
                                <div className="mt-2 space-y-2">
                                  <div>
                                    <label className="text-sm font-medium mb-1 block">
                                      링크 URL
                                    </label>
                                    <input
                                      type="url"
                                      className="w-full p-2 border rounded-md"
                                      placeholder="https://example.com"
                                      value={content.link || ""}
                                      onChange={(e) =>
                                        updateIntroContent(content.id, {
                                          link: e.target.value,
                                        })
                                      }
                                    />
                                  </div>

                                  <div>
                                    <label className="text-sm font-medium mb-1 block">
                                      링크 텍스트
                                    </label>
                                    <input
                                      type="text"
                                      className="w-full p-2 border rounded-md"
                                      placeholder="링크 설명"
                                      value={content.content}
                                      onChange={(e) =>
                                        updateIntroContent(content.id, {
                                          content: e.target.value,
                                        })
                                      }
                                    />
                                  </div>

                                  <div>
                                    <label className="text-sm font-medium mb-1 block">
                                      링크 설명 (선택)
                                    </label>
                                    <textarea
                                      className="w-full p-2 border rounded-md"
                                      placeholder="링크에 대한 추가 설명"
                                      value={content.description || ""}
                                      onChange={(e) =>
                                        updateIntroContent(content.id, {
                                          description: e.target.value,
                                        })
                                      }
                                      rows={2}
                                    />
                                  </div>
                                </div>
                              )}

                              {content.type === "youtube" && (
                                <div className="mt-2 space-y-2">
                                  <div>
                                    <label className="text-sm font-medium mb-1 block">
                                      유튜브 URL
                                    </label>
                                    <input
                                      type="url"
                                      className="w-full p-2 border rounded-md"
                                      placeholder="https://www.youtube.com/watch?v=VIDEO_ID"
                                      value={content.content}
                                      onChange={(e) =>
                                        updateIntroContent(content.id, {
                                          content: e.target.value,
                                        })
                                      }
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                      유튜브 영상 URL을 입력하세요
                                    </p>
                                  </div>

                                  {content.content &&
                                    content.content.includes("youtube.com") && (
                                      <div className="border rounded-md overflow-hidden aspect-video">
                                        <iframe
                                          src={content.content.replace(
                                            "watch?v=",
                                            "embed/",
                                          )}
                                          className="w-full h-full"
                                          frameBorder="0"
                                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                          allowFullScreen
                                        ></iframe>
                                      </div>
                                    )}

                                  <div>
                                    <label className="text-sm font-medium mb-1 block">
                                      영상 설명 (선택)
                                    </label>
                                    <textarea
                                      className="w-full p-2 border rounded-md"
                                      placeholder="영상에 대한 추가 설명"
                                      value={content.description || ""}
                                      onChange={(e) =>
                                        updateIntroContent(content.id, {
                                          description: e.target.value,
                                        })
                                      }
                                      rows={2}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                          인증 상태
                        </label>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={certifiedInput}
                            onChange={(e) =>
                              setCertifiedInput(e.target.checked)
                            }
                            className="mr-2 h-4 w-4"
                          />
                          <span>{certifiedInput ? "인증됨" : "미인증"}</span>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-gray-200">
                        <Button
                          variant="default"
                          className="w-full"
                          onClick={handleSaveProfile}
                          disabled={updateProfileMutation.isPending}
                        >
                          {updateProfileMutation.isPending
                            ? "저장 중..."
                            : "명함 정보 저장"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 인증 결제 확인 다이얼로그 */}
      {showCertificationPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">인증 서비스 등록</h3>
            <p className="mb-2 text-gray-700">
              인증 서비스 등록 비용은{" "}
              <span className="font-bold">1,000,000원</span>입니다.
            </p>
            <p className="mb-4 text-gray-700">
              등록 후에는 인증 마크가 활성화되며, 쇼핑몰에서의 상품에도 인증
              마크가 표시됩니다.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCertificationPayment(false)}
                disabled={isProcessing}
              >
                취소
              </Button>
              <Button
                onClick={handleCertificationPayment}
                disabled={isProcessing}
              >
                {isProcessing ? "처리 중..." : "결제 진행하기"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* 비밀번호 변경 모달 */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>비밀번호 변경</DialogTitle>
            <DialogDescription>
              현재 비밀번호를 확인하고 새 비밀번호로 변경하세요.
            </DialogDescription>
          </DialogHeader>
          <PasswordChangeForm userId={user.uid || user.id} />
        </DialogContent>
      </Dialog>
    </>
  );
};

function PasswordChangeForm({ userId }: { userId: string | number }) {
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return alert("사용자 정보가 없습니다. 다시 로그인 해주세요.");
    if (newPassword.length < 6)
      return alert("새 비밀번호는 6자 이상이어야 합니다.");
    if (newPassword !== confirmPassword)
      return alert("새 비밀번호가 일치하지 않습니다.");
    try {
      setLoading(true);
      await changePassword({ userId, currentPassword, newPassword });
      alert("비밀번호가 변경되었습니다. 다시 로그인해주세요.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      alert(err.message || "비밀번호 변경 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Input
        type="password"
        placeholder="현재 비밀번호"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        required
      />
      <Input
        type="password"
        placeholder="새 비밀번호(6자 이상)"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        required
      />
      <Input
        type="password"
        placeholder="새 비밀번호 확인"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
      />
      <Button type="submit" disabled={loading}>
        {loading ? "변경 중..." : "비밀번호 변경"}
      </Button>
    </form>
  );
}

export default CareManagerProfile;
