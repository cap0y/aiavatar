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
import { createCustomChannel } from "@/firebase";

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

// 서비스 패키지 인터페이스 추가
interface ServicePackage {
  type: 'basic' | 'standard' | 'premium';
  title: string;
  price: number;
  description: string;
  draftCount: number;      // 시안 개수
  workDays: number;        // 작업일
  revisionCount: number;   // 수정 횟수
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
  
  // 서비스 패키지 상태 추가
  const [servicePackages, setServicePackages] = useState<ServicePackage[]>([
    {
      type: 'basic',
      title: '기본형',
      price: 50000,
      description: '',
      draftCount: 1,
      workDays: 3,
      revisionCount: 1
    },
    {
      type: 'standard',
      title: '일반형',
      price: 100000,
      description: '',
      draftCount: 2,
      workDays: 7,
      revisionCount: 2
    },
    {
      type: 'premium',
      title: '고급형',
      price: 200000,
      description: '',
      draftCount: 3,
      workDays: 14,
      revisionCount: 3
    }
  ]);
  const [editingPackageType, setEditingPackageType] = useState<'basic' | 'standard' | 'premium' | null>(null);
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [locationInput, setLocationInput] = useState<string>("");
  const [experience, setExperience] = useState<string>("");
  const [nameInput, setNameInput] = useState<string>("");
  const [ageInput, setAgeInput] = useState<number>(0);
  const [descriptionInput, setDescriptionInput] = useState<string>("");
  // 소개글 콘텐츠 상태 추가
  
  // 전화번호 팝업 상태
  const [showPhoneDialog, setShowPhoneDialog] = useState(false);
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<string>("");
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>("");
  
  // 작품 완료 팝업 상태
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [selectedBookingForComplete, setSelectedBookingForComplete] = useState<any>(null);
  const [completionFiles, setCompletionFiles] = useState<File[]>([]);
  const [completionNote, setCompletionNote] = useState<string>("");
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const completionFileInputRef = useRef<HTMLInputElement>(null);
  
