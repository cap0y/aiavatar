import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { productAPI, cartAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CreditCard,
  Wallet,
  ArrowLeft,
  CheckCircle,
  Clock,
  Truck,
  Store,
  Copy,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label as FormLabel } from "@/components/ui/label";
import { Button as DialogButton } from "@/components/ui/button";
import PortOne from "@portone/browser-sdk/v2";

interface Address {
  id: string;
  name: string;
  phone: string;
  zipcode: string;
  address1: string;
  address2?: string;
  is_default: boolean;
}

interface SelectedOption {
  name: string;
  value: string;
  price_adjust: number;
}

interface CartItem {
  id?: string;
  product_id: string;
  product?: any;
  title?: string;
  price?: number;
  image_url?: string;
  quantity: number;
  selected_options?: SelectedOption[];
}

export default function CheckoutPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedAddress, setSelectedAddress] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("card");
  const [isProcessing, setIsProcessing] = useState(false);
  const [directCheckoutItems, setDirectCheckoutItems] = useState<CartItem[]>([]);
  const [isDirectCheckout, setIsDirectCheckout] = useState(false);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [showBankInfo, setShowBankInfo] = useState(false);
  const [newAddress, setNewAddress] = useState<Omit<Address, "id" | "is_default">>({
    name: "",
    phone: "",
    zipcode: "",
    address1: "",
    address2: "",
  });

  // 계좌 정보 상수
  const BANK_INFO = {
    bankName: "우리은행",
    accountNumber: "1005-104-556481",
    accountHolder: "김영철",
    imageUrl: "/images/우리은행기업통장.png",
  };

  // 포트원 설정
  const PORTONE_CONFIG = {
    storeId: "store-a14a02cb-9976-411b-8b00-2eb029d02411", // 실제 상점 ID로 변경 필요
    channelKey: "channel-key-689e9418-6654-4e1a-ae05-d035f87260bc", // 실제 채널키로 변경 필요
  };

  // 랜덤 결제 ID 생성 함수
  const generatePaymentId = () => {
    return Array.from(crypto.getRandomValues(new Uint32Array(2)))
      .map((word) => word.toString(16).padStart(8, "0"))
      .join("");
  };

  // 네비게이션 함수
  const navigate = (path: string) => {
    setLocation(path);
  };

  // URL 상태에서 직접 구매 정보 확인 (localStorage 사용)
  useEffect(() => {
    console.log("체크아웃 페이지 로드됨");
    const checkoutData = localStorage.getItem('checkoutData');
    console.log("localStorage에서 가져온 데이터:", checkoutData);
    
    if (checkoutData) {
      try {
        const parsedData = JSON.parse(checkoutData);
        console.log("파싱된 체크아웃 데이터:", parsedData);
        
        if (parsedData.directCheckout && parsedData.items && parsedData.items.length > 0) {
          console.log("직접 구매 상품:", parsedData.items);
          setDirectCheckoutItems(parsedData.items);
          setIsDirectCheckout(true);
          
          // 체크아웃 데이터는 유지 (삭제하지 않음)
          // localStorage.removeItem('checkoutData');
          console.log("체크아웃 데이터 설정 완료, 리다이렉션 없음");
          
          // 사용자 정보가 포함되어 있는지 확인
          if (parsedData.userInfo && !user) {
            console.log("localStorage에 저장된 사용자 정보 발견:", parsedData.userInfo);
            console.log("인증 상태를 확인 중입니다. 잠시 기다려주세요...");
          }
        } else {
          console.log("유효한 체크아웃 데이터가 아님:", parsedData);
        }
      } catch (error) {
        console.error('체크아웃 데이터 파싱 오류:', error);
      }
    } else {
      console.log("localStorage에 체크아웃 데이터 없음");
    }
  }, [user]);

  // 주소 목록 조회 (임시 더미 데이터)
  const { data: addresses = [], isLoading: isLoadingAddresses } = useQuery({
    queryKey: ["addresses"],
    queryFn: async () => {
      // API가 없으므로 더미 데이터 반환
      return [
        {
          id: "1",
          name: user?.displayName || "홍길동",
          phone: "010-1234-5678",
          zipcode: "06292",
          address1: "서울특별시 강남구 역삼동 123-45",
          address2: "테헤란로 427",
          is_default: true,
        }
      ];
    },
    enabled: !!user,
  });

  // 기본 주소 선택
  useEffect(() => {
    if (addresses && addresses.length > 0) {
      const defaultAddress = addresses.find((addr: Address) => addr.is_default);
      if (defaultAddress) {
        setSelectedAddress(defaultAddress.id);
      } else {
        setSelectedAddress(addresses[0].id);
      }
    }
  }, [addresses]);

  // 계좌번호 복사 함수
  const copyAccountNumber = async () => {
    try {
      await navigator.clipboard.writeText(BANK_INFO.accountNumber);
      toast({
        title: "계좌번호가 복사되었습니다",
        description: "붙여넣기 해서 사용하세요.",
        variant: "default",
      });
    } catch (err) {
      toast({
        title: "복사 실패",
        description: "계좌번호를 수동으로 복사해주세요.",
        variant: "destructive",
      });
    }
  };

  // 카트 아이템 로드 (직접구매가 아닐 때)
  const { data: cartItems = [], isLoading: isLoadingCart } = useQuery({
    queryKey: ["checkout-cart", user?.uid, isDirectCheckout],
    queryFn: async () => {
      if (!user?.uid || isDirectCheckout) return [];
      return await cartAPI.getCart(user.uid);
    },
    enabled: !!user?.uid && !isDirectCheckout,
  });

  // 아이템 표준화
  type StandardItem = {
    product_id: string | number;
    product: any;
    quantity: number;
    selected_options: SelectedOption[];
  };

  const normalizeDirect = (item: any): StandardItem => ({
    product_id: item.product_id || item.product?.id,
    product: item.product,
    quantity: Number(item.quantity) || 1,
    selected_options: Array.isArray(item.selected_options) ? item.selected_options : [],
  });

  const normalizeCart = (item: any): StandardItem => ({
    product_id: item.productId || item.product?.id,
    product: item.product,
    quantity: Number(item.quantity) || 1,
    selected_options: Array.isArray(item.selectedOptions)
      ? item.selectedOptions.map((o: any) => ({
          name: o.name,
          value: o.value,
          price_adjust: Number(o.price_adjust) || 0,
        }))
      : [],
  });

  const standardItems: StandardItem[] = isDirectCheckout
    ? (directCheckoutItems || []).map(normalizeDirect)
    : (cartItems || []).map(normalizeCart);

  // 총 상품 금액 계산
  const calculateItemsPrice = () => {
    return standardItems.reduce((total, item) => {
      const basePrice = item.product?.discount_price || item.product?.price || 0;
      const optionPrice = (item.selected_options || []).reduce(
        (sum: number, opt: SelectedOption) => sum + (Number(opt.price_adjust) || 0),
        0,
      );
      return total + (Number(basePrice) + optionPrice) * (Number(item.quantity) || 1);
    }, 0);
  };

  // 배송비 계산 (3만원 이상 무료, 그 이하는 3천원)
  const calculateShippingFee = () => {
    const itemsPrice = calculateItemsPrice();
    return itemsPrice >= 30000 ? 0 : 3000;
  };

  // 총 주문 금액 계산
  const calculateTotalAmount = () => {
    return calculateItemsPrice() + calculateShippingFee();
  };

  // 상품 목록 (표준화된 아이템 사용)
  const displayItems: StandardItem[] = standardItems;

  // 주문 처리
  const handlePlaceOrder = async () => {
    if (!user) {
      toast({
        title: "로그인이 필요합니다",
        description: "주문하려면 로그인해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedAddress) {
      toast({
        title: "배송지를 선택해주세요",
        variant: "destructive",
      });
      return;
    }

    if (!paymentMethod) {
      toast({
        title: "결제 방법을 선택해주세요",
        variant: "destructive",
      });
      return;
    }

    // 상품이 있는지 확인
    if (displayItems.length === 0) {
      toast({
        title: "주문할 상품이 없습니다",
        variant: "destructive",
      });
      return;
    }

    // 결제 방법에 따른 처리
    if (paymentMethod === "card") {
      // 카드 결제 - 포트원 사용
      await handlePortOnePayment();
    } else if (paymentMethod === "bank") {
      // 무통장입금
      setShowBankInfo(true);
    }
  };

  // 포트원 카드 결제 처리
  const handlePortOnePayment = async () => {
    if (!selectedAddress) {
      toast({
        title: "결제 조건을 확인해주세요",
        description: "배송지 선택이 필요합니다.",
        variant: "destructive",
      });
      return;
    }

    if (displayItems.length === 0) {
      toast({
        title: "주문할 상품이 없습니다",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const paymentId = generatePaymentId();
      const totalAmount = calculateTotalAmount();

      // 선택된 배송지 정보 찾기
      const selectedAddressInfo = addresses.find(
        (addr: Address) => addr.id === selectedAddress,
      );

      if (!selectedAddressInfo) {
        toast({
          title: "배송지 정보가 없습니다",
          description: "배송지를 선택해주세요.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      // 주문명 생성 (첫 번째 상품명 + 외 n건)
      const firstItem = displayItems[0];
      const orderName =
        displayItems.length > 1
          ? `${firstItem.product?.title || "상품"} 외 ${displayItems.length - 1}건`
          : firstItem.product?.title || "상품";

      // 고객 전화번호 결정 (배송지 > 사용자 정보 > 기본값 순서)
      const customerPhone =
        selectedAddressInfo?.phone || (user as any)?.phone || "010-0000-0000";

      // 포트원 결제 요청
      const payment = await PortOne.requestPayment({
        storeId: PORTONE_CONFIG.storeId,
        channelKey: PORTONE_CONFIG.channelKey,
        paymentId,
        orderName,
        totalAmount,
        currency: "KRW" as any,
        payMethod: "CARD" as any,
        customData: {
          userId: (user as any)?.id || user?.email, // user.id가 없으면 email 사용
          addressId: selectedAddress,
          items: displayItems.map((item: any) => ({
            product_id: item.product_id || item.product?.id,
            quantity: item.quantity,
            selected_options: item.selected_options || [],
          })),
        },
        customer: {
          fullName: selectedAddressInfo?.name || user?.displayName || "고객",
          phoneNumber: customerPhone,
          email: user?.email || "",
        },
      });

      // 결제 응답이 없거나 실패한 경우
      if (!payment) {
        console.error("포트원 결제 응답 없음");
        setIsProcessing(false);
        toast({
          title: "결제 실패",
          description: "결제 응답을 받지 못했습니다.",
          variant: "destructive",
        });
        return;
      }

      // 결제 실패 처리
      if ("code" in payment && payment.code !== undefined) {
        console.error("포트원 결제 실패:", payment);
        setIsProcessing(false);
        toast({
          title: "결제 실패",
          description:
            ("message" in payment ? payment.message : "") ||
            "결제 중 오류가 발생했습니다.",
          variant: "destructive",
        });
        return;
      }

      // 결제 성공 시 paymentId 확인
      if (!("paymentId" in payment) || !payment.paymentId) {
        console.error("결제 ID가 없습니다:", payment);
        setIsProcessing(false);
        toast({
          title: "결제 오류",
          description: "결제 ID를 받지 못했습니다.",
          variant: "destructive",
        });
        return;
      }

      // 결제 성공 시 서버에 주문 생성 요청
      console.log("결제 성공, 주문 생성 요청:", payment.paymentId);
      
      // 주문 데이터 생성
      const orderData = {
        items: displayItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          selected_options: item.selected_options || []
        })),
        shipping_address_id: selectedAddress,
        payment_method: "card", // 카드결제
        total_amount: totalAmount,
        customer_name: selectedAddressInfo.name,
        customer_phone: customerPhone,
        payment_id: payment.paymentId
      };

      console.log("주문 데이터:", orderData);

      // 서버에 주문 생성 요청
      const orderResponse = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(orderData)
      });

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json();
        throw new Error(errorData.error || "주문 생성에 실패했습니다");
      }

      const order = await orderResponse.json();
      console.log("주문 생성 완료:", order);

      toast({
        title: "결제 및 주문이 완료되었습니다",
        description: `주문번호: ${order.id}`,
        variant: "default",
      });

      // 체크아웃 페이지를 떠나거나 성공 페이지로 이동
      navigate("/shop");
    } catch (error) {
      console.error("결제 처리 오류:", error);
      toast({
        title: "결제 오류",
        description: error instanceof Error ? error.message : "결제 처리 중 오류가 발생했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 카드 결제 처리 (임시) - 기존 함수를 포트원으로 대체
  const handleCardPayment = async () => {
    await handlePortOnePayment();
  };

  // 무통장입금 주문 확정
  const handleBankTransferOrder = async () => {
    try {
      setShowBankInfo(false);
      setIsProcessing(true);

      // 선택된 배송지 정보 찾기
      const selectedAddressInfo = addresses.find(
        (addr: Address) => addr.id === selectedAddress,
      );

      if (!selectedAddressInfo) {
        toast({
          title: "배송지 정보가 없습니다",
          description: "배송지를 선택해주세요.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      // 주문 데이터 생성
      const orderData = {
        items: displayItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          selected_options: item.selected_options || []
        })),
        shipping_address_id: selectedAddress,
        payment_method: "bank", // 무통장입금
        total_amount: calculateTotalAmount(),
        customer_name: selectedAddressInfo.name,
        customer_phone: selectedAddressInfo.phone
      };

      console.log("주문 데이터:", orderData);

      // 서버에 주문 생성 요청
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(orderData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "주문 생성에 실패했습니다");
      }

      const order = await response.json();
      console.log("주문 생성 완료:", order);

      toast({
        title: "주문이 완료되었습니다",
        description: "입금 확인 후 상품이 발송됩니다.",
        variant: "default",
      });
      
      // 주문 완료 후 쇼핑몰로 이동
      navigate("/shop");
    } catch (error) {
      console.error("주문 처리 오류:", error);
      toast({
        title: "주문 처리 실패",
        description: error instanceof Error ? error.message : "주문 처리 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 배송지 추가 핸들러
  const handleAddAddress = async () => {
    try {
      setIsAddingAddress(true);

      // 필수 필드 검증
      if (!newAddress.name || !newAddress.phone || !newAddress.zipcode || !newAddress.address1) {
        toast({
          title: "필수 정보를 입력해주세요",
          description: "이름, 연락처, 우편번호, 주소는 필수 항목입니다.",
          variant: "destructive",
        });
        return;
      }

      // 임시로 성공 처리
      toast({
        title: "배송지가 추가되었습니다",
        description: "새 배송지가 성공적으로 등록되었습니다.",
      });

      // 폼 초기화
      setNewAddress({
        name: "",
        phone: "",
        zipcode: "",
        address1: "",
        address2: "",
      });
    } catch (error) {
      console.error("배송지 추가 오류:", error);
      toast({
        title: "배송지 추가 실패",
        description: "배송지를 추가하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsAddingAddress(false);
    }
  };

  // 인증 상태와 체크아웃 데이터 확인
  useEffect(() => {
    // 컴포넌트 마운트 후 충분한 시간 대기
    const checkAuthAndData = setTimeout(() => {
      console.log("인증 및 데이터 체크:", {
        user: !!user,
        isLoadingAddresses,
        isDirectCheckout,
        displayItemsLength: displayItems.length,
        hasCheckoutData: !!localStorage.getItem('checkoutData')
      });

      // 체크아웃 데이터가 있으면 인증 체크를 지연
      const checkoutData = localStorage.getItem('checkoutData');
      if (checkoutData && !user) {
        console.log("체크아웃 데이터 있음, 로그인 모달 표시");
        toast({
          title: "로그인이 필요합니다",
          description: "주문을 계속하려면 로그인이 필요합니다.",
          variant: "destructive",
        });
        window.dispatchEvent(new CustomEvent("showLogin"));
        return;
      }

      // 사용자는 있지만 상품이 없는 경우만 리다이렉션
      if (user && displayItems.length === 0 && !isProcessing && !isLoadingAddresses && !isLoadingCart) {
        console.log("주문할 상품이 없어서 리다이렉션");
        toast({
          title: "주문할 상품이 없습니다",
          description: "상품을 먼저 선택해주세요.",
          variant: "destructive",
        });
        navigate("/shop");
      }
    }, 2000); // 2초 지연으로 증가

    return () => clearTimeout(checkAuthAndData);
  }, [user, isLoadingAddresses, isLoadingCart, displayItems.length, isProcessing]);

  // 상품 목록이 비어있고 로딩 중이 아닐 때 처리
  if (!isDirectCheckout && !isProcessing && !isLoadingCart && displayItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center py-16 space-y-4">
          <h2 className="text-2xl font-bold text-gray-800">주문할 상품이 없습니다</h2>
          <p className="text-gray-600">장바구니에 상품을 추가하거나 상품 상세페이지에서 바로 구매하기를 이용해주세요.</p>
          <Button onClick={() => navigate("/shop")} className="mt-4">
            <Store className="mr-2 h-4 w-4" />
            쇼핑몰로 이동
          </Button>
        </div>
      </div>
    );
  }

  // 직접 구매 상품이 있는지 확인
  if (isDirectCheckout && directCheckoutItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center py-16 space-y-4">
          <h2 className="text-2xl font-bold text-gray-800">주문 정보를 불러오는데 실패했습니다</h2>
          <p className="text-gray-600">상품 정보가 올바르게 전달되지 않았습니다. 다시 시도해주세요.</p>
          <Button onClick={() => navigate("/shop")} className="mt-4">
            <Store className="mr-2 h-4 w-4" />
            쇼핑몰로 이동
          </Button>
        </div>
      </div>
    );
  }

  // 로딩 중이거나 조건 확인 중일 때 로딩 표시
  if ((!isDirectCheckout && (isLoadingCart || displayItems.length === 0)) || isProcessing) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-2 text-gray-600">페이지를 준비하는 중...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* 상단 네비게이션 */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate("/shop")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          뒤로 가기
        </Button>

        <h1 className="text-2xl font-bold mb-2">주문/결제</h1>
        <p className="text-gray-600">주문 정보를 확인하고 결제를 진행하세요.</p>
      </div>

      {/* 주문 내용 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 왼쪽: 배송지, 결제 방법 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 배송 정보 */}
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-bold mb-4 flex items-center">
              <Truck className="h-5 w-5 mr-2 text-blue-500" />
              배송 정보
            </h2>

            {isLoadingAddresses ? (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="ml-2 text-gray-600">주소 정보를 불러오는 중...</span>
              </div>
            ) : addresses.length > 0 ? (
              <div className="space-y-4">
                <Label>배송지 선택</Label>
                <RadioGroup value={selectedAddress} onValueChange={setSelectedAddress}>
                  {addresses.map((address: Address) => (
                    <div
                      key={address.id}
                      className={`border p-4 rounded-lg transition-colors ${
                        selectedAddress === address.id
                          ? "border-blue-500 bg-blue-50"
                          : "hover:border-gray-300"
                      }`}
                    >
                      <RadioGroupItem
                        value={address.id}
                        id={`address-${address.id}`}
                        className="hidden"
                      />
                      <Label
                        htmlFor={`address-${address.id}`}
                        className="flex items-start cursor-pointer"
                      >
                        <div className="w-full">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{address.name}</span>
                            {address.is_default && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                기본 배송지
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">{address.phone}</div>
                          <div className="text-sm text-gray-600">
                            [{address.zipcode}] {address.address1} {address.address2}
                          </div>
                        </div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>

                <div className="flex justify-end">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        새 배송지 추가
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>새 배송지 추가</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <FormLabel htmlFor="name">수령인 이름*</FormLabel>
                          <Input
                            id="name"
                            value={newAddress.name}
                            onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })}
                            placeholder="수령인 이름"
                          />
                        </div>
                        <div className="space-y-2">
                          <FormLabel htmlFor="phone">연락처*</FormLabel>
                          <Input
                            id="phone"
                            value={newAddress.phone}
                            onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                            placeholder="010-0000-0000"
                          />
                        </div>
                        <div className="space-y-2">
                          <FormLabel htmlFor="zipcode">우편번호*</FormLabel>
                          <div className="flex space-x-2">
                            <Input
                              id="zipcode"
                              value={newAddress.zipcode}
                              onChange={(e) => setNewAddress({ ...newAddress, zipcode: e.target.value })}
                              placeholder="우편번호"
                            />
                            <Button variant="secondary" type="button">
                              검색
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <FormLabel htmlFor="address1">기본주소*</FormLabel>
                          <Input
                            id="address1"
                            value={newAddress.address1}
                            onChange={(e) => setNewAddress({ ...newAddress, address1: e.target.value })}
                            placeholder="기본주소"
                          />
                        </div>
                        <div className="space-y-2">
                          <FormLabel htmlFor="address2">상세주소</FormLabel>
                          <Input
                            id="address2"
                            value={newAddress.address2}
                            onChange={(e) => setNewAddress({ ...newAddress, address2: e.target.value })}
                            placeholder="상세주소"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleAddAddress} disabled={isAddingAddress}>
                          {isAddingAddress ? "추가 중..." : "배송지 추가"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-500 mb-4">등록된 배송지가 없습니다. 새 배송지를 추가해주세요.</p>
              </div>
            )}
          </div>

          {/* 결제 방법 */}
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-bold mb-4 flex items-center">
              <CreditCard className="h-5 w-5 mr-2 text-blue-500" />
              결제 방법
            </h2>

            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
              <div
                className={`border p-4 rounded-lg transition-colors ${
                  paymentMethod === "card"
                    ? "border-blue-500 bg-blue-50"
                    : "hover:border-gray-300"
                }`}
              >
                <RadioGroupItem value="card" id="payment-card" className="hidden" />
                <Label htmlFor="payment-card" className="flex items-center cursor-pointer">
                  <CreditCard className="h-5 w-5 mr-3 text-blue-600" />
                  <div>
                    <div className="font-medium">신용/체크카드</div>
                    <div className="text-xs text-gray-500">모든 카드사 결제 가능</div>
                  </div>
                </Label>
              </div>

              <div
                className={`border p-4 rounded-lg transition-colors ${
                  paymentMethod === "bank"
                    ? "border-blue-500 bg-blue-50"
                    : "hover:border-gray-300"
                }`}
              >
                <RadioGroupItem value="bank" id="payment-bank" className="hidden" />
                <Label htmlFor="payment-bank" className="flex items-center cursor-pointer">
                  <Wallet className="h-5 w-5 mr-3 text-green-600" />
                  <div>
                    <div className="font-medium">무통장입금</div>
                    <div className="text-xs text-gray-500">주문 완료 후 계좌정보 안내</div>
                  </div>
                </Label>
              </div>
            </RadioGroup>

            {/* 무통장입금 선택 시 계좌정보 미리 표시 */}
            {paymentMethod === "bank" && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-medium text-green-800 mb-3">입금 계좌 정보</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">은행명</span>
                    <span className="font-bold text-lg">{BANK_INFO.bankName}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-green-200">
                    <span className="text-gray-600">계좌번호</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg text-blue-600">{BANK_INFO.accountNumber}</span>
                      <Button size="sm" variant="outline" className="h-8 px-2" onClick={copyAccountNumber}>
                        <Copy className="h-3 w-3 mr-1" />
                        복사
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600">예금주</span>
                    <span className="font-bold text-lg">{BANK_INFO.accountHolder}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽: 주문 요약 */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-lg border sticky top-4">
            <h2 className="text-lg font-bold mb-4">주문 요약</h2>

            {/* 주문 상품 목록 */}
            <div className="space-y-3 mb-6">
              <h3 className="font-medium text-sm text-gray-500">주문 상품</h3>
              {displayItems.map((item: any) => (
                <div key={item.product_id} className="flex items-center gap-3 py-2 border-b">
                  <div className="w-12 h-12 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                    {item.product && item.product.images && item.product.images.length > 0 ? (
                      <img
                        src={typeof item.product.images[0] === "string" ? item.product.images[0] : (item.product.images[0]?.url || "")}
                        alt={item.product?.title || "상품 이미지"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                        이미지 없음
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium truncate">{item.product?.title || "상품 정보 없음"}</p>
                    <p className="text-xs text-gray-500">
                      {item.quantity}개 ×{" "}
                      {Math.floor(item.product?.discount_price || item.product?.price || 0).toLocaleString()}원
                    </p>
                    {/* 선택된 옵션 표시 */}
                    {item.selected_options && item.selected_options.length > 0 && (
                      <div className="text-xs text-gray-500">
                        {item.selected_options.map((opt: SelectedOption, idx: number) => (
                          <span key={idx}>
                            {opt.name}: {opt.value}
                            {opt.price_adjust > 0 && ` (+${opt.price_adjust.toLocaleString()}원)`}
                            {idx < item.selected_options!.length - 1 && ", "}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* 금액 정보 */}
            <div className="space-y-2 py-4 border-b mb-4">
              <div className="flex justify-between">
                <span className="text-gray-600">상품 금액</span>
                <span>{Math.floor(calculateItemsPrice()).toLocaleString()}원</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">배송비</span>
                <span>
                  {calculateShippingFee() === 0
                    ? "무료"
                    : `${Math.floor(calculateShippingFee()).toLocaleString()}원`}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center mb-6">
              <span className="font-bold">총 결제 금액</span>
              <span className="text-xl font-bold text-blue-600">
                {Math.floor(calculateTotalAmount()).toLocaleString()}원
              </span>
            </div>

            {/* 결제 동의 */}
            <div className="mb-6">
              <div className="flex items-start mb-2">
                <input type="checkbox" id="agreement" className="mt-1 mr-2" defaultChecked={true} />
                <label htmlFor="agreement" className="text-sm text-gray-600">
                  주문 내용을 확인하였으며, 결제 진행에 동의합니다. (필수)
                </label>
              </div>
            </div>

            {/* 결제하기 버튼 */}
            <Button className="w-full" size="lg" onClick={handlePlaceOrder} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  결제 처리중...
                </>
              ) : paymentMethod === "bank" ? (
                "주문하기 (무통장입금)"
              ) : (
                "결제하기"
              )}
            </Button>

            {/* 안내사항 */}
            <div className="mt-4 text-xs text-gray-500 space-y-1">
              <p>• 무이자 할부는 카드사 정책에 따라 다를 수 있습니다.</p>
              <p>• 주문 취소 및 반품은 마이페이지에서 신청 가능합니다.</p>
              <p>• 배송은 결제 완료 후 영업일 기준 1-3일 내로 출고됩니다.</p>
            </div>
          </div>
        </div>
      </div>

      {/* 무통장입금 계좌정보 다이얼로그 */}
      <Dialog open={showBankInfo} onOpenChange={setShowBankInfo}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-green-600" />
              무통장입금 계좌정보
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* 계좌 정보 */}
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-bold text-green-800 mb-4 text-center">입금 계좌 정보</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-green-200">
                  <span className="text-gray-600">은행명</span>
                  <span className="font-bold text-lg">{BANK_INFO.bankName}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-green-200">
                  <span className="text-gray-600">계좌번호</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-blue-600">{BANK_INFO.accountNumber}</span>
                    <Button size="sm" variant="outline" className="h-8 px-2" onClick={copyAccountNumber}>
                      <Copy className="h-3 w-3 mr-1" />
                      복사
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">예금주</span>
                  <span className="font-bold text-lg">{BANK_INFO.accountHolder}</span>
                </div>
              </div>
            </div>

            {/* 입금 안내사항 */}
            <div className="bg-amber-50 p-4 rounded-lg">
              <h4 className="font-medium text-amber-800 mb-2">입금 안내사항</h4>
              <div className="text-sm text-amber-700 space-y-1">
                <p>
                  • 입금 금액:{" "}
                  <span className="font-bold text-red-600">
                    {Math.floor(calculateTotalAmount()).toLocaleString()}원
                  </span>
                </p>
                <p>
                  • 입금자명: <span className="font-bold">{user?.displayName || "주문자명"}</span> (주문자명과 동일하게)
                </p>
                <p>• 입금 기한: 주문 후 24시간 이내</p>
                <p>• 입금 확인 후 상품이 발송됩니다.</p>
                <p>• 기한 내 입금이 없으면 주문이 자동 취소됩니다.</p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowBankInfo(false)}>
              취소
            </Button>
            <Button onClick={handleBankTransferOrder} className="flex-1">
              주문 확정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}