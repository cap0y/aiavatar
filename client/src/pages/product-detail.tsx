import React, { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { productAPI, cartAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Star,
  Truck,
  ShieldCheck,
  Clock,
  Package,
  Plus,
  Minus,
  ShoppingBag,
  Send,
  MessageSquare,
  Reply,
  AlertCircle,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient"; // API 요청 함수 추가
import type { ProductImage } from "@/types";
import "./product-detail.css"; // CSS 파일 임포트
import { normalizeHtmlImageSrc } from "@/lib/url";

// HTML 태그를 제거하는 함수
const stripHtml = (html: string): string => {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || "";
};

// 이미지 URL을 올바르게 처리하는 함수
const getImageUrl = (image: string | ProductImage | undefined): string => {
  if (!image) return "/images/placeholder-product.png";

  try {
    // 이미지가 배열인 경우
    if (Array.isArray(image)) {
      if (image.length > 0) {
        return getImageUrl(image[0]);
      }
      return "/images/placeholder-product.png";
    }

    // 문자열인 경우
    if (typeof image === "string") {
      // JSON 문자열인 경우 파싱
      if (image.startsWith('[') || image.startsWith('{')) {
        try {
          const parsed = JSON.parse(image);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed[0];
          } else if (parsed && typeof parsed === 'object' && 'url' in parsed) {
            return parsed.url;
          }
        } catch (e) {
          // 파싱 실패 시 원래 문자열 사용
        }
      }

      // Base64 데이터인 경우 그대로 반환
      if (image.startsWith("data:")) {
        return image;
      }

      // 이미 완전한 URL인 경우 (http:// 또는 https://)
      if (image.startsWith("http://") || image.startsWith("https://")) {
        return image;
      }

      // 상대 경로인 경우 그대로 사용
      return image;
    }

    // ProductImage 객체인 경우
    if (image && typeof image === "object" && "url" in image) {
      return getImageUrl(image.url);
    }
  } catch (e) {
    console.error("이미지 URL 처리 오류:", e);
  }

  return "/images/placeholder-product.png";
};

// 선택된 옵션 타입 정의
interface SelectedOption {
  name: string;
  value: string;
  price_adjust: number;
}

// 상품 옵션 타입 정의
interface ProductOptionValue {
  value: string;
  price_adjust: number;
}

interface ProductOption {
  id: string;
  name: string;
  values: ProductOptionValue[];
}

// 상품 타입에 인증 여부 필드 추가
interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  discountPrice?: number;
  images?: string[];
  category?: string;
  rating?: number;
  reviewCount?: number;
  stock?: number;
  isCertified?: boolean; // 판매자 인증 여부
}

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.productId;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [activeTab, setActiveTab] = useState("details");
  const [reviewText, setReviewText] = useState("");
  const [rating, setRating] = useState(5);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  // 선택된 옵션 상태 추가
  const [selectedOptions, setSelectedOptions] = useState<SelectedOption[]>([]);
  const [totalPriceWithOptions, setTotalPriceWithOptions] = useState<number>(0);
  
  // 사용자 구매 이력 확인 상태 추가
  const [hasPurchased, setHasPurchased] = useState(false);
  
  // 로그인한 사용자의 구매 이력을 확인하는 쿼리 추가 (서버 API 연동)
  const { data: purchaseHistory, isLoading: isLoadingPurchaseHistory } = useQuery({
    queryKey: ["purchase-history", productId, user?.uid],
    queryFn: async () => {
      if (!productId || !user?.uid) return null;
      
      try {
        // 사용자의 구매 이력 조회 API 호출
        const response = await fetch(`/api/users/${user.uid}/purchases`);
        
        if (!response.ok) {
          throw new Error("구매 이력 조회 실패");
        }
        
        const purchases = await response.json();
        
        // 현재 상품의 구매 이력이 있는지 확인
        const hasPurchased = purchases.some(
          (purchase: any) => purchase.productId === productId || purchase.product_id === productId
        );
        
        return { hasPurchased };
      } catch (error) {
        console.error("구매 이력 조회 실패:", error);
        return { hasPurchased: false };
      }
    },
    enabled: !!productId && !!user?.uid,
  });
  
  // 구매 이력이 조회되면 상태 업데이트
  useEffect(() => {
    if (purchaseHistory) {
      setHasPurchased(purchaseHistory.hasPurchased);
    }
  }, [purchaseHistory]);

  // 인증 상태 체크 (임시)
  const isAuthenticated = !!user;

  // 뒤로 가기 함수
  const navigate = (path: string) => {
    setLocation(path);
  };

  // 상품 정보 가져오기
  const {
    data: product,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["product", productId],
    queryFn: async () => {
      if (!productId) return null;
      const data = await productAPI.getProduct(productId);
      
      // 디버깅을 위해 상품 데이터 출력
      console.log('상품 데이터:', data);
      
      // 필드명 호환성 처리 (title -> name)
      if (data) {
        // title을 name으로 변환
        if (data.title && !data.name) {
          data.name = data.title;
        }
        
        // 할인 가격 필드 확인 (다양한 필드명 대응)
        if (!data.discount_price && data.discountPrice) {
          data.discount_price = data.discountPrice;
        }
        
        // 할인 가격이 문자열로 들어온 경우 숫자로 변환
        if (typeof data.discount_price === 'string') {
          data.discount_price = parseFloat(data.discount_price);
        }
        if (typeof data.price === 'string') {
          data.price = parseFloat(data.price);
        }
        
        // 디버깅 출력
        if (data.discount_price && data.price) {
          console.log('할인율 계산:', {
            price: data.price,
            discount_price: data.discount_price,
            discountPercent: Math.round(((data.price - data.discount_price) / data.price) * 100)
          });
        } else {
          console.log('할인 정보 없음');
        }
      }
      
      return data;
    },
    enabled: !!productId,
  });

  // 카테고리 정보 가져오기
  const { data: categories } = useQuery({
    queryKey: ["product-categories"],
    queryFn: async () => {
      try {
        const response = await productAPI.getCategories();
        if (response && response.categories && Array.isArray(response.categories)) {
          return response.categories;
        }
        return [];
      } catch (error) {
        console.error("카테고리 로드 오류:", error);
        return [];
      }
    },
  });

  // 카테고리 이름 찾기 함수
  const getCategoryName = (product: any) => {
    
    // 1. 서버에서 JOIN된 카테고리 이름이 있는 경우
    if (product.category && product.category !== null && product.category !== undefined) {
      return product.category;
    }
    
    // 2. 카테고리 ID로 카테고리 목록에서 찾기
    const categoryId = product.categoryId || product.category_id;
    
    if (categoryId && categories && Array.isArray(categories)) {
      
      const category = categories.find((cat: any) => {
        // 다양한 ID 형태 비교
        return cat.id === categoryId || 
               cat.id === Number(categoryId) || 
               String(cat.id) === String(categoryId);
      });
      
      if (category) {
        return category.name;
      }
    }
    
    // 3. 하드코딩된 카테고리 매핑 (마지막 fallback)
    const categoryMap: { [key: number]: string } = {
      1: "가공식품",
      2: "건강식품", 
      3: "농산물",
      4: "수산물",
      5: "생활용품",
      6: "디지털상품",
      7: "전자제품",
      8: "주류",
      9: "축산물",
      10: "취미/게임",
      11: "카페/베이커리",
      12: "패션",
      13: "하드웨어",
      14: "기타"
    };
    
    if (categoryId && categoryMap[Number(categoryId)]) {
      return categoryMap[Number(categoryId)];
    }
    
    return categoryId ? `카테고리 ${categoryId}` : "상품";
  };

  // 상품 리뷰 가져오기 (서버 API 연동)
  const { data: reviews = [], isLoading: isLoadingReviews } = useQuery({
    queryKey: ["product-reviews", productId],
    queryFn: async () => {
      if (!productId) return [];
      
      try {
        // 리뷰 목록 API 호출
        const response = await fetch(`/api/products/${productId}/reviews`);
        
        if (!response.ok) {
          throw new Error("리뷰 로드 실패");
        }
        
        return await response.json();
      } catch (error) {
        console.error("리뷰 로드 실패:", error);
        return [];
      }
    },
    enabled: !!productId,
  });

  // 문의 가져오기 (서버 API 연동)
  const { data: comments = [], isLoading: isLoadingComments } = useQuery({
    queryKey: ["product-comments", productId],
    queryFn: async () => {
      if (!productId) return [];
      
      try {
        // 문의 목록 API 호출
        const response = await fetch(`/api/products/${productId}/comments`);
        
        if (!response.ok) {
          throw new Error("문의 로드 실패");
        }
        
        return await response.json();
      } catch (error) {
        console.error("문의 로드 실패:", error);
        return [];
      }
    },
    enabled: !!productId,
  });

  // 문의 작성 뮤테이션 (서버 API 연동)
  const addCommentMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!productId || !user?.uid) throw new Error("상품 ID가 없거나 로그인이 필요합니다.");
      
      const response = await fetch(`/api/products/${productId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.uid,
          content: text
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "문의 등록에 실패했습니다.");
      }
      
      return await response.json();
    },
    onSuccess: (newComment) => {
      queryClient.setQueryData(
        ["product-comments", productId],
        (oldData: any[] = []) => [newComment, ...oldData]
      );
      
      setCommentText("");
      toast({
        title: "문의가 등록되었습니다",
        description: "답변이 등록되면 알려드리겠습니다.",
      });
    },
    onError: (error) => {
      toast({
        title: "문의 등록 실패",
        description: `오류가 발생했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
        variant: "destructive",
      });
    },
  });

  // 리뷰 작성 뮤테이션 (서버 API 연동 및 구매 검증 추가)
  const addReviewMutation = useMutation({
    mutationFn: async ({
      rating,
      comment,
    }: {
      rating: number;
      comment: string;
    }) => {
      if (!productId || !user?.uid) throw new Error("상품 ID가 없거나 로그인이 필요합니다.");
      
      // 구매 여부 재검증 API 호출
      const purchaseResponse = await fetch(`/api/users/${user.uid}/purchases/verify/${productId}`);
      
      if (!purchaseResponse.ok) {
        const errorData = await purchaseResponse.json();
        throw new Error(errorData.error || "구매 이력 확인에 실패했습니다.");
      }
      
      const purchaseData = await purchaseResponse.json();
      
      if (!purchaseData.verified) {
        throw new Error("구매 이력이 확인되지 않습니다. 구매 후 리뷰를 작성할 수 있습니다.");
      }
      
      // 리뷰 작성 API 호출
      const response = await fetch(`/api/products/${productId}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.uid,
          rating,
          comment
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "리뷰 등록에 실패했습니다.");
      }
      
      return await response.json();
    },
    onSuccess: (newReview) => {
      queryClient.setQueryData(
        ["product-reviews", productId],
        (oldData: any[] = []) => [newReview, ...oldData]
      );
      
      // 제품 정보 업데이트 (평점, 리뷰 수 변경됨)
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
      
      setReviewText("");
      setRating(5);
      toast({
        title: "리뷰가 등록되었습니다",
        description: "소중한 리뷰 감사합니다.",
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "리뷰 등록 실패",
        description:
          error instanceof Error
            ? error.message
            : "알 수 없는 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // 옵션 선택 핸들러
  const handleOptionChange = (
    optionName: string,
    optionValue: ProductOptionValue,
  ) => {

    // 이미 같은 이름의 옵션이 선택되어 있는지 확인
    const existingOptionIndex = selectedOptions.findIndex(
      (opt) => opt.name === optionName,
    );

    // price_adjust 값을 확실하게 숫자로 변환
    const priceAdjust = Number(optionValue.price_adjust);

    // 새 옵션 객체 생성
    const newOption: SelectedOption = {
      name: optionName,
      value: optionValue.value,
      price_adjust: isNaN(priceAdjust) ? 0 : priceAdjust,
    };

    // 선택된 옵션 업데이트
    if (existingOptionIndex >= 0) {
      // 기존 옵션 업데이트
      const updatedOptions = [...selectedOptions];
      updatedOptions[existingOptionIndex] = newOption;
      setSelectedOptions(updatedOptions);
    } else {
      // 새 옵션 추가
      setSelectedOptions([...selectedOptions, newOption]);
    }
  };

  // 총 가격 계산 (기본 가격 + 옵션 추가 가격)
  useEffect(() => {
    if (product) {
      // 강제 할인율 적용 (테스트용)
      const originalPrice = Number(product.price || 50000);
      const discountRate = 0.2; // 20% 할인
      const discountedPrice = originalPrice * (1 - discountRate);

      // 선택된 옵션의 가격 조정 합계 계산
      const optionsPrice = selectedOptions.reduce((sum, option) => {
        return sum + (option.price_adjust || 0);
      }, 0);

      // 총 가격 계산 (할인된 기본가 + 옵션) × 수량
      const totalPrice = (discountedPrice + optionsPrice) * quantity;
      
      setTotalPriceWithOptions(totalPrice);
      
      console.log('가격 계산 (강제 할인 적용):', { 
        originalPrice, 
        discountRate,
        discountedPrice,
        optionsPrice, 
        quantity,
        totalPrice 
      });
    }
  }, [product, selectedOptions, quantity]);

  // 장바구니에 상품 추가 뮤테이션
  const addToCartMutation = useMutation({
    mutationFn: async () => {
      if (!productId) throw new Error("상품 ID가 없습니다.");
      if (!user?.uid) throw new Error("로그인이 필요합니다.");

      const optionsData = selectedOptions.length > 0 ? selectedOptions : undefined;

      const result = await cartAPI.addItem(user.uid, {
        productId: productId,
        quantity: quantity,
        selected_options: optionsData,
      });
      return result;
    },
    onSuccess: (data) => {
      toast({
        title: "장바구니에 추가되었습니다",
        description: `${product?.name}이(가) 장바구니에 추가되었습니다.`,
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "장바구니 추가 실패",
        description: `오류가 발생했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
        variant: "destructive",
      });
    },
  });

  // 장바구니에 추가
  const handleAddToCart = () => {
    if (!isAuthenticated) {
      toast({
        title: "로그인이 필요합니다",
        description: "장바구니에 상품을 담으려면 로그인해주세요.",
        variant: "destructive",
      });

      // 로그인 이벤트 발생
      window.dispatchEvent(new CustomEvent("showLogin"));
      return;
    }

    addToCartMutation.mutate();
  };

  // 문의 작성 뮤테이션
  const handleAddComment = () => {
    if (!isAuthenticated) {
      toast({
        title: "로그인이 필요합니다",
        description: "문의를 작성하려면 로그인해주세요.",
        variant: "destructive",
      });

      // 로그인 이벤트 발생
      window.dispatchEvent(new CustomEvent("showLogin"));
      return;
    }

    if (!commentText.trim()) {
      toast({
        title: "문의 내용을 입력해주세요",
        variant: "destructive",
      });
      return;
    }

    addCommentMutation.mutate(commentText);
  };

  // 리뷰 작성
  const handleAddReview = () => {
    if (!isAuthenticated) {
      toast({
        title: "로그인이 필요합니다",
        description: "리뷰를 작성하려면 로그인해주세요.",
        variant: "destructive",
      });

      // 로그인 이벤트 발생
      window.dispatchEvent(new CustomEvent("showLogin"));
      return;
    }

    if (!reviewText.trim()) {
      toast({
        title: "리뷰 내용을 입력해주세요",
        variant: "destructive",
      });
      return;
    }

    addReviewMutation.mutate({ rating, comment: reviewText });
  };

  // 답글 작성 핸들러
  const handleAddReply = (commentId: string) => {
    if (!isAuthenticated) {
      toast({
        title: "로그인이 필요합니다",
        description: "댓글을 작성하려면 로그인해주세요.",
        variant: "destructive",
      });

      // 로그인 이벤트 발생
      window.dispatchEvent(new CustomEvent("showLogin"));
      return;
    }

    if (!replyText.trim()) {
      toast({
        title: "댓글 내용을 입력해주세요",
        variant: "destructive",
      });
      return;
    }

    addCommentCommentMutation.mutate({ commentId, content: replyText });
  };

  // 답글 폼 토글
  const toggleReplyForm = (commentId: string) => {
    setReplyingTo(replyingTo === commentId ? null : commentId);
    setReplyText("");
  };

  // 별점 렌더링 함수
  const renderStars = (rating: number) => {
    return Array(5)
      .fill(0)
      .map((_, index) => (
        <Star
          key={index}
          className={`h-4 w-4 ${index < rating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`}
          onClick={() => setRating(index + 1)}
        />
      ));
  };

  // 댓글에 답글 작성 뮤테이션 (서버 API 연동)
  const addCommentCommentMutation = useMutation({
    mutationFn: async ({
      commentId,
      content,
    }: {
      commentId: string;
      content: string;
    }) => {
      if (!productId || !user?.uid) throw new Error("상품 ID가 없거나 로그인이 필요합니다.");
      
      const response = await fetch(`/api/products/${productId}/comments/${commentId}/replies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.uid,
          content
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "답글 등록에 실패했습니다.");
      }
      
      return await response.json();
    },
    onSuccess: (newReply) => {
      queryClient.invalidateQueries({
        queryKey: ["product-comments", productId],
      });
      
      setReplyText("");
      setReplyingTo(null);
      toast({
        title: "답글이 등록되었습니다",
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "답글 등록 실패",
        description: `오류가 발생했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
        variant: "destructive",
      });
    },
  });

  // 수량 증가
  const increaseQuantity = () => {
    if (product && quantity < (product.stock || 10)) {
      setQuantity((prev) => prev + 1);
    } else {
      toast({
        title: "재고 부족",
        description: "더 이상 재고가 없습니다.",
        variant: "destructive",
      });
    }
  };

  // 수량 감소
  const decreaseQuantity = () => {
    if (quantity > 1) {
      setQuantity((prev) => prev - 1);
    }
  };

  // 바로 구매하기
  const handleBuyNow = () => {
    console.log("바로 구매하기 버튼 클릭됨");
    console.log("인증 상태:", isAuthenticated);
    console.log("사용자 정보:", user);
    
    if (!isAuthenticated || !user) {
      console.log("미인증 사용자, 로그인 요청");
      toast({
        title: "로그인이 필요합니다",
        description: "상품을 구매하려면 로그인해주세요.",
        variant: "destructive",
      });

      // 로그인 이벤트 발생
      window.dispatchEvent(new CustomEvent("showLogin"));
      return;
    }

    // 구매할 상품 데이터 구성
    const checkoutItem = {
      product_id: productId,
      product: {
        ...product,
        id: productId,
        name: product.name,
        price: product.price,
        discount_price: product.discountPrice || product.discount_price, // 필드명 호환성 처리
        images: product.images
      },
      quantity: quantity,
      selected_options: selectedOptions,
    };

    console.log("구매할 상품 데이터:", checkoutItem);

    // localStorage에 체크아웃 데이터 저장
    const checkoutData = {
      directCheckout: true,
      items: [checkoutItem],
      // 인증 상태 유지를 위한 사용자 정보 캐싱
      userInfo: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName
      }
    };

    console.log("localStorage에 저장할 데이터:", checkoutData);
    localStorage.setItem('checkoutData', JSON.stringify(checkoutData));

    console.log("체크아웃 페이지로 이동합니다");
    
    // 체크아웃 페이지로 이동 (navigate 함수 사용)
    navigate("/checkout");
    
    // toast 메시지는 페이지 이동 전에 표시
    toast({
      title: "결제 페이지로 이동합니다",
      description: "주문 정보를 확인하고 결제를 진행하세요.",
      variant: "default",
    });
  };

  // 다나와 최저가 검색 함수
  const handlePriceCompare = () => {
    // 제품명을 URL 인코딩
    const searchQuery = encodeURIComponent(product.name); // 상품 제목을 name으로 변경
    // 다나와 검색 URL 생성
    const danawaSearchUrl = `https://search.danawa.com/dsearch.php?k1=${searchQuery}&module=goods&act=dispMain`;
    // 새 창에서 URL 열기
    window.open(danawaSearchUrl, '_blank');
  };

  // HTML 내부의 iframe과 미디어 요소를 반응형으로 만드는 함수
  useEffect(() => {
    // 컴포넌트가 마운트되면 실행
    const makeResponsive = () => {
      // 상품 설명 컨테이너를 찾음
      const descriptionContainer = document.querySelector(
        ".product-description",
      );
      if (descriptionContainer) {
        // iframe, img, video 요소를 모두 찾아서 반응형 클래스 추가
        const mediaElements = descriptionContainer.querySelectorAll(
          "iframe, img, video, embed, object",
        );
        mediaElements.forEach((el) => {
          // 반응형 클래스 추가
          el.classList.add("responsive-media");

          // iframe인 경우 부모 div로 감싸기
          if (el.tagName.toLowerCase() === "iframe") {
            const parent = el.parentElement;
            // 이미 responsive-iframe-container로 감싸져 있지 않은 경우에만 처리
            if (
              parent &&
              !parent.classList.contains("responsive-iframe-container")
            ) {
              const wrapper = document.createElement("div");
              wrapper.className = "responsive-iframe-container";
              parent.insertBefore(wrapper, el);
              wrapper.appendChild(el);
            }
          }
        });
      }
    };

    // 상품 데이터가 로드된 후에 실행
    if (product && product.description) {
      // DOM이 완전히 업데이트된 후 실행하기 위해 setTimeout 사용
      setTimeout(makeResponsive, 100);
    }
  }, [product]);

  // 리뷰 작성 폼 수정 - 구매한 사용자만 작성 가능하도록
  const renderReviewForm = () => {
    if (!isAuthenticated) {
      return (
        <div className="bg-gray-50 p-3 sm:p-4 rounded-lg border">
          <div className="flex items-center text-sm text-gray-500 mb-2">
            <AlertCircle className="h-4 w-4 mr-2 text-amber-500" />
            리뷰를 작성하려면 로그인이 필요합니다.
          </div>
          <Button
            size="sm"
            onClick={() => window.dispatchEvent(new CustomEvent("showLogin"))}
            className="text-xs sm:text-sm py-1 px-2 sm:py-2 sm:px-4"
          >
            로그인하기
          </Button>
        </div>
      );
    }
    
    if (isLoadingPurchaseHistory) {
      return (
        <div className="bg-gray-50 p-3 sm:p-4 rounded-lg border">
          <div className="flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
            <span className="text-xs sm:text-sm text-gray-500">구매 정보를 확인 중입니다...</span>
          </div>
        </div>
      );
    }
    
    if (!hasPurchased) {
      return (
        <div className="bg-gray-50 p-3 sm:p-4 rounded-lg border">
          <div className="flex items-center text-sm text-amber-600 mb-2">
            <AlertCircle className="h-4 w-4 mr-2 text-amber-500" />
            구매한 고객만 리뷰를 작성할 수 있습니다.
          </div>
          <p className="text-xs sm:text-sm text-gray-500">
            이 상품을 구매하신 후 리뷰를 작성해주세요.
          </p>
        </div>
      );
    }
    
    return (
      <div className="bg-gray-50 p-3 sm:p-4 rounded-lg border">
        <h4 className="text-xs sm:text-sm font-medium mb-2">
          리뷰 작성
        </h4>
        <div className="flex items-center mb-2">
          <span className="text-xs sm:text-sm mr-2">평점:</span>
          <div className="flex items-center">{renderStars(rating)}</div>
        </div>
        <Textarea
          placeholder="상품에 대한 리뷰를 작성해주세요."
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          className="mb-2 text-sm"
          rows={3}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            className="text-xs sm:text-sm py-1 px-2 sm:py-2 sm:px-4"
            onClick={handleAddReview}
            disabled={addReviewMutation.isPending}
          >
            <Star className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            리뷰 작성
          </Button>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-2 text-gray-600">상품 정보를 불러오는 중...</span>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h2 className="text-2xl font-bold text-red-500 mb-4">
          상품을 불러오는데 실패했습니다
        </h2>
        <p className="text-gray-600 mb-4">
          상품 정보를 불러오는 중 오류가 발생했습니다. 다시 시도해주세요.
        </p>
        <Button onClick={() => navigate("/shop")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          쇼핑몰로 돌아가기
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-4 sm:py-8 max-w-7xl">
        {/* 상단 네비게이션 */}
        <div className="mb-4 sm:mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/shop")}
            className="mb-2 sm:mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            쇼핑몰로 돌아가기
          </Button>

          <div className="text-xs sm:text-sm text-gray-500 mb-2">
            홈 &gt; 쇼핑몰 &gt; {getCategoryName(product)} &gt; {product.name}
          </div>
        </div>

        {/* 상품 상세 정보 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
          {/* 상품 이미지 */}
          <div className="bg-white rounded-lg overflow-hidden shadow-md">
            <div className="h-64 sm:h-80 md:h-96 bg-gray-100 relative">
              {/* 할인율 표시 배지 - 항상 표시 (테스트용) */}
              <div className="absolute left-4 top-8 bg-red-500 text-white px-2 py-1 font-bold rounded-r-md shadow-md z-10">
                20% 할인
              </div>
              
              {/* 인증 마크 추가 - 조건부 표시 */}
              {product.isCertified && (
                <div className="absolute right-4 top-8">
                  <div className="w-20 h-20 rounded-lg bg-white shadow-md border-2 border-sky-300 flex items-center justify-center p-0">
                    <img 
                      src="/images/certify.png"
                      alt="인증 마크" 
                      className="w-20 h-20"
                      title="인증된 판매자 상품"
                    />
                  </div>
                </div>
              )}
            
              {product.images && product.images.length > 0 ? (
                <div className="w-full h-full">
                  <img
                    src={getImageUrl(product.images[selectedImageIndex])}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                  이미지 없음
                </div>
              )}
            </div>

            {/* 추가 이미지 썸네일 */}
            {product.images && product.images.length > 0 && (
              <div className="flex overflow-x-auto p-2 gap-2 scrollbar-thin scrollbar-thumb-gray-300">
                {product.images.map(
                  (image: string | ProductImage, index: number) => (
                    <div
                      key={index}
                      className={`w-12 sm:w-16 h-12 sm:h-16 flex-shrink-0 border rounded cursor-pointer hover:border-blue-500 ${
                        selectedImageIndex === index
                          ? "border-blue-500 border-2"
                          : ""
                      }`}
                      onClick={() => setSelectedImageIndex(index)}
                    >
                      <img
                        src={getImageUrl(image)}
                        alt={`${product.name} 이미지 ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ),
                )}
              </div>
            )}
          </div>

          {/* 상품 정보 */}
          <div>
            <div className="mb-4 sm:mb-6">
              <div className="flex items-center flex-wrap gap-2 mb-2">
                <Badge variant="outline" className="text-xs sm:text-sm">
                  {getCategoryName(product)}
                </Badge>
                {product.rating !== undefined && (
                  <div className="flex items-center text-yellow-500">
                    <Star className="h-3 w-3 sm:h-4 sm:w-4 fill-yellow-500" />
                    <span className="ml-1 text-xs sm:text-sm">
                      {typeof product.rating === "number"
                        ? product.rating.toFixed(1)
                        : product.rating}
                    </span>
                    <span className="text-gray-500 ml-1 text-xs sm:text-sm">
                      ({product.reviewCount || 0})
                    </span>
                  </div>
                )}
              </div>

              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 break-words">
                {product.name}
              </h1>

              <div className="mb-3 sm:mb-4">
                {/* 강제로 할인 정보 표시 (테스트용) */}
                <div className="flex items-center mb-1">
                  <span className="text-gray-400 line-through text-sm sm:text-lg mr-2">
                    {Math.floor(product.price || 50000).toLocaleString()}원
                  </span>
                  <Badge className="bg-red-500 text-xs">
                    20% 할인
                  </Badge>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-red-600">
                  {Math.floor((product.price || 50000) * 0.8).toLocaleString()}원
                </p>
              </div>

              <div className="space-y-2 sm:space-y-4 mb-4 sm:mb-6">
                <div className="flex items-center text-xs sm:text-sm">
                  <Truck className="h-3 w-3 sm:h-4 sm:w-4 mr-2 text-blue-500" />
                  <span>{totalPriceWithOptions < 30000 ? 
                    '3,000원 배송비 (3만원 이상 구매시 무료배송)' : 
                    '무료배송 (3만원 이상 구매시)'}
                  </span>
                </div>
                <div className="flex items-center text-xs sm:text-sm">
                  <ShieldCheck className="h-3 w-3 sm:h-4 sm:w-4 mr-2 text-green-500" />
                  <span>안전결제 보장</span>
                </div>
                <div className="flex items-center text-xs sm:text-sm">
                  <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-2 text-amber-500" />
                  <span>평균 배송일: 1-3일</span>
                </div>
                <div className="flex items-center text-xs sm:text-sm">
                  <Package className="h-3 w-3 sm:h-4 sm:w-4 mr-2 text-purple-500" />
                  <span>재고: {product.stock || "정보 없음"}</span>
                </div>
              </div>

              {/* 옵션 선택 UI */}
              {product.options && product.options.length > 0 && (
                <div className="mb-4 sm:mb-6 space-y-3">
                  <h3 className="font-medium text-sm sm:text-base text-gray-700">
                    옵션 선택
                  </h3>
                  {product.options.map((option: ProductOption, index: number) => {
                    // 옵션 값이 문자열인 경우 안전하게 JSON으로 파싱
                    let optionValues = option.values;

                    if (typeof option.values === "string") {
                      try {
                        optionValues = JSON.parse(option.values);
                      } catch (e) {
                        // 파싱 실패 시 빈 배열 대신 기본값으로 설정
                        optionValues = [{ value: "옵션 없음", price_adjust: 0 }];
                      }
                    }

                    // 값이 없거나 배열이 아닌 경우 기본값 설정
                    if (
                      !optionValues ||
                      !Array.isArray(optionValues) ||
                      optionValues.length === 0
                    ) {
                      optionValues = [{ value: "옵션 없음", price_adjust: 0 }];
                    }

                    return (
                      <div key={index} className="space-y-2">
                        <label className="block text-sm text-gray-600">
                          {option.name}
                        </label>
                        <select
                          className="w-full border rounded-md p-2 text-sm"
                          onChange={(e) => {
                            // 선택된 옵션 값 찾기
                            let values = optionValues;

                            if (!Array.isArray(values)) {
                              values = [{ value: "옵션 없음", price_adjust: 0 }];
                            }

                            const selectedValue = values.find(
                              (v: ProductOptionValue) =>
                                v.value === e.target.value,
                            );

                            if (selectedValue) {
                              handleOptionChange(option.name, selectedValue);
                            }
                          }}
                          defaultValue=""
                        >
                          <option value="" disabled>
                            옵션을 선택하세요
                          </option>
                          {Array.isArray(optionValues) &&
                            optionValues.map(
                              (val: ProductOptionValue, i: number) => {
                                // price_adjust 값을 확실하게 숫자로 처리
                                const priceAdjust = Number(val.price_adjust);
                                const adjustAmount = isNaN(priceAdjust)
                                  ? 0
                                  : priceAdjust;

                                return (
                                  <option key={i} value={val.value}>
                                    {val.value}{" "}
                                    {adjustAmount > 0
                                      ? `(+${Math.floor(adjustAmount).toLocaleString()}원)`
                                      : ""}
                                  </option>
                                );
                              },
                            )}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 선택된 옵션 표시 */}
              {selectedOptions.length > 0 && (
                <div className="mb-4 sm:mb-6 border-t border-b py-3">
                  <h3 className="font-medium text-sm sm:text-base text-gray-700 mb-2">
                    선택된 옵션
                  </h3>
                  <div className="space-y-2">
                    {selectedOptions.map((opt, index) => (
                      <div
                        key={index}
                        className="flex justify-between text-xs sm:text-sm"
                      >
                        <span className="break-words max-w-[70%]">
                          {opt.name}: {opt.value}
                        </span>
                        {opt.price_adjust > 0 && (
                          <span className="text-blue-600">
                            +{Math.floor(opt.price_adjust).toLocaleString()}원
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 수량 선택 */}
              <div className="flex items-center mb-4 sm:mb-6">
                <span className="text-xs sm:text-sm text-gray-700 mr-4">
                  수량:
                </span>
                <div className="flex items-center border rounded-md">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 sm:h-8 sm:w-8"
                    onClick={decreaseQuantity}
                  >
                    <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                  <span className="w-8 sm:w-12 text-center text-sm">
                    {quantity}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 sm:h-8 sm:w-8"
                    onClick={increaseQuantity}
                  >
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>

              {/* 총 가격 */}
              <div className="mb-4 sm:mb-6 bg-gray-50 p-3 rounded-lg border">
                <p className="text-base sm:text-lg font-semibold flex justify-between items-center">
                  <span>총 상품 금액:</span>
                  <span className="text-blue-600">
                    {Math.floor(totalPriceWithOptions).toLocaleString()}원
                  </span>
                </p>
                
                {/* 배송비 정보 추가 */}
                <p className="text-xs sm:text-sm text-gray-700 flex justify-between items-center mt-1">
                  <span>배송비:</span>
                  <span>
                    {totalPriceWithOptions < 30000 ? 
                      '3,000원 (3만원 이상 구매 시 무료)' : 
                      '무료 배송'}
                  </span>
                </p>
                
                {/* 총 결제 금액 */}
                <p className="text-base sm:text-lg font-bold flex justify-between items-center mt-2 pt-2 border-t border-gray-200">
                  <span>총 결제 금액:</span>
                  <span className="text-red-600">
                    {Math.floor(totalPriceWithOptions < 30000 ? 
                      totalPriceWithOptions + 3000 : 
                      totalPriceWithOptions).toLocaleString()}원
                  </span>
                </p>
                
                {/* 강제로 할인 정보 표시 (테스트용) */}
                <p className="text-xs sm:text-sm text-red-500 flex justify-between items-center mt-1">
                  <span>할인 적용:</span>
                  <span>20% 할인</span>
                </p>
                
                {selectedOptions.length > 0 && (
                  <p className="text-xs sm:text-sm text-gray-500 mt-1 flex justify-between items-center">
                    <span>상세 내역:</span>
                    <span>
                      기본가 {Math.floor((product.price || 50000) * 0.8).toLocaleString()}원
                      {selectedOptions.reduce((sum, opt) => sum + opt.price_adjust, 0) > 0 && 
                        ` + 옵션가 ${selectedOptions.reduce((sum, opt) => sum + opt.price_adjust, 0).toLocaleString()}원`
                      } × {quantity}개
                    </span>
                  </p>
                )}
              </div>

              {/* 구매 버튼 */}
              <div className="flex gap-2 sm:gap-4">
                <Button
                  variant="outline"
                  className="flex-1 text-xs sm:text-sm py-1 sm:py-2"
                  onClick={handlePriceCompare}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  인터넷 최저가
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-xs sm:text-sm py-1 sm:py-2"
                  onClick={handleAddToCart}
                  disabled={addToCartMutation.isPending}
                >
                  <ShoppingBag className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  장바구니 담기
                </Button>
                <Button
                  className="flex-1 text-xs sm:text-sm py-1 sm:py-2"
                  onClick={handleBuyNow}
                >
                  바로 구매하기
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* 상품 상세 정보 탭 */}
        <div className="mt-8 sm:mt-12">
          <Tabs
            defaultValue="details"
            value={activeTab}
            onValueChange={setActiveTab}
          >
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
              <TabsTrigger value="details" className="text-xs sm:text-sm">
                상세 정보
              </TabsTrigger>
              <TabsTrigger value="reviews" className="text-xs sm:text-sm">
                리뷰
              </TabsTrigger>
              <TabsTrigger value="inquiries" className="text-xs sm:text-sm">
                문의하기
              </TabsTrigger>
              <TabsTrigger value="policy" className="text-xs sm:text-sm">
                판매 규정
              </TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="py-4 sm:py-6 px-4 sm:px-20">
              <div className="prose max-w-none prose-sm sm:prose-base">
                <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4" style={{ color: '#000000' }}>
                  상품 상세 정보
                </h3>
                <div
                  className="product-description text-sm sm:text-base overflow-hidden w-full"
                  dangerouslySetInnerHTML={{
                    __html: normalizeHtmlImageSrc(product.description || "상세 정보가 없습니다."),
                  }}
                />
              </div>
            </TabsContent>
            <TabsContent value="reviews" className="py-4 sm:py-6 px-4 sm:px-16">
              <div className="space-y-4 sm:space-y-6">
                <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">
                  상품 리뷰
                </h3>

                {/* 수정된 리뷰 작성 폼 */}
                {renderReviewForm()}

                {/* 리뷰 목록 */}
                <div className="space-y-3 sm:space-y-4">
                  {isLoadingReviews ? (
                    <div className="text-center py-4">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                      <p className="text-xs sm:text-sm text-gray-500 mt-2">
                        리뷰를 불러오는 중...
                      </p>
                    </div>
                  ) : reviews.length > 0 ? (
                    reviews.map((review: any) => (
                      <div
                        key={review.id}
                        className="bg-white p-3 sm:p-4 rounded-lg border"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Avatar className="h-6 w-6 sm:h-8 sm:w-8">
                            <AvatarFallback>
                              {review.username?.[0] || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-xs sm:text-sm font-medium">
                              {review.display_name || review.username}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(review.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="ml-auto flex">
                            {Array(5)
                              .fill(0)
                              .map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-3 w-3 sm:h-4 sm:w-4 ${i < review.rating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`}
                                />
                              ))}
                          </div>
                        </div>
                        <p className="text-xs sm:text-sm break-words">
                          {review.comment}
                        </p>
                        {/* 구매 확인 배지 추가 */}
                        <div className="mt-2">
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-800 border-green-200">
                            <ShoppingBag className="h-2 w-2 mr-1" />
                            구매 확인
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 sm:py-8 text-xs sm:text-sm text-gray-500">
                      아직 리뷰가 없습니다.
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="inquiries" className="py-4 sm:py-6 px-4 sm:px-6">
              <div className="space-y-4 sm:space-y-6">
                <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">
                  상품 문의
                </h3>

                {/* 문의 작성 폼 */}
                <div className="bg-gray-50 p-3 sm:p-4 rounded-lg border">
                  <h4 className="text-xs sm:text-sm font-medium mb-2">
                    문의 작성
                  </h4>
                  <Textarea
                    placeholder="상품에 대해 궁금한 점을 작성해주세요."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="mb-2 text-sm"
                    rows={3}
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      className="text-xs sm:text-sm py-1 px-2 sm:py-2 sm:px-4"
                      onClick={handleAddComment}
                      disabled={addCommentMutation.isPending}
                    >
                      <Send className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      문의하기
                    </Button>
                  </div>
                </div>

                {/* 문의 목록 */}
                <div className="space-y-3 sm:space-y-4">
                  {isLoadingComments ? (
                    <div className="text-center py-4">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                      <p className="text-xs sm:text-sm text-gray-500 mt-2">
                        문의 내용을 불러오는 중...
                      </p>
                    </div>
                  ) : comments.length > 0 ? (
                    comments.map((comment: any) => (
                      <div
                        key={comment.id}
                        className="bg-white p-3 sm:p-4 rounded-lg border"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Avatar className="h-6 w-6 sm:h-8 sm:w-8">
                            <AvatarFallback>
                              {comment.username?.[0] || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm font-medium truncate">
                              {comment.display_name || comment.username}
                              {comment.role === "admin" && (
                                <Badge className="ml-1 bg-red-500 text-xs">
                                  관리자
                                </Badge>
                              )}
                              {comment.role === "seller" && (
                                <Badge className="ml-1 bg-blue-500 text-xs">
                                  판매자
                                </Badge>
                              )}
                            </p>
                            <p className="text-xs text-gray-500">
                              {comment.createdAt || comment.created_at ? 
                                new Date(comment.createdAt || comment.created_at).toLocaleDateString() : 
                                ""}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 sm:h-8 px-1 sm:px-2"
                            onClick={() => toggleReplyForm(comment.id)}
                          >
                            <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            <span className="text-xs">댓글</span>
                          </Button>
                        </div>
                        <p className="text-xs sm:text-sm mb-2 break-words">
                          {comment.content}
                        </p>

                        {/* 답글 작성 폼 */}
                        {replyingTo === comment.id && (
                          <div className="mt-2 ml-4 sm:ml-6 border-l-2 border-gray-200 pl-2 sm:pl-4">
                            <div className="bg-gray-50 p-2 sm:p-3 rounded-md">
                              <Textarea
                                placeholder="댓글을 작성해주세요."
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                className="mb-2 text-xs sm:text-sm"
                                rows={2}
                              />
                              <div className="flex justify-end gap-1 sm:gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs py-0.5 px-2 h-6 sm:h-8 sm:text-sm"
                                  onClick={() => setReplyingTo(null)}
                                >
                                  취소
                                </Button>
                                <Button
                                  size="sm"
                                  className="text-xs py-0.5 px-2 h-6 sm:h-8 sm:text-sm"
                                  onClick={() => handleAddReply(comment.id)}
                                  disabled={addCommentCommentMutation.isPending}
                                >
                                  <Reply className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                                  댓글 작성
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 답글 목록 */}
                        {comment.replies && comment.replies.length > 0 && (
                          <div className="mt-2 ml-4 sm:ml-6 border-l-2 border-gray-200 pl-2 sm:pl-4 space-y-2 sm:space-y-3">
                            {comment.replies.map((reply: any) => (
                              <div
                                key={reply.id}
                                className="bg-gray-50 p-2 sm:p-3 rounded-md"
                              >
                                <div className="flex items-center gap-1 sm:gap-2 mb-1">
                                  <Avatar className="h-5 w-5 sm:h-6 sm:w-6">
                                    <AvatarFallback>
                                      {reply.username?.[0] || "A"}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium truncate">
                                      {reply.display_name || reply.username}
                                      {reply.is_answer && (
                                        <Badge className="ml-1 bg-green-500 text-xs">
                                          답변
                                        </Badge>
                                      )}
                                      {!reply.is_answer &&
                                        reply.role === "admin" && (
                                          <Badge className="ml-1 bg-red-500 text-xs">
                                            관리자
                                          </Badge>
                                        )}
                                      {!reply.is_answer &&
                                        reply.role === "seller" && (
                                          <Badge className="ml-1 bg-blue-500 text-xs">
                                            판매자
                                          </Badge>
                                        )}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {reply.createdAt || reply.created_at ? 
                                        new Date(reply.createdAt || reply.created_at).toLocaleDateString() : 
                                        ""}
                                    </p>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 sm:h-6 px-1"
                                    onClick={() => toggleReplyForm(comment.id)}
                                  >
                                    <MessageSquare className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                    <span className="text-xs sr-only sm:not-sr-only sm:ml-1">
                                      댓글
                                    </span>
                                  </Button>
                                </div>
                                <p className="text-xs sm:text-sm break-words">
                                  {reply.content}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 sm:py-8 text-xs sm:text-sm text-gray-500">
                      아직 문의가 없습니다.
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* 판매 규정 탭 */}
            <TabsContent value="policy" className="py-4 sm:py-6 px-4 sm:px-6">
              <div className="space-y-4 sm:space-y-6">
                <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">
                  상품 판매 및 배송 규정
                </h3>

                <div className="bg-white p-3 sm:p-6 rounded-lg border space-y-4 sm:space-y-6">
                  {/* 주문 및 결제 */}
                  <div>
                    <h4 className="text-base sm:text-lg font-semibold mb-2 text-blue-700">
                      주문 및 결제
                    </h4>
                    <div className="text-xs sm:text-sm space-y-1 sm:space-y-2">
                      <p>
                        1. 상품 주문은 온라인으로 24시간 가능하며, 결제완료 기준으로 주문이 확정됩니다.
                      </p>
                      <p>
                        2. 결제 방법: 신용카드, 체크카드, 무통장입금, 휴대폰 결제, 간편결제 서비스 등을 지원합니다.
                      </p>
                      <p>
                        3. 무통장입금의 경우 주문일로부터 3일 이내에 입금이 확인되지 않으면 자동으로 주문이 취소될 수 있습니다.
                      </p>
                      <p>
                        4. 주문 확인 후 재고 부족 등의 사유로 배송이 어려운 경우, 고객에게 별도 연락드립니다.
                      </p>
                    </div>
                  </div>

                  {/* 배송 정책 */}
                  <div>
                    <h4 className="text-base sm:text-lg font-semibold mb-2 text-blue-700">
                      배송 정책
                    </h4>
                    <div className="text-xs sm:text-sm space-y-1 sm:space-y-2">
                      <p>
                        1. 배송비: 3만원 이상 구매시 무료배송이며, 미만인 경우 2,500원의 배송비가 부과됩니다.
                      </p>
                      <p>
                        2. 배송 기간: 결제 확인 후 1-3일 이내 출고되며, 택배사 사정에 따라 1-2일 내에 배송 완료됩니다.
                      </p>
                      <p>
                        3. 일부 도서산간 지역은 배송이 지연되거나 추가 배송비가 발생할 수 있습니다.
                      </p>
                      <p>
                        4. 배송 조회는 마이페이지 &gt; 주문/배송조회 메뉴에서 확인 가능합니다.
                      </p>
                      <p>
                        5. 주문량 급증, 천재지변, 물류 파업 등의 사유 발생 시 배송이 지연될 수 있습니다.
                      </p>
                    </div>
                  </div>

                  {/* 교환/반품/환불 정책 */}
                  <div>
                    <h4 className="text-base sm:text-lg font-semibold mb-2 text-blue-700">
                      교환/반품/환불 정책
                    </h4>
                    <div className="text-xs sm:text-sm space-y-1 sm:space-y-2">
                      <p>
                        1. 단순 변심에 의한 교환/반품은 상품 수령일로부터 7일 이내에 신청 가능합니다.
                      </p>
                      <p>
                        2. 상품 불량, 오배송의 경우 수령일로부터 30일 이내 교환/반품 신청이 가능합니다.
                      </p>
                      <p>
                        3. 단순 변심으로 인한 반품 시 왕복 배송비는 고객 부담입니다.
                      </p>
                      <p>
                        4. 다음의 경우 교환/반품이 제한될 수 있습니다:
                      </p>
                      <ul className="list-disc pl-4 sm:pl-5 space-y-1">
                        <li>포장을 개봉하여 사용하거나 훼손한 경우</li>
                        <li>고객의 책임으로 상품이 훼손된 경우</li>
                        <li>시간 경과로 인해 재판매가 어려운 경우</li>
                        <li>정품 구성품이 누락된 경우 (박스, 사은품, 매뉴얼 등)</li>
                        <li>맞춤제작 상품 등 특별 주문 상품인 경우</li>
                      </ul>
                      <p>
                        5. 환불은 결제 수단에 따라 3-7일 이내에 처리됩니다.
                      </p>
                    </div>
                  </div>

                  {/* A/S 정책 */}
                  <div>
                    <h4 className="text-base sm:text-lg font-semibold mb-2 text-blue-700">
                      A/S 정책
                    </h4>
                    <div className="text-xs sm:text-sm space-y-1 sm:space-y-2">
                      <p>
                        1. 제조사의 A/S 정책을 따르며, 구체적인 보증 기간은 상품별로 상이합니다.
                      </p>
                      <p>
                        2. 정품 구매 영수증, 보증서는 A/S를 위해 잘 보관해주시기 바랍니다.
                      </p>
                      <p>
                        3. 소비자 과실로 인한 상품 훼손 시 유상 수리가 진행됩니다.
                      </p>
                      <p>
                        4. A/S 문의는 고객센터(1234-5678) 또는 홈페이지 고객센터를 통해 접수 가능합니다.
                      </p>
                    </div>
                  </div>

                  {/* 개인정보 보호 */}
                  <div>
                    <h4 className="text-base sm:text-lg font-semibold mb-2 text-blue-700">
                      개인정보 보호
                    </h4>
                    <div className="text-xs sm:text-sm space-y-1 sm:space-y-2">
                      <p>
                        1. 주문 및 배송 과정에서 수집된 개인정보는 상품 배송 및 고객 지원 목적으로만 사용됩니다.
                      </p>
                      <p>
                        2. 개인정보는 관계 법령에 의해 요구되는 기간 동안만 보관되며, 그 이후는 안전하게 폐기됩니다.
                      </p>
                      <p>
                        3. 당사는 고객 동의 없이 개인정보를 제3자에게 제공하지 않습니다.
                      </p>
                      <p>
                        4. 개인정보 관련 자세한 내용은 '개인정보 처리방침'을 참조하시기 바랍니다.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-3 sm:p-4 rounded-lg border mt-4 sm:mt-6">
                  <p className="text-xs sm:text-sm text-gray-600">
                    위 판매 규정은 일반적인 상품에 적용되는 기본 규정이며, 상품 유형에 따라 추가 규정이 적용될 수 있습니다.
                    각 상품별 상세한 배송 및 AS 정책은 상품 상세페이지를 참고하시거나 고객센터로 문의해주시기 바랍니다.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
} 