  const [introContents, setIntroContents] = useState<IntroContent[]>([]);
  const [certifiedInput, setCertifiedInput] = useState<boolean>(false);
  const [certifications, setCertifications] = useState<string>(""); // 자격증 정보 상태 추가
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isInitialLoadRef = useRef<boolean>(true); // 초기 로드 추적
  const lastCareManagerIdRef = useRef<number | null>(null); // 마지막 로드된 careManager ID
  const isSavingRef = useRef<boolean>(false); // 저장 중 플래그

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
    digital_files: [] as string[],
    is_digital: false,
  });

  // 주문 관리 관련 상태
  const [orderStatus, setOrderStatus] = useState<string>("all");
  const [orderSearchTerm, setOrderSearchTerm] = useState<string>("");
  const [trackingDialog, setTrackingDialog] = useState<boolean>(false);
  const [trackingNumber, setTrackingNumber] = useState<string>("");
  const [shippingCompany, setShippingCompany] = useState<string>("cj");
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [customCarrier, setCustomCarrier] = useState<string>("");
  const [deliveryType, setDeliveryType] = useState<"shipping" | "download">("shipping");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string>("");
  const [isUploadingOrderFile, setIsUploadingOrderFile] = useState(false);
  const orderFileInputRef = useRef<HTMLInputElement>(null);
  
  // 상품 디지털 파일 업로드 관련 상태
  const [isUploadingDigitalFile, setIsUploadingDigitalFile] = useState(false);
  const digitalFileInputRef = useRef<HTMLInputElement>(null);

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

  // AI아바타 정보 조회
  const careManagerId = user?.uid ? parseInt(user.uid.toString()) : 0;

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

  const { data: careManager } = useQuery<any>({
    queryKey: ["/api/care-managers", careManagerId],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/care-managers/${careManagerId}`,
      );
      if (!response.ok)
        throw new Error("AI아바타 정보를 불러오는데 실패했습니다");
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
              `AI아바타 ${careManagerId}의 예약 목록 API가 구현되지 않았습니다.`,
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

  // AI아바타의 상품 목록 가져오기
  const { data: products = [] } = useQuery({
    queryKey: ["care-manager-products", user?.uid],
    queryFn: async () => {
      try {
        console.log("=== AI아바타 상품 조회 디버깅 ===");
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

        // AI아바타 상품 필터링 조회 - user.uid 먼저 시도
        console.log("8. AI아바타 상품 필터링 조회 시작...");
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

  // AI아바타의 주문 목록 가져오기
  const { data: sellerOrders = [], isLoading: isOrdersLoading } = useQuery({
    queryKey: ["care-manager-orders", user?.uid],
    queryFn: async () => {
      try {
        const sellerId = user?.uid || (user as any)?.id || user?.email;
        const response = await fetch(`/api/orders/seller/${sellerId}`);

        // Content-Type 확인
        const contentType = response.headers.get("content-type");
        
        if (!response.ok || !contentType || !contentType.includes("application/json")) {
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
                  product: { title: "테크노" },
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
                { product: { title: "사쿠라" }, quantity: 1, price: 25000 },
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

        // API가 정상적으로 JSON을 반환하는 경우
        const data = await response.json();
        return data;
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
              { product: { title: "테크노" }, quantity: 2, price: 15000 },
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
              { product: { title: "사쿠라" }, quantity: 1, price: 25000 },
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

  // AI아바타의 알림 목록 가져오기
  const { data: sellerNotifications = [] } = useQuery({
    queryKey: ["care-manager-notifications", user?.uid],
    queryFn: async () => {
      try {
        const sellerId = user?.uid || (user as any)?.id || user?.email;
        const response = await fetch(`/api/notifications/seller/${sellerId}`);

        // Content-Type 확인
        const contentType = response.headers.get("content-type");
        
        if (!response.ok || !contentType || !contentType.includes("application/json")) {
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

        // API가 정상적으로 JSON을 반환하는 경우
        const data = await response.json();
        return data;
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
          "VTuber",
          "애니메이션",
          "리얼리스틱",
          "판타지",
          "SF/미래",
          "동물/펫",
          "커스텀",
          "액세서리",
          "이모션팩",
        ];
      } catch (error) {
        console.error("카테고리 로드 오류:", error);
        return [
          "전체",
          "VTuber",
          "애니메이션",
          "리얼리스틱",
          "판타지",
          "SF/미래",
          "동물/펫",
          "커스텀",
          "액세서리",
          "이모션팩",
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
   * AI아바타 서비스 목록(일거리) 업데이트 뮤테이션
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
        digital_files: [],
        is_digital: false,
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
      digital_files: [],
      is_digital: false,
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
      digital_files: product.digital_files || product.digitalFiles || [],
      is_digital: product.is_digital || product.isDigital || false,
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
      digital_files: productForm.digital_files || [], // 디지털 파일 URL 배열
      is_digital: productForm.is_digital || false, // 디지털 상품 여부
      seller_id: user.uid, // 현재 사용자 Firebase UID (문자열)
      userId: user.uid, // 다양한 형태로 저장하여 호환성 확보
      user_id: user.uid,
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

  // 이미지 업로드 처리 (상품 이미지)
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
      toast({
        title: "이미지 업로드 중",
        description: "잠시만 기다려주세요...",
      });

      // 이미지 업로드 API 호출 (상품 이미지 전용 API 사용)
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/upload/product-image", {
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
        // productForm.images 배열에 이미지 URL 추가
        const newImages = [...productForm.images, result.imageUrl];
        setProductForm({ ...productForm, images: newImages });

        // 파일 입력 필드 초기화
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }

      toast({
        title: "이미지 업로드 성공",
          description: "상품 이미지가 추가되었습니다.",
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
      setHourlyRate(Math.round(careManager.hourlyRate || 0));
      setLocationInput(careManager.location || "");
      setExperience(careManager.experience || "");
      setNameInput(careManager.name || "");
      setAgeInput(careManager.age || 0);
      setDescriptionInput(careManager.description || "");
      setCertifiedInput(careManager.certified || false);
      setCertifications((careManager as any).certifications || ""); // 타입 단언 사용

      // 서비스 목록 설정
      if (careManager.services && Array.isArray(careManager.services)) {
        const serviceNames = careManager.services.map((service: any) =>
          typeof service === "string" ? service : service.name,
        );
        setServicesList(serviceNames);

        // 서비스 가격 설정 (있는 경우)
        const prices = careManager.services.map((service: any) =>
          typeof service === "string" ? 0 : service.price || 0,
        );
        setServicePrices(prices);
      }

      // 소개글 콘텐츠 로드
      loadIntroContents();
      
      // 서비스 패키지 로드
      loadServicePackages();
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
    } as any);
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
    } as any);
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

  // 채팅 시작 핸들러
  const handleStartChat = async (booking: any) => {
    try {
      const customerName = (booking as any).userName || booking.userId;
      const customerId = booking.userId;
      
      // 의뢰 번호를 기반으로 고유한 채널 ID와 이름 생성 (고객 측과 동일)
      const channelId = `booking-${booking.id}`;
      const channelName = `의뢰 #${booking.id} - ${customerName}`;
      
      console.log(`의뢰 채팅방 생성/입장: 의뢰ID=${booking.id}, 고객=${customerName}`);
      
      // Firebase에 텍스트 채널 생성 (이미 존재하면 업데이트)
      const result = await createCustomChannel({
        id: channelId,
        name: channelName,
        description: `${customerName}님의 작품 제작 의뢰 대화방`,
        type: 'text',
        isPrivate: true,
        ownerId: user.uid, // 크리에이터가 owner
        ownerName: user.displayName || user.email || 'AI 크리에이터',
        members: [user.uid, customerId], // 크리에이터와 고객
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        maxUsers: 2
      });

      if (result.success) {
        console.log('✅ 채팅방 생성 성공:', channelId);
        
        // 생성된 채널로 이동
        setLocation(`/chat?type=custom&channel=${encodeURIComponent(channelId)}&name=${encodeURIComponent(channelName)}`);
        
        toast({
          title: "채팅방 입장",
          description: `${customerName}님과의 의뢰 대화방으로 이동합니다.`,
        });
      } else {
        throw new Error('채널 생성 실패');
      }
      
    } catch (error) {
      console.error("채팅 시작 오류:", error);
      toast({
        title: "채팅 시작 실패",
        description: "오류가 발생했습니다. 다시 시도해주세요.",
        variant: "destructive"
      });
    }
  };

  // 통화 시작 핸들러 (전화번호 팝업)
  const handleStartCall = (booking: any) => {
    const customerName = (booking as any).userName || booking.userId;
    const customerPhone = (booking as any).userPhone || "전화번호 정보 없음";
    
    setSelectedCustomerName(customerName);
    setSelectedCustomerPhone(customerPhone);
    setShowPhoneDialog(true);
  };

  // 작업 완료 다이얼로그 열기
  const handleOpenCompleteDialog = (booking: any) => {
    setSelectedBookingForComplete(booking);
    setCompletionFiles([]);
    setCompletionNote("");
    setShowCompleteDialog(true);
  };

  // 완료 파일 선택
  const handleCompletionFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setCompletionFiles(prev => [...prev, ...filesArray]);
    }
  };

  // 완료 파일 제거
  const handleRemoveCompletionFile = (index: number) => {
    setCompletionFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 작업 완료 처리 (파일 업로드 포함)
  const handleCompleteWork = async () => {
    if (!selectedBookingForComplete) return;

    try {
      setIsUploadingFiles(true);

      let uploadedFileUrls: string[] = [];

      // 파일 업로드
      if (completionFiles.length > 0) {
        toast({
          title: "파일 업로드 중",
          description: `${completionFiles.length}개 파일을 업로드하는 중...`,
        });

        for (const file of completionFiles) {
          const formData = new FormData();
          formData.append("file", file);

          const response = await fetch("/api/upload/completion-file", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            throw new Error("파일 업로드 실패");
          }

          const data = await response.json();
          uploadedFileUrls.push(data.fileUrl || data.url);
        }
      }

      // 작업 완료 처리
      const updateData = {
        status: "completed",
        completionFiles: uploadedFileUrls,
        completionNote: completionNote,
        completedAt: new Date().toISOString(),
      };

      await updateBookingStatus.mutateAsync({
        bookingId: selectedBookingForComplete.id,
        ...updateData,
      });

      toast({
        title: "작업 완료",
        description: "작품이 성공적으로 완료되었습니다.",
      });

      setShowCompleteDialog(false);
      setCompletionFiles([]);
      setCompletionNote("");
      setSelectedBookingForComplete(null);

    } catch (error) {
      console.error("작업 완료 오류:", error);
      toast({
        title: "작업 완료 실패",
        description: "오류가 발생했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingFiles(false);
    }
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
    .reduce((sum, booking) => sum + Math.floor(parseFloat(booking.totalAmount || "0") || 0), 0);

  const todayBookings = dateBookings.length;

  // 날짜에 예약이 있는지 확인하는 함수
  const hasBookingOnDate = (date: Date) => {
    const formattedDate = format(date, "yyyy-MM-dd");
    return bookings.some((booking) => {
      const bookingDate = new Date(booking.bookingDate || booking.createdAt || new Date());
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
    // 서비스 패키지 확인 (기존 서비스 리스트 체크 제거)
    // 서비스 패키지는 별도로 저장되므로 여기서는 체크하지 않음
    
    try {
      isSavingRef.current = true; // 저장 시작
      console.log("💾 저장 시작 - 데이터 덮어쓰기 방지");
      console.log("💾 현재 descriptionInput 값:", {
        value: descriptionInput,
        length: descriptionInput.length,
        isEmpty: descriptionInput === "",
        isNull: descriptionInput === null,
        isUndefined: descriptionInput === undefined
      });
      
      // hourly_rate가 null이 되지 않도록 검증 (정수로 저장)
      const hourlyRateValue = Math.round(hourlyRate || 0);

      const profileData = {
        name: nameInput,
        age: ageInput,
        hourlyRate: hourlyRateValue, // null 방지, 정수로 저장
        location: locationInput,
        experience,
        description: descriptionInput,
        certified: certifiedInput,
        imageUrl: imageBase64,
        services: servicesList.map((name, idx) => ({
          name,
          price: servicePrices[idx] || 0,
        })), // price null 방지
      };

      console.log("💾 프로필 저장 데이터:", {
        ...profileData,
        description: profileData.description,
        descriptionLength: profileData.description.length
      });

      // 프로필 정보 업데이트 (await로 완료 대기)
      const updateResult = await updateProfileMutation.mutateAsync(profileData as any);
      console.log("✅ 프로필 업데이트 서버 응답:", {
        description: updateResult?.description,
        descriptionLength: updateResult?.description?.length || 0
      });

      // 소개글 콘텐츠 저장
      await saveIntroContents();
      
      console.log("✅ 모든 저장 완료");
      
      // 저장 완료 후 잠시 대기 (서버 응답 처리 시간)
      setTimeout(() => {
        isSavingRef.current = false;
        console.log("🔓 저장 완료 - 데이터 덮어쓰기 허용");
      }, 1000);
    } catch (error) {
      console.error("❌ 프로필 저장 오류:", error);
      isSavingRef.current = false; // 오류 시에도 플래그 해제
      toast({
        title: "저장 실패",
        description: "프로필 저장 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
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
        // 서버에서 반환된 이미지 URL을 사용 (절대 경로로 정규화)
        const imageUrl = result.imageUrl.startsWith('http') 
          ? result.imageUrl 
          : result.imageUrl;  // 이미 /images/... 형태
        
        console.log("프로필 이미지 업로드 성공:", imageUrl);

        // 로컬 상태 업데이트
        setImageBase64(imageUrl);

        // 크리에이터프로필 이미지 업데이트 (URL 저장)
        updateProfileMutation.mutate({ imageUrl: imageUrl } as any);

        // Firebase 사용자 프로필 이미지도 함께 업데이트
        try {
          await updateUserPhoto(imageUrl);
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

  // 주문 파일 업로드 핸들러
  const handleOrderFileUpload = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsUploadingOrderFile(true);
      const response = await fetch('/api/upload/order-file', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('파일 업로드에 실패했습니다');
      }

      const data = await response.json();
      return data.fileUrl;
    } catch (error) {
      console.error('파일 업로드 오류:', error);
      throw error;
    } finally {
      setIsUploadingOrderFile(false);
    }
  };

  // 배송/다운로드 정보 제출 핸들러
  const handleSubmitShipping = async () => {
    try {
      let finalTrackingNumber = trackingNumber;
      let finalShippingCompany = shippingCompany;

      if (deliveryType === "download") {
        // 다운로드 방식
        if (uploadedFile) {
          // 파일 업로드
          finalTrackingNumber = await handleOrderFileUpload(uploadedFile);
        } else if (downloadUrl) {
          // 직접 입력한 URL
          finalTrackingNumber = downloadUrl;
        } else {
          toast({
            title: "입력 오류",
            description: "파일을 업로드하거나 다운로드 URL을 입력해주세요.",
            variant: "destructive",
          });
          return;
        }
        finalShippingCompany = "직접 다운로드";
      } else {
        // 택배 배송 방식
        if (!trackingNumber) {
          toast({
            title: "입력 오류",
            description: "운송장 번호를 입력해주세요.",
            variant: "destructive",
          });
          return;
        }
        if (shippingCompany === "custom" && !customCarrier) {
          toast({
            title: "입력 오류",
            description: "배송 업체명을 입력해주세요.",
            variant: "destructive",
          });
          return;
        }
        finalShippingCompany = shippingCompany === "custom"
          ? customCarrier
          : KOREAN_CARRIERS.find((c) => c.value === shippingCompany)?.label || shippingCompany;
      }

      // 서버에 전송
      updateShippingMutation.mutate({
        orderId: selectedOrderId,
        trackingNumber: finalTrackingNumber,
        shippingCompany: finalShippingCompany,
      });
    } catch (error) {
      toast({
        title: "처리 실패",
        description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

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
          shipping_company: shippingCompany,
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
      setDeliveryType("shipping");
      setUploadedFile(null);
      setDownloadUrl("");
      toast({
        title: "배송 정보 업데이트 완료",
        description: "배송/다운로드 정보가 성공적으로 등록되었습니다.",
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
    mutationFn: async (notificationId: string | number) => {
      const response = await fetch(
        `/api/notifications/seller/${notificationId}/read`,
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

  // careManager 데이터가 로드되면 폼 필드 초기화 (초기 로드 또는 다른 크리에이터로 변경 시에만)
  useEffect(() => {
    if (careManager) {
      // 저장 중일 때는 덮어쓰지 않음
      if (isSavingRef.current) {
        console.log("🔒 저장 중이므로 데이터 덮어쓰기 건너뛰기");
        return;
      }
      
      const careManagerIdChanged = lastCareManagerIdRef.current !== careManager.id;
      
      // 초기 로드이거나 다른 크리에이터로 변경된 경우에만 덮어쓰기
      if (isInitialLoadRef.current || careManagerIdChanged) {
        console.log("🔄 careManager 데이터 로드 (초기 또는 변경):", {
          isInitial: isInitialLoadRef.current,
          idChanged: careManagerIdChanged,
          currentId: careManager.id,
          lastId: lastCareManagerIdRef.current,
          name: careManager.name,
          description: careManager.description,
          descriptionLength: careManager.description?.length || 0
        });
        
        setNameInput(careManager.name || "");
        setAgeInput(typeof careManager.age === 'number' ? careManager.age : parseInt(careManager.age) || 0);
        setHourlyRate(typeof careManager.hourlyRate === 'number' ? Math.round(careManager.hourlyRate) : parseInt(careManager.hourlyRate) || 0);
        setLocationInput(careManager.location || "");
        setExperience(careManager.experience || careManager.specialization || "");
        
        // description 설정
        if (careManager.description !== undefined && careManager.description !== null) {
          setDescriptionInput(careManager.description);
          console.log("✅ 소개글 설정:", careManager.description.substring(0, 50));
        } else {
          setDescriptionInput("");
          console.log("⚠️ 소개글이 없어서 빈 문자열로 설정");
        }
        
        setCertifiedInput(careManager.certified || careManager.isApproved || false);
        setImageBase64(careManager.imageUrl || careManager.photoURL || null);
        
        // 플래그 업데이트
        isInitialLoadRef.current = false;
        lastCareManagerIdRef.current = careManager.id;
      } else {
        console.log("⏭️ careManager 재렌더링 무시 (동일한 ID, 사용자 입력 보호):", careManager.id);
      }
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
      console.log("소개글 콘텐츠 데이터:", data);
      
      if (data.introContents) {
        // introContents가 배열인지 확인
        const contentsArray = Array.isArray(data.introContents) 
          ? data.introContents 
          : [];
        
        const normalized = contentsArray.map((item: any) => ({
          ...item,
          content:
            item && item.type === "image"
              ? normalizeImageUrl(item.content)
              : item.content,
        }));
        setIntroContents(normalized);
      } else {
        // introContents가 없으면 빈 배열로 설정
        setIntroContents([]);
      }
    } catch (error) {
      console.error("소개글 콘텐츠 로드 오류:", error);
      // 오류 발생 시 빈 배열로 설정
      setIntroContents([]);
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

  // 서비스 패키지 업데이트 함수
  const updateServicePackage = (type: 'basic' | 'standard' | 'premium', field: keyof ServicePackage, value: any) => {
    setServicePackages(prev => 
      prev.map(pkg => 
        pkg.type === type ? { ...pkg, [field]: value } : pkg
      )
    );
  };

  // 서비스 패키지 저장 함수
  const saveServicePackages = async () => {
    try {
      console.log('📦 서비스 패키지 저장 시도:', servicePackages);
      console.log('👤 사용자 UID:', user?.uid);
      
      const response = await fetch(`/api/caremanager/${user?.uid}/service-packages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ packages: servicePackages }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ 서버 응답 오류:', response.status, errorText);
        throw new Error('서비스 패키지 저장에 실패했습니다.');
      }

      const result = await response.json();
      console.log('✅ 서비스 패키지 저장 성공:', result);

      toast({
        title: "저장 완료",
        description: "서비스 패키지가 저장되었습니다.",
      });
      setEditingPackageType(null);
    } catch (error) {
      console.error('❌ 서비스 패키지 저장 오류:', error);
      toast({
        title: "저장 실패",
        description: error instanceof Error ? error.message : "서비스 패키지 저장에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  // 서비스 패키지 로드 함수
  const loadServicePackages = async () => {
    try {
      const response = await fetch(`/api/caremanager/${user?.uid}/service-packages`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('서비스 패키지 데이터:', data);
        
        if (data.packages && Array.isArray(data.packages) && data.packages.length > 0) {
          setServicePackages(data.packages);
        }
      }
    } catch (error) {
      console.error('서비스 패키지 로드 오류:', error);
    }
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
        orderName: "AI아바타 인증 서비스 등록",
        totalAmount: 100000,
        currency: "KRW" as any,
        payMethod: "CARD" as any,
        customData: {
          userId: user?.uid || user?.email,
          certificationType: "care_manager_certification",
        },
        customer: {
          fullName: user?.displayName || "AI아바타",
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
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-2">
            AI 크리에이터 대시보드
          </h1>
          <p className="text-gray-400">AI 아바타 작품 의뢰와 제작 현황을 확인하세요</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* 좌측 프로필 및 메뉴 섹션 */}
          <div className="lg:w-1/4">
            {/* 프로필 카드 */}
            <Card className="bg-gray-800 border-gray-700 mb-6">
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
                            careManager?.imageUrl || careManager?.photoURL || undefined,
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
                    <h2 className="text-xl font-bold text-white">
                      {user.displayName || user.email?.split("@")[0]}
                    </h2>
                    <Button
                      size="sm"
                      variant="default"
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                      onClick={() => setShowPasswordDialog(true)}
                    >
                      비번변경
                    </Button>
                  </div>
                  <p className="text-gray-400">{user.email}</p>
                  <Badge className="mt-2 bg-purple-600">AI 크리에이터</Badge>

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
                  <div className="text-center p-3 bg-gray-700 rounded-lg">
                    <p className="text-gray-400 text-sm">오늘 의뢰</p>
                    <p className="text-2xl font-bold text-white">
                      {todayBookings}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-gray-700 rounded-lg">
                    <p className="text-gray-400 text-sm">검토 대기</p>
                    <p className="text-2xl font-bold text-purple-400">
                      {pendingBookings}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-gray-700 rounded-lg">
                    <p className="text-gray-400 text-sm">아바타 상품</p>
                    <p className="text-2xl font-bold text-blue-400">
                      {products.length}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-gray-700 rounded-lg">
                    <p className="text-gray-400 text-sm">총 수익</p>
                    <p className="text-2xl font-bold text-green-400">
                      {totalEarnings.toLocaleString()}원
                    </p>
                  </div>
                </div>

                {/* 제공 서비스 섹션 추가 */}
                <div className="mb-6">
                  <h3 className="font-medium text-sm mb-2 text-gray-300">
                    AI 아바타 제작 서비스
                  </h3>
                  <div className="space-y-2">
                    {servicesList.length > 0 ? (
                      servicesList.map((service, index) => (
                        <div
                          key={index}
                          className="flex items-center bg-gray-700 p-2 rounded"
                        >
                          <span className="text-sm text-white">{service}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400 italic">
                        등록된 AI 아바타 제작 서비스가 없습니다.
                      </p>
                    )}
                  </div>
                </div>

                {/* 메뉴 목록 */}
                <nav className="space-y-1">
                  <Button
                    variant={activeTab === "bookings" ? "default" : "ghost"}
                    className={`w-full justify-start text-left ${
                      activeTab === "bookings"
                        ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    }`}
                    onClick={() => handleMenuClick("bookings")}
                  >
                    <i className="fas fa-palette mr-2"></i>
                    작품 제작 관리
                  </Button>
                  <Button
                    variant={activeTab === "schedule" ? "default" : "ghost"}
                    className={`w-full justify-start text-left ${
                      activeTab === "schedule"
                        ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    }`}
                    onClick={() => handleMenuClick("schedule")}
                  >
                    <i className="fas fa-calendar-check mr-2"></i>
                    작업 일정 관리
                  </Button>
                  <Button
                    variant={activeTab === "shop" ? "default" : "ghost"}
                    className={`w-full justify-start text-left ${
                      activeTab === "shop"
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    }`}
                    onClick={() => handleMenuClick("shop")}
                  >
                    <i className="fas fa-store mr-2"></i>
                    AI 아바타 상품 관리
                  </Button>
                  <Button
                    variant={activeTab === "earnings" ? "default" : "ghost"}
                    className={`w-full justify-start text-left ${
                      activeTab === "earnings"
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    }`}
                    onClick={() => handleMenuClick("earnings")}
                  >
                    <i className="fas fa-wallet mr-2"></i>
                    수익 관리
                  </Button>
                  <Button
                    variant={activeTab === "services" ? "default" : "ghost"}
                    className={`w-full justify-start text-left ${
                      activeTab === "services"
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    }`}
                    onClick={() => handleMenuClick("services")}
                  >
                    <i className="fas fa-briefcase mr-2"></i>
                    제작 서비스
                  </Button>
                  <Button
                    variant={activeTab === "settings" ? "default" : "ghost"}
                    className={`w-full justify-start text-left ${
                      activeTab === "settings"
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    }`}
                    onClick={() => handleMenuClick("settings")}
                  >
                    <i className="fas fa-cog mr-2"></i>
                    프로필/포트폴리오
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-left text-red-400 hover:text-red-300 hover:bg-red-900/20"
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
              <Card className="bg-gray-800 border-gray-700 shadow-xl">
                <CardHeader className="border-b border-gray-700 bg-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-white flex items-center">
                        <i className="fas fa-palette mr-2 text-purple-400"></i>
                        작품 제작 의뢰 관리
                      </h3>
                      <p className="text-sm text-gray-400 mt-1">결제 완료된 의뢰를 확인하고 작업을 진행하세요</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-purple-400">
                        {bookings.filter((b) => b.status === "paid" || b.status === "pending" || b.status === "confirmed").length}
                      </div>
                      <div className="text-xs text-gray-400">진행중인 작업</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-2">
                  <Tabs defaultValue="pending">
                    <TabsList className="mb-4 grid grid-cols-4 w-full">
                      <TabsTrigger value="pending" className="text-xs sm:text-sm">
                        <i className="fas fa-clock mr-1"></i>
                        대기 ({pendingBookings})
                      </TabsTrigger>
                      <TabsTrigger value="confirmed" className="text-xs sm:text-sm">
                        <i className="fas fa-brush mr-1"></i>
                        작업중 ({confirmedBookings})
                      </TabsTrigger>
                      <TabsTrigger value="completed" className="text-xs sm:text-sm">
                        <i className="fas fa-check-circle mr-1"></i>
                        완료 ({completedBookings})
                      </TabsTrigger>
                      <TabsTrigger value="canceled" className="text-xs sm:text-sm">
                        <i className="fas fa-times-circle mr-1"></i>
                        취소 ({canceledBookings})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent
                      value="pending"
                      className="space-y-2 sm:space-y-3"
                    >
                      {bookings.filter((b) => b.status === "pending" || b.status === "paid").length ===
                      0 ? (
                        <div className="text-center py-12">
                          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-700 rounded-full mb-4">
                            <i className="fas fa-inbox text-3xl text-gray-500"></i>
                          </div>
                          <p className="text-gray-400 text-lg">작업 대기 중인 의뢰가 없습니다</p>
                          <p className="text-gray-500 text-sm mt-2">새로운 의뢰가 들어오면 여기에 표시됩니다</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {bookings
                            .filter((booking) => booking.status === "pending" || booking.status === "paid")
                            .map((booking) => (
                              <div
                                key={booking.id}
                                className="border border-gray-600 rounded-lg p-4 bg-gray-700/50 hover:bg-gray-700 transition-all"
                              >
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge className="bg-yellow-500 text-white">
                                        <i className="fas fa-clock mr-1"></i>
                                        작업 대기
                                      </Badge>
                                      <Badge className="bg-blue-500 text-white">
                                        결제 완료
                                      </Badge>
                                    </div>
                                    <h4 className="font-bold text-lg text-white mb-1">
                                      의뢰자 {(booking as any).userName || booking.userId}
                                    </h4>
                                    <div className="space-y-1 text-sm">
                                      <p className="text-gray-300 flex items-center">
                                        <i className="fas fa-calendar-check mr-2 text-purple-400 w-5"></i>
                                        결제일: {format(
                                          booking.bookingDate || booking.createdAt || new Date(),
                                          "yyyy년 MM월 dd일 HH:mm",
                                          { locale: ko },
                                        )}
                                      </p>
                                      <p className="text-gray-300 flex items-center">
                                        <i className="fas fa-box mr-2 text-blue-400 w-5"></i>
                                        패키지: {booking.notes ? (() => {
                                          try {
                                            const packageInfo = JSON.parse(booking.notes);
                                            return packageInfo.packageTitle || '일반';
                                          } catch {
                                            return '일반';
                                          }
                                        })() : '일반'}
                                      </p>
                                      <p className="text-gray-300 flex items-center">
                                        <i className="fas fa-won-sign mr-2 text-green-400 w-5"></i>
                                        결제 금액: <span className="font-semibold ml-1">{Math.floor(parseFloat(booking.totalAmount || "0") || 0).toLocaleString()}원</span>
                                      </p>
                                    </div>
                                    {booking.notes && (
                                      <div className="mt-3 p-3 bg-gray-800/50 rounded border border-gray-600">
                                        <p className="text-xs text-gray-400 mb-1">
                                          <i className="fas fa-info-circle mr-1"></i>의뢰 상세
                                        </p>
                                        {(() => {
                                          try {
                                            const packageInfo = JSON.parse(booking.notes);
                                            return (
                                              <div className="space-y-1 text-sm text-gray-300">
                                                <div className="flex justify-between">
                                                  <span>패키지 유형:</span>
                                                  <span className="font-semibold">{packageInfo.packageTitle}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span>시안 개수:</span>
                                                  <span className="font-semibold">{packageInfo.draftCount}개</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span>작업 기간:</span>
                                                  <span className="font-semibold">{packageInfo.workDays}일</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span>수정 횟수:</span>
                                                  <span className="font-semibold">{packageInfo.revisionCount}회</span>
                                                </div>
                                                <div className="flex justify-between pt-2 border-t border-gray-600">
                                                  <span>기본 작업비:</span>
                                                  <span className="font-semibold">{packageInfo.basePrice?.toLocaleString()}원</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span>패키지 금액:</span>
                                                  <span className="font-semibold">{packageInfo.packagePrice?.toLocaleString()}원</span>
                                                </div>
                                                {packageInfo.customerRequest && packageInfo.customerRequest !== '요청사항 없음' && (
                                                  <div className="pt-2 border-t border-gray-600">
                                                    <div className="text-xs text-purple-400 font-semibold mb-1">
                                                      <i className="fas fa-comment-dots mr-1"></i>고객 요청사항
                                                    </div>
                                                    <p className="text-xs text-gray-300 whitespace-pre-wrap bg-gray-900/50 p-2 rounded">
                                                      {packageInfo.customerRequest}
                                                    </p>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          } catch {
                                            return <p className="text-sm text-gray-300 whitespace-pre-wrap">{booking.notes}</p>;
                                          }
                                        })()}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex md:flex-col items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="border-red-500 text-red-400 hover:bg-red-900/20 flex-1 md:w-full"
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
                                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 flex-1 md:w-full"
                                      onClick={() =>
                                        handleApproveBooking(booking.id)
                                      }
                                    >
                                      <i className="fas fa-play mr-1"></i>
                                      작업 시작
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="confirmed" className="space-y-3">
                      {bookings.filter((b) => b.status === "confirmed").length === 0 ? (
                        <div className="text-center py-12">
                          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-700 rounded-full mb-4">
                            <i className="fas fa-brush text-3xl text-gray-500"></i>
                          </div>
                          <p className="text-gray-400 text-lg">작업 진행 중인 의뢰가 없습니다</p>
                          <p className="text-gray-500 text-sm mt-2">작업을 시작하면 여기에 표시됩니다</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {bookings
                            .filter((booking) => booking.status === "confirmed")
                            .map((booking) => {
                              const startDate = booking.bookingDate || booking.createdAt || new Date();
                              const daysElapsed = Math.floor((new Date().getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
                              const estimatedDays = booking.duration || 7;
                              const progress = Math.min(100, Math.floor((daysElapsed / estimatedDays) * 100));
                              
                              return (
                                <div
                                  key={booking.id}
                                  className="border border-gray-600 rounded-lg p-4 bg-gray-700/50 hover:bg-gray-700 transition-all"
                                >
                                  <div className="flex flex-col gap-4">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                          <Badge className="bg-blue-500 text-white">
                                            <i className="fas fa-brush mr-1"></i>
                                            작업 진행 중
                                          </Badge>
                                          <span className="text-xs text-gray-400">
                                            D+{daysElapsed}일
                                          </span>
                                        </div>
                                        <h4 className="font-bold text-lg text-white mb-1">
                                          의뢰자 {(booking as any).userName || booking.userId}
                                        </h4>
                                        <div className="space-y-1 text-sm">
                                          <p className="text-gray-300 flex items-center">
                                            <i className="fas fa-play-circle mr-2 text-blue-400 w-5"></i>
                                            시작일: {format(startDate, "yyyy년 MM월 dd일", { locale: ko })}
                                          </p>
                                          <p className="text-gray-300 flex items-center">
                                            <i className="fas fa-box mr-2 text-purple-400 w-5"></i>
                                            패키지: {booking.notes ? (() => {
                                              try {
                                                const packageInfo = JSON.parse(booking.notes);
                                                return packageInfo.packageTitle || '일반';
                                              } catch {
                                                return '일반';
                                              }
                                            })() : '일반'}
                                          </p>
                                          <p className="text-gray-300 flex items-center">
                                            <i className="fas fa-won-sign mr-2 text-green-400 w-5"></i>
                                            금액: <span className="font-semibold ml-1">{Math.floor(parseFloat(booking.totalAmount || "0") || 0).toLocaleString()}원</span>
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* 작업 진행률 */}
                                    <div>
                                      <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs text-gray-400">작업 진행률</span>
                                        <span className="text-xs font-semibold text-purple-400">{progress}%</span>
                                      </div>
                                      <div className="w-full bg-gray-600 rounded-full h-2">
                                        <div 
                                          className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
                                          style={{ width: `${progress}%` }}
                                        ></div>
                                      </div>
                                      <p className="text-xs text-gray-500 mt-1">
                                        예상 완료: {estimatedDays}일 (D-{Math.max(0, estimatedDays - daysElapsed)}일 남음)
                                      </p>
                                    </div>

                                    {booking.notes && (
                                      <div className="p-3 bg-gray-800/50 rounded border border-gray-600">
                                        <p className="text-xs text-gray-400 mb-1">
                                          <i className="fas fa-info-circle mr-1"></i>의뢰 상세
                                        </p>
                                        {(() => {
                                          try {
                                            const packageInfo = JSON.parse(booking.notes);
                                            return (
                                              <div className="space-y-1 text-sm text-gray-300">
                                                <div className="flex justify-between">
                                                  <span>시안:</span>
                                                  <span className="font-semibold">{packageInfo.draftCount}개</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span>작업일:</span>
                                                  <span className="font-semibold">{packageInfo.workDays}일</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span>수정:</span>
                                                  <span className="font-semibold">{packageInfo.revisionCount}회</span>
                                                </div>
                                                {packageInfo.customerRequest && packageInfo.customerRequest !== '요청사항 없음' && (
                                                  <div className="pt-2 border-t border-gray-600">
                                                    <div className="text-xs text-purple-400 font-semibold mb-1">
                                                      <i className="fas fa-comment-dots mr-1"></i>고객 요청사항
                                                    </div>
                                                    <p className="text-xs text-gray-300 whitespace-pre-wrap bg-gray-900/50 p-2 rounded">
                                                      {packageInfo.customerRequest}
                                                    </p>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          } catch {
                                            return <p className="text-sm text-gray-300 whitespace-pre-wrap">{booking.notes}</p>;
                                          }
                                        })()}
                                      </div>
                                    )}

                                    <div className="grid grid-cols-3 gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-blue-500 text-blue-400 hover:bg-blue-900/20"
                                        onClick={() => handleStartChat(booking)}
                                      >
                                        <i className="fas fa-comment mr-1"></i>
                                        채팅
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-purple-500 text-purple-400 hover:bg-purple-900/20"
                                        onClick={() => handleStartCall(booking)}
                                      >
                                        <i className="fas fa-phone mr-1"></i>
                                        통화
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="default"
                                        className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                                        onClick={() => handleOpenCompleteDialog(booking)}
                                      >
                                        <i className="fas fa-check mr-1"></i>
                                        완료
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="completed" className="space-y-3">
                      {bookings.filter((b) => b.status === "completed").length === 0 ? (
                        <div className="text-center py-12">
                          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-700 rounded-full mb-4">
                            <i className="fas fa-check-circle text-3xl text-gray-500"></i>
                          </div>
                          <p className="text-gray-400 text-lg">완료된 작품이 없습니다</p>
                          <p className="text-gray-500 text-sm mt-2">작업을 완료하면 여기에 표시됩니다</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {bookings
                            .filter((booking) => booking.status === "completed")
                            .map((booking) => (
                              <div
                                key={booking.id}
                                className="border border-gray-600 rounded-lg p-4 bg-gray-700/50"
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge className="bg-green-500 text-white">
                                        <i className="fas fa-check-circle mr-1"></i>
                                        납품 완료
                                      </Badge>
                                    </div>
                                    <h4 className="font-bold text-lg text-white mb-1">
                                      의뢰자 {(booking as any).userName || booking.userId}
                                    </h4>
                                    <div className="space-y-1 text-sm">
                                      <p className="text-gray-300 flex items-center">
                                        <i className="fas fa-calendar-check mr-2 text-green-400 w-5"></i>
                                        완료일: {format(booking.bookingDate || booking.createdAt || new Date(), "yyyy년 MM월 dd일", { locale: ko })}
                                      </p>
                                      <p className="text-gray-300 flex items-center">
                                        <i className="fas fa-won-sign mr-2 text-green-400 w-5"></i>
                                        금액: <span className="font-semibold ml-1">{Math.floor(parseFloat(booking.totalAmount || "0") || 0).toLocaleString()}원</span>
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="canceled" className="space-y-3">
                      {bookings.filter((b) => b.status === "canceled").length === 0 ? (
                        <div className="text-center py-12">
                          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-700 rounded-full mb-4">
                            <i className="fas fa-times-circle text-3xl text-gray-500"></i>
                          </div>
                          <p className="text-gray-400 text-lg">취소된 의뢰가 없습니다</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {bookings
                            .filter((booking) => booking.status === "canceled")
                            .map((booking) => (
                              <div
                                key={booking.id}
                                className="border border-gray-600 rounded-lg p-4 bg-gray-700/50 opacity-70"
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge className="bg-red-500 text-white">
                                        <i className="fas fa-times-circle mr-1"></i>
                                        취소됨
                                      </Badge>
                                    </div>
                                    <h4 className="font-bold text-lg text-white mb-1">
                                      의뢰자 {(booking as any).userName || booking.userId}
                                    </h4>
                                    <div className="space-y-1 text-sm">
                                      <p className="text-gray-300 flex items-center">
                                        <i className="fas fa-calendar-times mr-2 text-red-400 w-5"></i>
                                        취소일: {format(booking.bookingDate || booking.createdAt || new Date(), "yyyy년 MM월 dd일", { locale: ko })}
                                      </p>
                                      <p className="text-gray-300 flex items-center">
                                        <i className="fas fa-won-sign mr-2 text-gray-400 w-5"></i>
                                        금액: <span className="font-semibold ml-1">{Math.floor(parseFloat(booking.totalAmount || "0") || 0).toLocaleString()}원</span>
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}

            {/* 제작 일정 관리 탭 */}
            {activeTab === "schedule" && (
              <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                <Card className="col-span-1 xl:col-span-2 bg-gray-800 border-gray-700 shadow-xl">
                  <CardHeader className="border-b border-gray-700 bg-gray-700">
                    <h3 className="text-xl font-bold text-white flex items-center">
                      <i className="fas fa-calendar-alt mr-2 text-purple-400"></i>
                      일정 캘린더
                    </h3>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="flex justify-center mb-4">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setSelectedDate(date)}
                        className="rounded-md border border-gray-600 w-full"
                        modifiers={{
                          hasBooking: (date) => hasBookingOnDate(date),
                        }}
                        modifiersStyles={{
                          hasBooking: {
                            backgroundColor: "#7c3aed",
                            fontWeight: "bold",
                            color: "#ffffff",
                            borderRadius: "50%"
                          },
                        }}
                        fromDate={new Date()}
                        styles={{
                          month: { width: "100%" },
                          caption: { padding: "8px", color: "#ffffff" },
                          caption_label: {
                            fontSize: "1rem",
                            fontWeight: "600",
                            color: "#ffffff"
                          },
                          nav_button: { padding: "6px" },
                          table: { width: "100%", borderCollapse: "collapse" },
                          head_cell: { 
                            width: "14.28%", 
                            textAlign: "center",
                            padding: "8px 0",
                            color: "#9ca3af",
                            fontSize: "0.875rem",
                            fontWeight: "600"
                          },
                          cell: { 
                            width: "14.28%",
                            textAlign: "center",
                            padding: "4px 0"
                          },
                          day: {
                            width: "32px",
                            height: "42px",
                            margin: "0 auto",
                            display: "flex",
                            justifyContent: "center",
                            color: "#ffffff",
                            borderRadius: "50%",
                            cursor: "pointer",
                            fontSize: "0.95rem"
                          }
                        }}
                      />
                    </div>
                    
                    <div className="space-y-3 pt-4 border-t border-gray-600">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">선택한 날짜</span>
                        <span className="text-sm font-semibold text-white">
                          {format(selectedDate, "yyyy년 MM월 dd일", { locale: ko })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">진행 중인 작업</span>
                        <span className="text-xl font-bold text-purple-400">
                          {todayBookings}건
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <div className="bg-yellow-500/20 border border-yellow-500/30 rounded p-2 text-center">
                          <div className="text-xs text-gray-400">대기중</div>
                          <div className="text-lg font-bold text-yellow-400">
                            {bookings.filter(b => b.status === "pending" || b.status === "paid").length}
                          </div>
                        </div>
                        <div className="bg-blue-500/20 border border-blue-500/30 rounded p-2 text-center">
                          <div className="text-xs text-gray-400">작업중</div>
                          <div className="text-lg font-bold text-blue-400">
                            {bookings.filter(b => b.status === "confirmed").length}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="col-span-1 xl:col-span-3 bg-gray-800 border-gray-700 shadow-xl">
                  <CardHeader className="border-b border-gray-700 bg-gray-700">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-white flex items-center">
                        <i className="fas fa-list-check mr-2 text-purple-400"></i>
                        {format(selectedDate, "MM월 dd일", { locale: ko })} 작업 현황
                      </h3>
                      <Badge className="bg-purple-500">{dateBookings.length}건</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {dateBookings.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-700 rounded-full mb-4">
                          <i className="fas fa-calendar-day text-3xl text-gray-500"></i>
                        </div>
                        <p className="text-gray-400 text-lg">선택한 날짜에 작업이 없습니다</p>
                        <p className="text-gray-500 text-sm mt-2">다른 날짜를 선택해보세요</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {dateBookings.map((booking) => {
                          const startDate = booking.bookingDate || booking.createdAt || new Date();
                          const daysElapsed = Math.floor((new Date().getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
                          
                          return (
                            <div
                              key={booking.id}
                              className="border border-gray-600 rounded-lg p-4 bg-gray-700/50 hover:bg-gray-700 transition-all"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge
                                      className={
                                        booking.status === "pending" || booking.status === "paid"
                                          ? "bg-yellow-500"
                                          : booking.status === "confirmed"
                                            ? "bg-blue-500"
                                            : booking.status === "completed"
                                              ? "bg-green-500"
                                              : "bg-red-500"
                                      }
                                    >
                                      {booking.status === "pending" || booking.status === "paid"
                                        ? "대기중"
                                        : booking.status === "confirmed"
                                          ? "작업중"
                                          : booking.status === "completed"
                                            ? "완료"
                                            : "취소"}
                                    </Badge>
                                    <span className="text-xs text-gray-400">
                                      {format(startDate, "HH:mm", { locale: ko })}
                                    </span>
                                  </div>
                                  <h4 className="font-bold text-white mb-1">
                                    의뢰자 {booking.userId}
                                  </h4>
                                  <div className="flex items-center gap-4 text-sm text-gray-300">
                                    <span className="flex items-center">
                                      <i className="fas fa-box mr-1 text-purple-400"></i>
                                      패키지: {booking.notes ? (() => {
                                        try {
                                          const packageInfo = JSON.parse(booking.notes);
                                          return packageInfo.packageTitle || '일반';
                                        } catch {
                                          return '일반';
                                        }
                                      })() : '일반'}
                                    </span>
                                    <span className="flex items-center">
                                      <i className="fas fa-won-sign mr-1 text-green-400"></i>
                                      {Math.floor(parseFloat(booking.totalAmount || "0") || 0).toLocaleString()}원
                                    </span>
                                    {booking.status === "confirmed" && (
                                      <span className="flex items-center text-blue-400">
                                        <i className="fas fa-clock mr-1"></i>
                                        D+{daysElapsed}일
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  {(booking.status === "pending" || booking.status === "paid") && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-xs border-red-500 text-red-400 hover:bg-red-900/20"
                                        onClick={() =>
                                          updateBookingStatus.mutate({
                                            bookingId: booking.id,
                                            status: "canceled",
                                          })
                                        }
                                      >
                                        거절
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="default"
                                        className="text-xs bg-gradient-to-r from-purple-600 to-pink-600"
                                        onClick={() =>
                                          updateBookingStatus.mutate({
                                            bookingId: booking.id,
                                            status: "confirmed",
                                          })
                                        }
                                      >
                                        작업 시작
                                      </Button>
                                    </>
                                  )}
                                  {booking.status === "confirmed" && (
                                    <Button
                                      size="sm"
                                      variant="default"
                                      className="text-xs bg-gradient-to-r from-green-600 to-emerald-600"
                                      onClick={() =>
                                        updateBookingStatus.mutate({
                                          bookingId: booking.id,
                                          status: "completed",
                                        })
                                      }
                                    >
                                      <i className="fas fa-check-circle mr-1"></i>
                                      작업 완료
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 상품 관리 탭 */}
            {activeTab === "shop" && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="border-b border-gray-700 bg-gray-700">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white">
                      AI 아바타 상품 관리
                    </h3>
                  </div>
                </CardHeader>
                <CardContent className="p-6 pb-40">
                  <Tabs defaultValue="products">
                    <TabsList className="mb-4">
                      <TabsTrigger value="products">상품 관리</TabsTrigger>
                      <TabsTrigger value="orders">주문/배송 관리</TabsTrigger>
                      <TabsTrigger value="notifications">알림 관리</TabsTrigger>
                    </TabsList>

                    {/* 상품 관리 탭 */}
                    <TabsContent value="products" className="pt-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                        <h3 className="font-medium mb-2 sm:mb-0 text-white">AI 아바타 상품 관리</h3>
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
                            <span className="hidden sm:inline">AI 아바타 등록</span>
                            <span className="inline sm:hidden">아바타 등록</span>
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
                                아바타 수정
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
                                  <tr className="border-b border-gray-600">
                                    <th className="py-3 px-4 text-gray-300">AI 아바타명</th>
                                    <th className="py-3 px-4 text-gray-300">가격</th>
                                    <th className="py-3 px-4 text-gray-300">재고</th>
                                    <th className="py-3 px-4 text-gray-300">상태</th>
                                    <th className="py-3 px-4 text-gray-300">관리</th>
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
                                        className="border-b border-gray-600 hover:bg-gray-700"
                                      >
                                        <td className="py-3 px-4">
                                          <div className="font-medium text-white">
                                            {product.title}
                                          </div>
                                          <div className="text-sm text-gray-400">
                                            ID: {product.id}
                                          </div>
                                        </td>
                                        <td className="py-3 px-4 text-gray-300">
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
                                                : "text-white"
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
                                            className="text-white"
                                          >
                                            {product.status === "active"
                                              ? "판매중"
                                              : product.status === "sold_out"
                                                ? "품절"
                                                : product.status === "hidden"
                                                  ? "숨김"
                                                  : product.status || "알 수 없음"}
                                          </Badge>
                                        </td>
                                        <td className="py-3 px-4">
                                          <div className="flex gap-1">
                                            <Button
                                              size="sm"
                                              variant="default"
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
                            <div className="text-center py-12 text-gray-400">
                              <Store className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                              <p>등록된 AI 아바타가 없습니다.</p>
                              <Button
                                className="mt-4"
                                onClick={handleCreateProduct}
                              >
                                첫 AI 아바타 등록하기
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 상품 등록/수정 폼 */}
                      {(productTab === "register" || productTab === "edit") && (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-white">
                              {productTab === "register"
                                ? "새 AI 아바타 등록"
                                : "AI 아바타 수정"}
                            </h3>
                            <Button
                              variant="default"
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
                                <label className="block text-sm font-medium mb-1 text-white">
                                  AI 아바타명
                                </label>
                                <Input
                                  value={productForm.title}
                                  onChange={(e) =>
                                    setProductForm({
                                      ...productForm,
                                      title: e.target.value,
                                    })
                                  }
                                  placeholder="AI 아바타 이름을 입력하세요"
                                  className="bg-gray-700 border-gray-600 text-white"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium mb-1 text-white">
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
                                  className="bg-gray-700 border-gray-600 text-white"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium mb-1 text-white">
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
                                  className="bg-gray-700 border-gray-600 text-white"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium mb-1 text-white">
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
                                  className="bg-gray-700 border-gray-600 text-white"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium mb-1 text-white">
                                  카테고리
                                </label>
                                <select
                                  className="w-full border rounded-md p-2 bg-gray-700 border-gray-600 text-white"
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
                                <label className="block text-sm font-medium mb-1 text-white">
                                  상태
                                </label>
                                <select
                                  className="w-full border rounded-md p-2 bg-gray-700 border-gray-600 text-white"
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
                                <label className="block text-sm font-medium mb-1 text-white">
                                  AI 아바타 이미지
                                </label>
                                <input
                                  type="file"
                                  ref={fileInputRef}
                                  onChange={handleImageUpload}
                                  accept="image/*"
                                  className="hidden"
                                />
                                <div
                                  className="border-2 border-dashed border-gray-600 rounded-md p-4 text-center cursor-pointer hover:bg-gray-600 text-gray-300"
                                  onClick={() => fileInputRef.current?.click()}
                                >
                                  <Upload className="h-6 w-6 mx-auto mb-2 text-gray-300" />
                                  <p>이미지 업로드</p>
                                  <p className="text-xs text-gray-500">
                                    클릭하여 이미지를 선택하세요
                                  </p>
                                </div>

                                {/* 업로드된 이미지 미리보기 */}
                                {productForm.images.length > 0 && (
                                  <div className="mt-4">
                                    <p className="text-sm font-medium mb-2 text-white">
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

                              {/* 디지털 파일 업로드 (압축 파일) */}
                              <div>
                                <label className="block text-sm font-medium mb-1 text-white flex items-center gap-2">
                                  <i className="fas fa-file-archive text-green-400"></i>
                                  디지털 파일 (압축 파일)
                                </label>
                                <p className="text-xs text-gray-400 mb-3">
                                  AI 아바타 파일, 소스 파일 등을 업로드하세요. 주문 시 고객에게 자동으로 다운로드 링크가 제공됩니다.
                                </p>
                                
                                {/* 디지털 상품 체크박스 */}
                                <div className="flex items-center gap-2 mb-3">
                                  <input
                                    type="checkbox"
                                    id="is_digital"
                                    checked={productForm.is_digital}
                                    onChange={(e) =>
                                      setProductForm({
                                        ...productForm,
                                        is_digital: e.target.checked,
                                      })
                                    }
                                    className="w-4 h-4"
                                  />
                                  <label htmlFor="is_digital" className="text-sm text-white">
                                    디지털 상품 (배송 불필요)
                                  </label>
                                </div>

                                <input
                                  type="file"
                                  ref={digitalFileInputRef}
                                  onChange={async (e) => {
                                    if (!e.target.files || e.target.files.length === 0) return;
                                    
                                    try {
                                      setIsUploadingDigitalFile(true);
                                      const file = e.target.files[0];
                                      
                                      const formData = new FormData();
                                      formData.append('file', file);
                                      
                                      const response = await fetch('/api/upload/order-file', {
                                        method: 'POST',
                                        body: formData,
                                      });
                                      
                                      if (!response.ok) {
                                        throw new Error('파일 업로드에 실패했습니다');
                                      }
                                      
                                      const data = await response.json();
                                      
                                      setProductForm({
                                        ...productForm,
                                        digital_files: [...productForm.digital_files, data.fileUrl],
                                      });
                                      
                                      toast({
                                        title: "파일 업로드 성공",
                                        description: "디지털 파일이 업로드되었습니다.",
                                      });
                                    } catch (error) {
                                      console.error("파일 업로드 오류:", error);
                                      toast({
                                        title: "파일 업로드 실패",
                                        description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
                                        variant: "destructive",
                                      });
                                    } finally {
                                      setIsUploadingDigitalFile(false);
                                    }
                                  }}
                                  accept=".zip,.rar,.7z,.tar,.gz,.png,.jpg,.jpeg,.gif,.mp4,.mov,.psd,.ai,.pdf"
                                  className="hidden"
                                />
                                <div
                                  className="border-2 border-dashed border-green-600 rounded-md p-4 text-center cursor-pointer hover:bg-green-900/20 text-gray-300"
                                  onClick={() => digitalFileInputRef.current?.click()}
                                >
                                  {isUploadingDigitalFile ? (
                                    <>
                                      <i className="fas fa-spinner fa-spin h-6 w-6 mx-auto mb-2 text-green-400"></i>
                                      <p className="text-green-400">업로드 중...</p>
                                    </>
                                  ) : (
                                    <>
                                      <i className="fas fa-upload h-6 w-6 mx-auto mb-2 text-green-400"></i>
                                      <p className="text-green-400">압축 파일 업로드</p>
                                      <p className="text-xs text-gray-500">
                                        ZIP, RAR, 7Z 등 (최대 100MB)
                                      </p>
                                    </>
                                  )}
                                </div>

                                {/* 업로드된 파일 목록 */}
                                {productForm.digital_files.length > 0 && (
                                  <div className="mt-4 space-y-2">
                                    <p className="text-sm font-medium text-white">
                                      업로드된 파일 ({productForm.digital_files.length}개)
                                    </p>
                                    {productForm.digital_files.map((fileUrl: string, index: number) => (
                                      <div
                                        key={index}
                                        className="flex items-center justify-between bg-gray-700 p-3 rounded border border-gray-600"
                                      >
                                        <div className="flex items-center gap-2 flex-1">
                                          <i className="fas fa-file-archive text-green-400"></i>
                                          <span className="text-white text-sm truncate">
                                            {fileUrl.split('/').pop()?.split('?')[0] || `파일 ${index + 1}`}
                                          </span>
                                        </div>
                                        <button
                                          onClick={() => {
                                            setProductForm({
                                              ...productForm,
                                              digital_files: productForm.digital_files.filter((_, i) => i !== index),
                                            });
                                          }}
                                          className="text-red-400 hover:text-red-300"
                                        >
                                          <i className="fas fa-times"></i>
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* 우측 컬럼 - 상품 옵션 */}
                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium mb-2 text-white">
                                  상품 옵션
                                </label>

                                {/* 등록된 옵션 목록 */}
                                {productOptions.length > 0 && (
                                  <div className="mb-4 border border-gray-600 rounded-md p-3 bg-gray-700/50">
                                    <h4 className="font-medium text-sm mb-2 text-white">
                                      등록된 옵션
                                    </h4>
                                    {productOptions.map((option, index) => (
                                      <div
                                        key={index}
                                        className="mb-3 pb-3 border-b border-gray-600 last:border-0"
                                      >
                                        <div className="flex justify-between items-center mb-1">
                                          <span className="font-medium text-white">
                                            {option.name}
                                          </span>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 w-6 p-0 text-red-400 hover:text-red-500"
                                            onClick={() => removeOption(index)}
                                          >
                                            <XCircle className="h-4 w-4" />
                                          </Button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                          {option.values.map((val, i) => (
                                            <div
                                              key={i}
                                              className="text-sm bg-gray-600 p-1 rounded border border-gray-500 flex justify-between"
                                            >
                                              <span className="text-white">{val.value}</span>
                                              <span className="text-blue-400">
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
                                <div className="border border-gray-600 rounded-md p-3 bg-gray-700/30">
                                  <div className="mb-3">
                                    <label className="block text-xs mb-1 text-white">
                                      옵션명
                                    </label>
                                    <Input
                                      value={optionName}
                                      onChange={(e) =>
                                        setOptionName(e.target.value)
                                      }
                                      placeholder="예: 사이즈, 색상"
                                      className="flex-1 bg-gray-700 border-gray-600 text-white"
                                    />
                                  </div>

                                  {/* 옵션 값 추가 */}
                                  <div className="mb-3">
                                    <label className="block text-xs mb-1 text-white">
                                      옵션 값
                                    </label>
                                    <div className="flex gap-2">
                                      <Input
                                        value={optionValues}
                                        onChange={(e) =>
                                          setOptionValues(e.target.value)
                                        }
                                        placeholder="예: S, 빨강"
                                        className="flex-1 bg-gray-700 border-gray-600 text-white"
                                      />
                                      <Input
                                        type="number"
                                        value={additionalPrice}
                                        onChange={(e) =>
                                          setAdditionalPrice(e.target.value)
                                        }
                                        placeholder="추가 가격"
                                        className="w-32 bg-gray-700 border-gray-600 text-white"
                                      />
                                      <Button
                                        size="sm"
                                        variant="default"
                                        onClick={addOptionValue}
                                        className="bg-purple-600 hover:bg-purple-700 text-white"
                                      >
                                        추가
                                      </Button>
                                    </div>
                                  </div>

                                  {/* 임시 옵션 값 목록 */}
                                  {tempOptionValues.length > 0 && (
                                    <div className="mb-3">
                                      <label className="block text-xs mb-1 text-white">
                                        추가된 옵션 값
                                      </label>
                                      <div className="flex flex-wrap gap-2">
                                        {tempOptionValues.map((val, index) => (
                                          <div
                                            key={index}
                                            className="flex items-center bg-gray-600 rounded px-2 py-1 text-sm"
                                          >
                                            <span className="text-white">
                                              {val.value} (+
                                              {Math.floor(
                                                val.price_adjust,
                                              ).toLocaleString()}
                                              원)
                                            </span>
                                            <button
                                              className="ml-1 text-red-400 hover:text-red-500"
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
                                    className="w-full bg-gray-600 hover:bg-gray-500 text-white"
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
                              variant="default"
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
                          <div className="flex items-center gap-1">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                              <Input
                                placeholder="주문 검색..."
                                className="pl-10 w-36"
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
                              <option value="awaiting_deposit">입금대기</option>
                              <option value="pending">결제 완료</option>
                              <option value="processing">처리 중</option>
                              <option value="shipped">배송 중</option>
                              <option value="delivered">배송 완료</option>
                              <option value="canceled">취소됨</option>
                            </select>
                          </div>
                          <div>
                            <Button variant="default" size="sm">
                              엑셀 다운
                            </Button>
                          </div>
                        </div>

                        <div className="overflow-x-auto border rounded-md">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-white">주문번호</TableHead>
                                <TableHead className="text-white">주문일시</TableHead>
                                <TableHead className="text-white">고객</TableHead>
                                <TableHead className="text-white">상품</TableHead>
                                <TableHead className="text-white">금액</TableHead>
                                <TableHead className="text-white">상태</TableHead>
                                <TableHead className="text-white">배송/다운정보</TableHead>
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
                                    <p className="mt-2 text-sm text-white">
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
                                    <p className="text-white">
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
                                    <TableRow key={order.id} className="text-white">
                                      <TableCell className="font-medium text-white">
                                        {order.id}
                                      </TableCell>
                                      <TableCell className="text-white">
                                        {new Date(
                                          order.createdAt,
                                        ).toLocaleDateString()}
                                      </TableCell>
                                      <TableCell className="text-white">
                                        {order.customer_name}
                                      </TableCell>
                                      <TableCell className="text-white">
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
                                      <TableCell className="text-white">
                                        {order.total_amount?.toLocaleString()}원
                                      </TableCell>
                                      <TableCell className="text-white">
                                        <select
                                          className="border rounded p-1 text-sm w-full bg-gray-700 text-white"
                                          value={order.order_status}
                                          onChange={(e) => {
                                            updateOrderStatusMutation.mutate({
                                              orderId: order.id,
                                              status: e.target.value,
                                            });
                                          }}
                                        >
                                          <option value="awaiting_deposit">
                                            입금대기
                                          </option>
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
                                      <TableCell className="text-white">
                                        {order.tracking_number ? (
                                          <div className="text-xs">
                                            <div>{order.shipping_company}</div>
                                            <div>{order.tracking_number}</div>
                                          </div>
                                        ) : (
                                          <Button
                                            variant="default"
                                            size="sm"
                                            onClick={() => {
                                              setSelectedOrderId(order.id);
                                              setTrackingDialog(true);
                                            }}
                                          >
                                            운송장/다운
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
                            <DialogTitle>운송장 정보 등록/직접 입력 다운주소</DialogTitle>
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
                              variant="default"
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
                            <h3 className="text-lg text-white font-medium">알림 목록</h3>
                            <Badge
                              variant="default"
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
                                className="pl-10 w-56 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                              />
                            </div>
                            <Button
                              variant="default"
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white"
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
                            <div className="text-center py-10 border rounded-md border-gray-600 bg-gray-700">
                              <p className="text-gray-300">알림이 없습니다.</p>
                            </div>
                          ) : (
                            sellerNotifications.map((notification: any) => (
                              <div
                                key={notification.id}
                                className={`border rounded-md p-4 ${
                                  !notification.is_read
                                    ? "bg-gray-700 border-gray-600"
                                    : "bg-gray-800 border-gray-700"
                                }`}
                              >
                                <div className="flex justify-between">
                                  <div
                                    className={`font-medium ${!notification.is_read ? "text-blue-400" : "text-white"}`}
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
                                  <div className="text-sm text-gray-400">
                                    {formatNotificationTime(
                                      new Date(notification.createdAt),
                                    )}
                                  </div>
                                </div>
                                <p
                                  className={`mt-1 ${notification.is_read ? "text-gray-400" : "text-white"}`}
                                >
                                  {notification.message}
                                </p>
                                <div className="flex justify-between items-center mt-2">
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="text-xs h-7 px-2 bg-purple-600 hover:bg-purple-700 text-white"
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
                                      className="text-xs h-7 px-2 text-white hover:bg-gray-600"
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

            {/* AI 아바타 제작 서비스 관리 탭 */}
            {activeTab === "services" && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="border-b border-gray-700 bg-gray-700">
                  <h3 className="text-xl font-bold text-white">
                    AI 아바타 제작 서비스
                  </h3>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* 기본 정보 입력 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-white">
                        크리에이터명
                      </label>
                      <Input
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-white">
                        나이
                      </label>
                      <Input
                        type="number"
                        value={ageInput || ""}
                        onChange={(e) =>
                          setAgeInput(parseInt(e.target.value) || 0)
                        }
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                    </div>
                    <div className="flex items-center mt-6 space-x-2">
                      <input
                        type="checkbox"
                        id="certified"
                        checked={certifiedInput}
                        onChange={(e) => setCertifiedInput(e.target.checked)}
                        className="bg-gray-700 border-gray-600"
                      />
                      <label htmlFor="certified" className="text-sm text-white">
                        AI 크리에이터 인증
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-white">
                        기본 작업비(원)
                      </label>
                      <Input
                        type="number"
                        step="1"
                        value={hourlyRate}
                        onChange={(e) =>
                          setHourlyRate(parseInt(e.target.value) || 0)
                        }
                        placeholder="예: 50000"
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-white">
                        주요 활동 지역
                      </label>
                      <Input
                        value={locationInput}
                        onChange={(e) => setLocationInput(e.target.value)}
                        placeholder="예: 서울 강남구"
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-white mb-2 block">
                        AI 아바타 제작 경력 및 전문성
                      </label>
                      <textarea
                        className="w-full p-3 border rounded-md bg-gray-700 border-gray-600 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="예: AI 아바타 제작 5년&#10;Live2D 모델링 전문&#10;VTuber 캐릭터 디자인 3년&#10;Adobe Creative Suite 마스터&#10;3D 모델링 전문 자격증"
                        value={experience}
                        onChange={(e) => setExperience(e.target.value)}
                        rows={4}
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        AI 아바타 제작 경력과 전문 기술을 한 줄에 하나씩 입력해주세요.
                      </p>
                    </div>
                  </div>

                  {/* 서비스 패키지 관리 */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-semibold text-white">
                        서비스 패키지
                      </h4>
                      <Button
                        onClick={saveServicePackages}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <i className="fas fa-save mr-2"></i>
                        저장
                      </Button>
                    </div>
                    <p className="text-sm text-gray-400">
                      3단계 패키지를 설정하여 고객에게 다양한 옵션을 제공하세요
                    </p>

                    {/* 패키지 카드들 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {servicePackages.map((pkg) => (
                        <Card key={pkg.type} className="bg-gray-700 border-gray-600">
                          <CardHeader className="border-b border-gray-600">
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-white text-lg">
                                {pkg.type === 'basic' && '🥉 기본형'}
                                {pkg.type === 'standard' && '🥈 일반형'}
                                {pkg.type === 'premium' && '🥇 고급형'}
                              </h4>
                              {editingPackageType === pkg.type ? (
                                <Button
                                  size="sm"
                                  onClick={() => setEditingPackageType(null)}
                                  variant="ghost"
                                  className="text-white"
                                >
                                  <i className="fas fa-times"></i>
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => setEditingPackageType(pkg.type)}
                                  variant="ghost"
                                  className="text-white"
                                >
                                  <i className="fas fa-edit"></i>
                                </Button>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="p-4 space-y-3">
                            {editingPackageType === pkg.type ? (
                              <>
                                {/* 편집 모드 */}
                                <div>
                                  <label className="block text-xs font-medium mb-1 text-gray-300">
                                    제목
                                  </label>
                                  <Input
                                    value={pkg.title}
                                    onChange={(e) => updateServicePackage(pkg.type, 'title', e.target.value)}
                                    className="bg-gray-600 border-gray-500 text-white text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1 text-gray-300">
                                    가격(원)
                                  </label>
                                  <Input
                                    type="number"
                                    value={pkg.price}
                                    onChange={(e) => updateServicePackage(pkg.type, 'price', parseInt(e.target.value) || 0)}
                                    className="bg-gray-600 border-gray-500 text-white text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1 text-gray-300">
                                    내용
                                  </label>
                                  <textarea
                                    value={pkg.description}
                                    onChange={(e) => updateServicePackage(pkg.type, 'description', e.target.value)}
                                    className="w-full p-2 border rounded-md bg-gray-600 border-gray-500 text-white text-sm"
                                    rows={3}
                                    placeholder="패키지 설명을 입력하세요"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1 text-gray-300">
                                    시안 개수
                                  </label>
                                  <Input
                                    type="number"
                                    value={pkg.draftCount}
                                    onChange={(e) => updateServicePackage(pkg.type, 'draftCount', parseInt(e.target.value) || 0)}
                                    className="bg-gray-600 border-gray-500 text-white text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1 text-gray-300">
                                    작업일
                                  </label>
                                  <Input
                                    type="number"
                                    value={pkg.workDays}
                                    onChange={(e) => updateServicePackage(pkg.type, 'workDays', parseInt(e.target.value) || 0)}
                                    className="bg-gray-600 border-gray-500 text-white text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1 text-gray-300">
                                    수정 횟수
                                  </label>
                                  <Input
                                    type="number"
                                    value={pkg.revisionCount}
                                    onChange={(e) => updateServicePackage(pkg.type, 'revisionCount', parseInt(e.target.value) || 0)}
                                    className="bg-gray-600 border-gray-500 text-white text-sm"
                                  />
                                </div>
                              </>
                            ) : (
                              <>
                                {/* 보기 모드 */}
                                <div className="text-center py-2">
                                  <div className="text-2xl font-bold text-white mb-1">
                                    {pkg.price.toLocaleString()}원
                                  </div>
                                </div>

                                {/* 제목 */}
                                <div className="mb-3">
                                  <div className="text-xs font-semibold text-gray-400 mb-1">제목</div>
                                  <div className="text-sm font-medium text-white">
                                    {pkg.title || '제목 없음'}
                                  </div>
                                </div>

                                {/* 내용 */}
                                <div className="mb-3">
                                  <div className="text-xs font-semibold text-gray-400 mb-1">내용</div>
                                  <p className="text-sm text-gray-300">
                                    {pkg.description || '내용 없음'}
                                  </p>
                                </div>

                                {/* 세부 정보 */}
                                <div className="space-y-2 border-t border-gray-600 pt-3">
                                  <div className="flex items-center text-sm text-gray-300">
                                    <i className="fas fa-image w-5 text-blue-400"></i>
                                    <span>시안 {pkg.draftCount}개</span>
                                  </div>
                                  <div className="flex items-center text-sm text-gray-300">
                                    <i className="fas fa-calendar-alt w-5 text-green-400"></i>
                                    <span>작업일 {pkg.workDays}일</span>
                                  </div>
                                  <div className="flex items-center text-sm text-gray-300">
                                    <i className="fas fa-redo w-5 text-yellow-400"></i>
                                    <span>수정 {pkg.revisionCount}회</span>
                                  </div>
                                </div>
                              </>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* 프로필 요약 */}
                  <h4 className="text-md font-semibold mt-6 mb-2 text-white">
                    AI 크리에이터 프로필 요약
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-gray-600">
                        <TableHead className="text-gray-300">크리에이터명</TableHead>
                        <TableHead className="text-gray-300">나이</TableHead>
                        <TableHead className="text-gray-300">기본 작업비(원)</TableHead>
                        <TableHead className="text-gray-300">주요 활동지역</TableHead>
                        <TableHead className="text-gray-300">전문성</TableHead>
                        <TableHead className="text-gray-300">인증</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="border-b border-gray-600">
                        <TableCell className="text-gray-300">{nameInput}</TableCell>
                        <TableCell className="text-gray-300">{ageInput}</TableCell>
                        <TableCell className="text-gray-300">{hourlyRate.toLocaleString()}</TableCell>
                        <TableCell className="text-gray-300">{locationInput}</TableCell>
                        <TableCell className="text-gray-300">{experience}</TableCell>
                        <TableCell className="text-gray-300">{certifiedInput ? "O" : "X"}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>

                  {/* 저장 버튼 */}
                  <div className="text-right pb-40">
                    <Button
                      onClick={handleSaveProfile}
                      disabled={updateProfileMutation.isPending}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold px-8 py-3"
                    >
                      {updateProfileMutation.isPending ? "저장 중..." : "서비스 정보 저장"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AI 아바타 수익 관리 탭 */}
            {activeTab === "earnings" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <Card className="col-span-1 bg-gray-800 border-gray-700">
                    <CardContent className="pt-6">
                      <h3 className="text-lg font-medium mb-2 text-white">총 수익</h3>
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
                      <p className="text-sm text-gray-400 mt-1">
                        AI 아바타 제작 {completedBookings}건 + 상품{" "}
                        {sellerOrders.length}건
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="col-span-1 bg-gray-800 border-gray-700">
                    <CardContent className="pt-6">
                      <h3 className="text-lg font-medium mb-2 text-white">AI 아바타 제작 수익</h3>
                      <p className="text-3xl font-bold text-blue-600">
                        {totalEarnings.toLocaleString()}원
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        완성된 의뢰 {completedBookings}건
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="col-span-1 bg-gray-800 border-gray-700">
                    <CardContent className="pt-6">
                      <h3 className="text-lg font-medium mb-2 text-white">상품 매출</h3>
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

                <Card className="mb-8 bg-gray-800 border-gray-700">
                  <CardContent className="pt-6">
                    <h3 className="text-lg font-medium mb-4 text-white">
                      AI 아바타 제작 수익 내역
                    </h3>
                    <Table>
                      <TableCaption className="text-gray-400">
                        완성된 의뢰 기준 AI 아바타 제작 수익 내역
                      </TableCaption>
                      <TableHeader>
                        <TableRow className="border-b border-gray-600">
                          <TableHead className="text-gray-300">날짜</TableHead>
                          <TableHead className="text-gray-300">시간</TableHead>
                          <TableHead className="text-gray-300">의뢰자</TableHead>
                          <TableHead className="text-gray-300">작품 유형</TableHead>
                          <TableHead className="text-right text-gray-300">의뢰비</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bookings.filter((b) => b.status === "completed")
                          .length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="text-center py-8 text-gray-400"
                            >
                              완성된 AI 아바타 제작 내역이 없습니다
                            </TableCell>
                          </TableRow>
                        ) : (
                          bookings
                            .filter((b) => b.status === "completed")
                            .map((booking) => (
                              <TableRow key={booking.id}>
                                <TableCell>
                                  {format(
                                    booking.bookingDate || booking.createdAt || new Date(),
                                    "yyyy.MM.dd",
                                    { locale: ko },
                                  )}
                                </TableCell>
                                <TableCell>
                                  {format(booking.bookingDate || booking.createdAt || new Date(), "HH:mm", {
                                    locale: ko,
                                  })}
                                </TableCell>
                                <TableCell>의뢰자 {booking.userId}</TableCell>
                                <TableCell>
                                  작품 유형 {booking.serviceId}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {Math.floor(parseFloat(booking.totalAmount || "0") || 0).toLocaleString()}원
                                </TableCell>
                              </TableRow>
                            ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="pt-6 pb-40">
                    <h3 className="text-lg font-medium mb-4 text-white">상품 매출 내역</h3>
                    <Table>
                      <TableCaption className="text-gray-300">
                        완료된 주문 기준 상품 매출 내역
                      </TableCaption>
                      <TableHeader>
                        <TableRow className="border-b border-gray-600">
                          <TableHead className="text-gray-300">주문번호</TableHead>
                          <TableHead className="text-gray-300">날짜</TableHead>
                          <TableHead className="text-gray-300">고객</TableHead>
                          <TableHead className="text-gray-300">상품</TableHead>
                          <TableHead className="text-right text-gray-300">금액</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sellerOrders.length === 0 ? (
                          <TableRow className="border-b border-gray-600">
                            <TableCell
                              colSpan={5}
                              className="text-center py-8 text-gray-300"
                            >
                              완료된 주문 내역이 없습니다
                            </TableCell>
                          </TableRow>
                        ) : (
                          sellerOrders.map((order: any) => (
                            <TableRow key={order.id} className="border-b border-gray-600">
                              <TableCell className="text-white">{order.id}</TableCell>
                              <TableCell className="text-white">
                                {format(
                                  new Date(order.createdAt),
                                  "yyyy.MM.dd",
                                  { locale: ko },
                                )}
                              </TableCell>
                              <TableCell className="text-white">{order.customer_name}</TableCell>
                              <TableCell className="text-white">
                                {order.orderItems && order.orderItems.length > 0
                                  ? order.orderItems[0].product.title +
                                    (order.orderItems.length > 1
                                      ? ` 외 ${order.orderItems.length - 1}건`
                                      : "")
                                  : "상품 정보 없음"}
                              </TableCell>
                              <TableCell className="text-right font-medium text-white">
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

            {/* 크리에이터 프로필 탭 */}
            {activeTab === "settings" && (
              <div className="grid grid-cols-3 gap-6">
                <Card className="col-span-3 bg-gray-800 border-gray-700">
                  <CardContent className="pt-6 pb-40">
                    <h3 className="text-lg font-medium mb-4 text-white">AI 크리에이터 프로필 소개</h3>
                    <div className="space-y-6">
                      <div>
                        <label className="text-sm font-medium text-white mb-2 block">
                          AI 크리에이터 소개글
                        </label>
                        <textarea
                          className="w-full h-40 p-3 border rounded-md bg-gray-700 border-gray-600 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="클라이언트에게 보여질 AI 크리에이터 소개글을 작성해주세요. AI 아바타 제작 경력, 전문 기술, 작품 스타일 등을 포함하면 좋습니다."
                          value={descriptionInput}
                          onChange={(e) => setDescriptionInput(e.target.value)}
                        />
                      </div>

                      {/* 추가 소개글 콘텐츠 */}
                      <div className="mb-8">
                        <div className="flex justify-between items-center mb-4">
                          <label className="text-lg font-semibold text-white">
                            AI 아바타 작품 포트폴리오
                          </label>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-purple-600 hover:bg-purple-700 text-white"
                              onClick={() => addIntroContent("text")}
                            >
                              <i className="fas fa-font mr-1"></i>텍스트
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() => addIntroContent("image")}
                            >
                              <i className="fas fa-image mr-1"></i>이미지
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => addIntroContent("link")}
                            >
                              <i className="fas fa-link mr-1"></i>링크
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-red-600 hover:bg-red-700 text-white"
                              onClick={() => addIntroContent("youtube")}
                            >
                              <i className="fab fa-youtube mr-1"></i>유튜브
                            </Button>
                          </div>
                        </div>

                        {/* 콘텐츠 목록 */}
                        <div className="space-y-4 mt-4">
                          {introContents.length === 0 && (
                            <p className="text-sm text-gray-300 italic p-6 border-2 border-dashed border-gray-600 rounded-lg text-center bg-gray-700/30">
                              AI 아바타 작품 콘텐츠를 추가하려면 위의 버튼을 클릭하세요.
                            </p>
                          )}

                          {introContents.map((content, index) => (
                            <div
                              key={content.id}
                              className="border border-gray-600 rounded-lg p-4 relative bg-gray-700/50"
                            >
                              <Button
                                size="sm"
                                variant="ghost"
                                className="absolute top-2 right-2 text-red-400 hover:text-red-500 hover:bg-red-900/20 p-1 h-8 w-8"
                                onClick={() => removeIntroContent(content.id)}
                              >
                                <i className="fas fa-times"></i>
                              </Button>

                              <div className="flex items-center mb-2">
                                <span className="bg-gray-600 text-white rounded-md px-2 py-1 text-xs font-medium mr-2">
                                  {content.type === "text" && "텍스트"}
                                  {content.type === "image" && "이미지"}
                                  {content.type === "link" && "링크"}
                                  {content.type === "youtube" && "유튜브"}
                                </span>
                                <span className="text-sm font-medium text-white">
                                  항목 {index + 1}
                                </span>
                              </div>

                              {/* 콘텐츠 타입별 편집 UI */}
                              {content.type === "text" && (
                                <div className="mt-2">
                                  <textarea
                                    className="w-full p-3 border border-gray-600 rounded-md bg-gray-600 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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
                                        variant="default"
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
                                    <label className="text-sm font-medium mb-1 block text-white">
                                      이미지 링크 (선택)
                                    </label>
                                    <input
                                      type="url"
                                      className="w-full p-2 border border-gray-600 rounded-md bg-gray-600 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                      placeholder="https://example.com"
                                      value={content.link || ""}
                                      onChange={(e) =>
                                        updateIntroContent(content.id, {
                                          link: e.target.value,
                                        })
                                      }
                                    />
                                    <p className="text-xs text-gray-400 mt-1">
                                      이미지 클릭시 이동할 URL
                                    </p>
                                  </div>
                                </div>
                              )}

                              {content.type === "link" && (
                                <div className="mt-2 space-y-2">
                                  <div>
                                    <label className="text-sm font-medium mb-1 block text-white">
                                      링크 URL
                                    </label>
                                    <input
                                      type="url"
                                      className="w-full p-2 border border-gray-600 rounded-md bg-gray-600 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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
                                    <label className="text-sm font-medium mb-1 block text-white">
                                      링크 텍스트
                                    </label>
                                    <input
                                      type="text"
                                      className="w-full p-2 border border-gray-600 rounded-md bg-gray-600 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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
                                    <label className="text-sm font-medium mb-1 block text-white">
                                      링크 설명 (선택)
                                    </label>
                                    <textarea
                                      className="w-full p-2 border border-gray-600 rounded-md bg-gray-600 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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
                                    <label className="text-sm font-medium mb-1 block text-white">
                                      유튜브 URL
                                    </label>
                                    <input
                                      type="url"
                                      className="w-full p-2 border border-gray-600 rounded-md bg-gray-600 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                      placeholder="https://www.youtube.com/watch?v=VIDEO_ID"
                                      value={content.content}
                                      onChange={(e) =>
                                        updateIntroContent(content.id, {
                                          content: e.target.value,
                                        })
                                      }
                                    />
                                    <p className="text-xs text-gray-400 mt-1">
                                      유튜브 영상 URL을 입력하세요
                                    </p>
                                  </div>

                                  {content.content &&
                                    content.content.includes("youtube.com") && (
                                      <div className="border border-gray-600 rounded-md overflow-hidden aspect-video">
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
                                    <label className="text-sm font-medium mb-1 block text-white">
                                      영상 설명 (선택)
                                    </label>
                                    <textarea
                                      className="w-full p-2 border border-gray-600 rounded-md bg-gray-600 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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

                      <div className="mb-8">
                        <label className="text-sm font-medium text-gray-300 mb-2 block">
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
                          <span className="text-white">{certifiedInput ? "인증됨" : "미인증"}</span>
                        </div>
                      </div>

                      {/* 저장 버튼 */}
                      <div className="pt-6 border-t border-gray-700 mb-34">
                        <Button
                          variant="default"
                          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3"
                          onClick={handleSaveProfile}
                          disabled={updateProfileMutation.isPending}
                        >
                          {updateProfileMutation.isPending
                            ? "저장 중..."
                            : "프로필 소개 저장"}
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
                variant="default"
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
        <DialogContent className="sm:max-w-[420px] bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">비밀번호 변경</DialogTitle>
            <DialogDescription className="text-gray-400">
              현재 비밀번호를 확인하고 새 비밀번호로 변경하세요.
            </DialogDescription>
          </DialogHeader>
          <PasswordChangeForm userId={user.uid || user.id} />
        </DialogContent>
      </Dialog>

      {/* 전화번호 팝업 */}
      <Dialog open={showPhoneDialog} onOpenChange={setShowPhoneDialog}>
        <DialogContent className="bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center">
              <i className="fas fa-phone mr-2 text-purple-400"></i>
              고객 전화번호
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              의뢰자와 전화 상담을 위한 연락처입니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-400">의뢰자</label>
              <p className="text-lg font-semibold text-white">
                {selectedCustomerName}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-400">전화번호</label>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-purple-400 flex-1">
                  {selectedCustomerPhone}
                </p>
                {selectedCustomerPhone !== "전화번호 정보 없음" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-purple-500 text-purple-400"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedCustomerPhone);
                      toast({
                        title: "복사 완료",
                        description: "전화번호가 클립보드에 복사되었습니다.",
                      });
                    }}
                  >
                    <i className="fas fa-copy mr-1"></i>
                    복사
                  </Button>
                )}
              </div>
            </div>
            {selectedCustomerPhone !== "전화번호 정보 없음" && (
              <div className="pt-4 border-t border-gray-700">
                <Button
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  onClick={() => {
                    window.location.href = `tel:${selectedCustomerPhone}`;
                  }}
                >
                  <i className="fas fa-phone-alt mr-2"></i>
                  전화 걸기
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 작업 완료 다이얼로그 */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent className="bg-gray-800 border-gray-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center">
              <i className="fas fa-check-circle mr-2 text-green-400"></i>
              작품 완료 및 전달
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              완성된 작품 파일을 업로드하고 고객에게 전달하세요.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* 고객 정보 */}
            <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
              <div className="flex items-center gap-3 mb-2">
                <i className="fas fa-user text-purple-400"></i>
                <span className="text-sm text-gray-400">의뢰자</span>
              </div>
              <p className="text-lg font-semibold text-white ml-6">
                {(selectedBookingForComplete as any)?.userName || selectedBookingForComplete?.userId}
              </p>
            </div>

            {/* 파일 업로드 영역 */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-white flex items-center">
                <i className="fas fa-file-archive mr-2 text-blue-400"></i>
                작품 파일 (필수)
              </label>
              <p className="text-xs text-gray-400 ml-6">
                압축 파일(.zip, .7z, .rar 등) 또는 완성된 작품 파일을 업로드하세요
              </p>
              
              <input
                ref={completionFileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleCompletionFileSelect}
                accept=".zip,.rar,.7z,.tar,.gz,.png,.jpg,.jpeg,.gif,.mp4,.mov,.psd,.ai,.pdf"
              />
              
              <Button
                variant="outline"
                className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
                onClick={() => completionFileInputRef.current?.click()}
                disabled={isUploadingFiles}
              >
                <i className="fas fa-upload mr-2"></i>
                파일 선택
              </Button>

              {/* 선택된 파일 목록 */}
              {completionFiles.length > 0 && (
                <div className="space-y-2 mt-3">
                  {completionFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-gray-700 p-3 rounded border border-gray-600"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <i className="fas fa-file text-blue-400"></i>
                        <span className="text-sm text-white truncate">{file.name}</span>
                        <span className="text-xs text-gray-400">
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                        onClick={() => handleRemoveCompletionFile(index)}
                      >
                        <i className="fas fa-times"></i>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 완료 메시지 */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-white flex items-center">
                <i className="fas fa-comment-dots mr-2 text-purple-400"></i>
                전달 메시지 (선택)
              </label>
              <Textarea
                value={completionNote}
                onChange={(e) => setCompletionNote(e.target.value)}
                placeholder="고객에게 전달할 메시지를 입력하세요&#10;예: 의뢰하신 작품이 완성되었습니다. 확인 후 피드백 부탁드립니다."
                className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 min-h-[100px]"
                maxLength={500}
              />
              <p className="text-xs text-gray-400 text-right">
                {completionNote.length}/500
              </p>
            </div>

            {/* 안내사항 */}
            <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <i className="fas fa-info-circle text-blue-400 mt-1"></i>
                <div className="text-sm text-blue-300 space-y-1">
                  <p>• 파일 업로드 후 완료 처리하면 고객이 파일을 다운로드할 수 있습니다.</p>
                  <p>• 완료된 작품은 "완료" 탭에 표시되며, 고객의 작품 의뢰 현황에도 표시됩니다.</p>
                  <p>• 파일은 안전하게 저장되며, 고객과 공유 링크를 통해 다운로드할 수 있습니다.</p>
                </div>
              </div>
            </div>
          </div>

          {/* 버튼 영역 */}
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-700">
            <Button
              variant="outline"
              className="border-gray-600 text-gray-300"
              onClick={() => {
                setShowCompleteDialog(false);
                setCompletionFiles([]);
                setCompletionNote("");
              }}
              disabled={isUploadingFiles}
            >
              취소
            </Button>
            <Button
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              onClick={handleCompleteWork}
              disabled={completionFiles.length === 0 || isUploadingFiles}
            >
              {isUploadingFiles ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  업로드 중...
                </>
              ) : (
                <>
                  <i className="fas fa-check-circle mr-2"></i>
                  작업 완료
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 운송장/다운로드 정보 등록 다이얼로그 */}
      <Dialog open={trackingDialog} onOpenChange={setTrackingDialog}>
        <DialogContent className="bg-gray-800 border-gray-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center">
              <i className="fas fa-shipping-fast mr-2 text-blue-400"></i>
              배송/다운로드 정보 등록
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              주문 상품을 배송하거나 다운로드 링크를 제공하세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* 배송 방식 선택 */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-white flex items-center">
                <i className="fas fa-list mr-2 text-purple-400"></i>
                배송 방식 선택
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDeliveryType("shipping")}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    deliveryType === "shipping"
                      ? "border-blue-500 bg-blue-900/30"
                      : "border-gray-600 bg-gray-700 hover:border-gray-500"
                  }`}
                >
                  <i className="fas fa-truck text-2xl mb-2 text-blue-400"></i>
                  <p className="font-semibold text-white">택배 배송</p>
                  <p className="text-xs text-gray-400 mt-1">운송장 번호 입력</p>
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryType("download")}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    deliveryType === "download"
                      ? "border-green-500 bg-green-900/30"
                      : "border-gray-600 bg-gray-700 hover:border-gray-500"
                  }`}
                >
                  <i className="fas fa-download text-2xl mb-2 text-green-400"></i>
                  <p className="font-semibold text-white">직접 다운로드</p>
                  <p className="text-xs text-gray-400 mt-1">파일 업로드 또는 URL</p>
                </button>
              </div>
            </div>

            {/* 택배 배송 입력 */}
            {deliveryType === "shipping" && (
              <div className="space-y-4 p-4 bg-blue-900/20 border border-blue-600 rounded-lg">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white">배송 업체</label>
                  <select
                    value={shippingCompany}
                    onChange={(e) => setShippingCompany(e.target.value)}
                    className="w-full bg-gray-700 border-gray-600 text-white rounded p-2"
                  >
                    {KOREAN_CARRIERS.map((carrier) => (
                      <option key={carrier.value} value={carrier.value}>
                        {carrier.label}
                      </option>
                    ))}
                    <option value="custom">직접 입력</option>
                  </select>
                </div>

                {shippingCompany === "custom" && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-white">배송 업체명</label>
                    <Input
                      value={customCarrier}
                      onChange={(e) => setCustomCarrier(e.target.value)}
                      placeholder="배송 업체명을 입력하세요"
                      className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white">운송장 번호</label>
                  <Input
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="운송장 번호를 입력하세요"
                    className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                  />
                </div>
              </div>
            )}

            {/* 직접 다운로드 입력 */}
            {deliveryType === "download" && (
              <div className="space-y-4 p-4 bg-green-900/20 border border-green-600 rounded-lg">
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-white flex items-center">
                    <i className="fas fa-file-archive mr-2 text-green-400"></i>
                    파일 업로드 (압축 파일 권장)
                  </label>
                  <p className="text-xs text-gray-400">
                    AI 아바타 파일, 소스 파일 등을 압축하여 업로드하세요 (최대 100MB)
                  </p>
                  <input
                    ref={orderFileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setUploadedFile(e.target.files[0]);
                        setDownloadUrl(""); // 파일 선택 시 URL 입력 초기화
                      }
                    }}
                    accept=".zip,.rar,.7z,.tar,.gz,.png,.jpg,.jpeg,.gif,.mp4,.mov,.psd,.ai,.pdf"
                  />
                  <Button
                    variant="outline"
                    className="w-full border-green-600 text-green-300 hover:bg-green-900/30"
                    onClick={() => orderFileInputRef.current?.click()}
                    disabled={isUploadingOrderFile}
                  >
                    <i className="fas fa-upload mr-2"></i>
                    파일 선택
                  </Button>

                  {uploadedFile && (
                    <div className="flex items-center justify-between bg-gray-700 p-3 rounded border border-gray-600">
                      <div className="flex items-center gap-2">
                        <i className="fas fa-file text-green-400"></i>
                        <span className="text-white text-sm">{uploadedFile.name}</span>
                        <span className="text-gray-400 text-xs">
                          ({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <button
                        onClick={() => setUploadedFile(null)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 my-3">
                  <div className="flex-1 h-px bg-gray-600"></div>
                  <span className="text-gray-400 text-sm">또는</span>
                  <div className="flex-1 h-px bg-gray-600"></div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-white flex items-center">
                    <i className="fas fa-link mr-2 text-blue-400"></i>
                    다운로드 URL 직접 입력
                  </label>
                  <Input
                    value={downloadUrl}
                    onChange={(e) => {
                      setDownloadUrl(e.target.value);
                      if (e.target.value) setUploadedFile(null); // URL 입력 시 파일 선택 초기화
                    }}
                    placeholder="https://example.com/file.zip"
                    className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    disabled={!!uploadedFile}
                  />
                  <p className="text-xs text-gray-400">
                    외부 저장소(Google Drive, Dropbox 등)의 다운로드 링크를 입력하세요
                  </p>
                </div>
              </div>
            )}

            {/* 안내사항 */}
            <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <i className="fas fa-info-circle text-blue-400 mt-1"></i>
                <div className="text-sm text-blue-300 space-y-1">
                  <p><strong>택배 배송:</strong> 실물 상품의 경우 운송장 번호를 입력하세요.</p>
                  <p><strong>직접 다운로드:</strong> 디지털 상품(AI 아바타 등)의 경우 파일을 업로드하거나 다운로드 링크를 제공하세요.</p>
                  <p>• 고객은 주문 내역에서 다운로드 링크를 확인할 수 있습니다.</p>
                </div>
              </div>
            </div>
          </div>

          {/* 버튼 영역 */}
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-700">
            <Button
              variant="outline"
              className="border-gray-600 text-gray-300"
              onClick={() => {
                setTrackingDialog(false);
                setTrackingNumber("");
                setShippingCompany("cj");
                setCustomCarrier("");
                setDeliveryType("shipping");
                setUploadedFile(null);
                setDownloadUrl("");
              }}
              disabled={isUploadingOrderFile}
            >
              취소
            </Button>
            <Button
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              onClick={handleSubmitShipping}
              disabled={isUploadingOrderFile}
            >
              {isUploadingOrderFile ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  업로드 중...
                </>
              ) : (
                <>
                  <i className="fas fa-check-circle mr-2"></i>
                  등록 완료
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
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
        className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
      />
      <Input
        type="password"
        placeholder="새 비밀번호(6자 이상)"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        required
        className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
      />
      <Input
        type="password"
        placeholder="새 비밀번호 확인"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
      />
      <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
        {loading ? "변경 중..." : "비밀번호 변경"}
      </Button>
    </form>
  );
}

export default CareManagerProfile;
