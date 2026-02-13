import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Search, Filter, ArrowUpDown } from "lucide-react";
import { productAPI } from "@/lib/api";
import BottomNavigation from "@/components/bottom-navigation";

// 상품 타입에 인증 여부 필드 추가
interface Product {
  id: string;
  title: string;
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

// HTML 태그를 제거하는 함수
const stripHtml = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || "";
};

// 이미지 URL 처리 함수
const getImageUrl = (image: any): string => {
  try {
    // 이미지가 없는 경우 첫 번째 기본 이미지 반환
    if (!image) return "/images/2dmodel/1.png";
    
    // 이미지가 문자열인 경우
    if (typeof image === 'string') {
      // JSON 문자열인지 확인하고 파싱 시도
      if (image.startsWith('[') || image.startsWith('{')) {
        try {
          const parsed = JSON.parse(image);
          
          // 배열인 경우 첫 번째 이미지 사용
          if (Array.isArray(parsed) && parsed.length > 0) {
            return getImageUrl(parsed[0]);
          }
          
          // 객체인 경우 url, src, path 속성 확인
          if (parsed && typeof parsed === 'object') {
            if (parsed.url) return parsed.url;
            if (parsed.src) return parsed.src;
            if (parsed.path) return parsed.path;
            if (parsed.image) return parsed.image;
          }
        } catch (e) {
          // JSON 파싱 실패 시 원래 문자열 사용
        }
      }
      
      // 단순 파일명인 경우 경로 추가
      if (!image.includes('/') && !image.startsWith('http')) {
        return `/images/2dmodel/${image}`;
      }
      
      return image;
    }
    
    // 이미지가 배열인 경우 첫 번째 이미지 사용
    if (Array.isArray(image) && image.length > 0) {
      return getImageUrl(image[0]);
    }
    
    // 이미지가 객체인 경우
    if (image && typeof image === 'object') {
      if (image.url) return image.url;
      if (image.src) return image.src;
      if (image.path) return image.path;
      if (image.image) return image.image;
    }
    
    // 기본 이미지 (실제 존재하는 이미지)
    return "/images/2dmodel/1.png";
  } catch (error) {
    console.warn("이미지 URL 처리 오류, 기본 이미지 사용:", error);
    return "/images/2dmodel/1.png";
  }
};

// 상품 카테고리 목록 - 실제 데이터베이스와 동일하게 유지
const DEFAULT_CATEGORIES = [
  "전체",
  "애니메이션 스타일",
  "사실적 스타일", 
  "카툰 스타일",
  "픽셀 스타일",
  "동물 캐릭터",
  "판타지 캐릭터",
  "게임 캐릭터",
  "커스텀 캐릭터",
  "기타"
];

// 카테고리 하드코딩 매핑 (fallback용) - AI 아바타 세상 카테고리
const getCategoryName = (product: Product): string => {
  // 1. 서버에서 JOIN된 카테고리 이름 우선 사용
  if ((product as any).category && (product as any).category !== null) {
    return (product as any).category;
  }

  // 2. 실제 데이터베이스 구조에 맞는 카테고리 매핑
  const categoryMap: { [key: number]: string } = {
    1: "애니메이션 스타일",
    2: "사실적 스타일", 
    3: "카툰 스타일",
    4: "픽셀 스타일",
    5: "동물 캐릭터",
    6: "판타지 캐릭터",
    7: "게임 캐릭터",
    8: "커스텀 캐릭터",
    9: "기타"
  };

  // 3. categoryId로 매핑
  const categoryId =
    (product as any).categoryId || (product as any).category_id;
  if (categoryId && categoryMap[Number(categoryId)]) {
    return categoryMap[Number(categoryId)];
  }

  // 4. 기본값
  return categoryId ? `아바타 ${categoryId}` : "기타";
};

interface ShopPageProps {
  onProductClick?: (productId: string) => void;
  initialCategory?: string;
}

export default function ShopPage({ onProductClick, initialCategory }: ShopPageProps) {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(initialCategory || "전체");
  const [sortBy, setSortBy] = useState<
    "latest" | "price_asc" | "price_desc" | "popular"
  >("latest");
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // 카테고리 변경 핸들러 (디버깅 로그 추가)
  const handleCategoryChange = (category: string) => {
    console.log("카테고리 변경:", selectedCategory, "→", category);
    setSelectedCategory(category);
    setShowCategoryDropdown(false);
  };

  // 카테고리 목록 가져오기
  const { data: categoriesData } = useQuery({
    queryKey: ["product-categories"],
    queryFn: async () => {
      try {
        const response = await productAPI.getCategories();
        // 카테고리 데이터가 있으면 사용, 없으면 기본 카테고리 사용
        if (
          response &&
          response.categories &&
          Array.isArray(response.categories)
        ) {
          // 카테고리 객체에서 name 속성 추출
          const categoryNames = response.categories.map((cat: any) => {
            // cat이 객체인 경우 name 속성 사용, 문자열인 경우 그대로 사용
            return typeof cat === "object" && cat !== null
              ? cat.name || "기타"
              : cat;
          });

          // "전체"가 이미 포함되어 있는지 확인하고, 없으면 추가
          if (!categoryNames.includes("전체")) {
            return ["전체", ...categoryNames];
          }
          return categoryNames;
        }
        return DEFAULT_CATEGORIES; // 오류 시 기본 카테고리 사용
      } catch (error) {
        console.error("카테고리 로드 오류:", error);
        return DEFAULT_CATEGORIES; // 오류 시 기본 카테고리 사용
      }
    },
  });

  // 실제 카테고리 목록 사용
  const categories = categoriesData || DEFAULT_CATEGORIES;

  // API 파라미터 생성
  const getQueryParams = () => {
    console.log("현재 selectedCategory:", selectedCategory);

    const params: any = {
      sort:
        sortBy === "latest"
          ? "created_at"
          : sortBy === "price_asc"
            ? "price"
            : sortBy === "price_desc"
              ? "price"
              : "rating",
      order: sortBy === "price_asc" ? "asc" : "desc",
      limit: 20,
      offset: 0,
    };

    if (selectedCategory !== "전체") {
      console.log("카테고리 필터 적용:", selectedCategory);
      // 카테고리 이름을 직접 서버로 전송
      params.category = selectedCategory;
    } else {
      console.log("전체 카테고리 선택됨 - 필터 없음");
    }

    if (searchTerm) {
      params.search = searchTerm;
    }

    console.log("최종 API 파라미터:", params);
    return params;
  };

  // 상품 데이터 가져오기
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["products", selectedCategory, sortBy, searchTerm],
    queryFn: async () => {
      console.log("상품 데이터 요청 시작:", getQueryParams());
      const response = await productAPI.getProducts(getQueryParams());
      console.log("상품 API 응답:", response);

      // 응답이 배열인 경우 (API가 상품 목록을 직접 반환)
      if (Array.isArray(response)) {
        console.log("서버에서 상품 데이터 받음:", response.length);
        return response;
      }
      // 응답이 객체인 경우 (API가 { products: [...] } 형태로 반환)
      else if (response && response.products && Array.isArray(response.products)) {
        console.log("서버에서 상품 데이터 받음 (객체):", response.products.length);
        return response.products;
      }
      
      // 데이터가 없으면 빈 배열 반환
      console.log("서버 데이터가 비어있음");
      return [];
    },
  });

  // 상품 클릭 핸들러
  const handleProductClick = (product: Product) => {
    console.log("상품 클릭:", product.id);
    
    // 1. 부모 컴포넌트에서 전달받은 핸들러가 있으면 사용 (Discord 레이아웃 내에서)
    if (onProductClick) {
      onProductClick(product.id);
      return;
    }
    
    // 2. 직접 페이지 이동 (헤더 + 사이드바 + 네비게이션 모두 포함)
    setLocation(`/product/${product.id}`);
  };

  // 검색이나 필터 변경 시 상품 목록 갱신
  useEffect(() => {
    refetch();
  }, [selectedCategory, sortBy, searchTerm, refetch]);

  return (
    <div className="h-full bg-white dark:bg-[#030303] text-gray-900 dark:text-white overflow-y-auto transition-colors">
      <div className="container mx-auto px-3 py-4 pb-24">
        {/* 헤더 영역 */}
        <div className="mb-4">
          {/* 상점 타이틀 */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
              <ShoppingBag className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">AI 아바타 쇼핑몰</h1>
          </div>
          
          {/* 설명 텍스트 */}
          <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm">
            당신만의 AI 아바타를 만나보세요. 다양한 스타일의 고품질 아바타를 제공합니다.
          </p>
          
          {/* 검색창과 필터 버튼들 */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 h-4 w-4" />
              <Input
                placeholder="상품명, 태그 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 bg-white dark:bg-[#1A1A1B] border-gray-300 dark:border-[#272729] text-gray-900 dark:text-white placeholder-gray-400 rounded-lg"
              />
            </div>
            <Button
              variant="default"
              size="sm"
              className="flex items-center gap-1 bg-gray-200 dark:bg-[#1A1A1B] border-gray-300 dark:border-[#272729] text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-[#272729] px-3"
            >
              <Filter className="h-4 w-4" />
              전체
            </Button>
            <Button
              variant="default"
              size="sm"
              className="flex items-center gap-1 bg-gray-200 dark:bg-[#1A1A1B] border-gray-300 dark:border-[#272729] text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-[#272729] px-3"
              onClick={() =>
                setSortBy(
                  sortBy === "latest"
                    ? "price_asc"
                    : sortBy === "price_asc"
                      ? "price_desc"
                      : "latest",
                )
              }
            >
              <ArrowUpDown className="h-4 w-4" />
              {sortBy === "latest"
                ? "최신순"
                : sortBy === "price_asc"
                  ? "가격낮은순"
                  : "가격높은순"}
            </Button>
          </div>
        </div>

        {/* 카테고리 태그들 */}
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {categories.map((category: string) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  selectedCategory === category
                    ? "bg-purple-600 text-white hover:bg-purple-700 border-purple-600"
                    : "bg-gray-200 dark:bg-[#1A1A1B] border-gray-300 dark:border-[#272729] text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-[#272729] hover:text-gray-900 dark:hover:text-white"
                }`}
                onClick={() => handleCategoryChange(category)}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* 상품 목록 */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="bg-gray-200 dark:bg-[#1A1A1B] rounded-lg p-3 animate-pulse"
              >
                <div className="bg-gray-300 dark:bg-[#272729] h-40 rounded mb-3"></div>
                <div className="bg-gray-300 dark:bg-[#272729] h-3 rounded mb-2"></div>
                <div className="bg-gray-300 dark:bg-[#272729] h-3 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-400">상품을 불러오는 중 오류가 발생했습니다.</p>
            <Button
              onClick={() => refetch()}
              className="mt-3 bg-blue-600 hover:bg-blue-700 text-white"
            >
              다시 시도
            </Button>
          </div>
        ) : !data || data.length === 0 ? (
          <div className="text-center py-8">
            <ShoppingBag className="h-12 w-12 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-400 text-lg">해당 카테고리에 상품이 없습니다.</p>
            <p className="text-gray-500 mt-1">다른 카테고리를 선택해보세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {data.map((product: Product, index: number) => (
              <div
                key={`${product.id}-${index}`}
                className="bg-white dark:bg-[#0B0B0B] rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-200 dark:border-[#1A1A1B] hover:border-gray-300 dark:hover:border-[#272729]"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("상품 카드 클릭:", product.id);
                  handleProductClick(product);
                }}
              >
                {/* 상품 이미지 */}
                <div className="relative">
                  <img
                    src={getImageUrl(product.images)}
                    alt={product.title}
                    className="w-full h-40 object-cover rounded-t-lg"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      // 이미 placeholder 이미지인 경우 무한 루프 방지
                      if (target.src.includes('placeholder-product.png')) {
                        console.warn("Placeholder 이미지도 로드 실패:", product.title);
                        // 기본 회색 배경으로 대체
                        target.style.backgroundColor = '#374151';
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.style.backgroundColor = '#374151';
                          parent.innerHTML = `
                            <div class="w-full h-40 bg-gray-600 rounded-t-lg flex items-center justify-center">
                              <div class="text-gray-400 text-center">
                                <i class="fas fa-image text-3xl mb-2"></i>
                                <p class="text-sm">이미지 없음</p>
                              </div>
                            </div>
                          `;
                        }
                        return;
                      }
                      
                      // 처음 오류 시에만 로그 출력
                      console.warn("이미지 로드 실패, placeholder로 교체:", product.title);
                      target.src = "/images/placeholder-product.png";
                    }}
                  />
                  {product.isCertified && (
                    <div className="absolute top-2 left-2">
                      <Badge variant="secondary" className="bg-green-600 text-white">
                        <img
                          src="/images/certify.png"
                          alt="인증"
                          className="w-3 h-3 mr-1"
                        />
                        인증
                      </Badge>
                    </div>
                  )}
                  {product.discountPrice && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="destructive" className="bg-red-600 text-white">
                        {Math.round(
                          ((product.price - product.discountPrice) /
                            product.price) *
                            100,
                        )}
                        % 할인
                      </Badge>
                    </div>
                  )}
                </div>

                {/* 상품 정보 */}
                <div className="p-2">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-xs line-clamp-2 flex-1 mr-1">
                      {product.title}
                    </h3>
                    <Badge
                      variant="default"
                      className="text-xs shrink-0 border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-300 px-1 py-0"
                    >
                      {getCategoryName(product)}
                    </Badge>
                  </div>

                  <p className="text-gray-600 dark:text-gray-400 text-xs mb-1 line-clamp-1">
                    {stripHtml(product.description || "")}
                  </p>

                  <div className="flex items-center justify-between mt-1">
                    <div className="flex flex-col">
                      {product.discountPrice ? (
                        <>
                          <span className="text-gray-500 dark:text-gray-600 line-through text-xs">
                            {product.price.toLocaleString()}원
                          </span>
                          <span className="text-gray-900 dark:text-white font-bold text-xs">
                            {product.discountPrice.toLocaleString()}원
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-900 dark:text-white font-bold text-xs">
                          {product.price.toLocaleString()}원
                        </span>
                      )}
                    </div>

                    <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                      {product.rating && (
                        <>
                          <span className="text-yellow-400">★</span>
                          <span className="ml-1">
                            {product.rating} ({product.reviewCount || 0})
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <BottomNavigation />
    </div>
  );
}
