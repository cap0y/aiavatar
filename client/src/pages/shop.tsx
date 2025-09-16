import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Search, Filter, ArrowUpDown } from "lucide-react";
import { productAPI } from "@/lib/api";

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

// 이미지 URL을 올바르게 처리하는 함수
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

    // 상대 경로인 경우 서버 URL 사용
    if (
      image.startsWith("/uploads/") ||
      image.startsWith("/api/uploads/") ||
      image.startsWith("/images/") ||
      image.startsWith("/images/item/")
    ) {
      // 경로에서 /api 접두사 제거 (필요한 경우)
      const cleanPath = image.startsWith("/api/") ? image.substring(4) : image;
      // 개발 환경에서는 서버가 5000 포트에서 실행되므로 이미지 URL을 서버 URL로 변경
      return `${cleanPath}`;
    }

    return image;
  }

  // 객체인 경우 (url 속성이 있는 객체)
  if (image && typeof image === "object" && "url" in image) {
    return getImageUrl(image.url);
  }

  return "";
};

// 상품 카테고리 목록 (API에서 가져올 예정)
const CATEGORIES = [
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

// 카테고리 하드코딩 매핑 (fallback용) - 실제 DB 구조에 맞게 수정
const getCategoryName = (product: Product): string => {
  // 1. 서버에서 JOIN된 카테고리 이름 우선 사용
  if ((product as any).category && (product as any).category !== null) {
    return (product as any).category;
  }

  // 2. 실제 데이터베이스 구조에 맞는 카테고리 매핑
  const categoryMap: { [key: number]: string } = {
    1: "전체",
    2: "가공식품",
    3: "건강식품",
    4: "기타",
    5: "농산물",
    6: "디지털상품",
    7: "생활용품",
    8: "수산물",
    9: "전자제품",
    10: "주류",
    11: "축산물",
    12: "취미/게임",
    13: "카페/베이커리",
    14: "패션",
    15: "하드웨어",
  };

  // 3. categoryId로 매핑
  const categoryId =
    (product as any).categoryId || (product as any).category_id;
  if (categoryId && categoryMap[Number(categoryId)]) {
    return categoryMap[Number(categoryId)];
  }

  // 4. 기본값
  return categoryId ? `카테고리 ${categoryId}` : "기타";
};

interface ShopPageProps {
  onProductClick?: (productId: string) => void;
}

export default function ShopPage({ onProductClick }: ShopPageProps) {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("전체");
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
        return CATEGORIES; // 오류 시 기본 카테고리 사용
      } catch (error) {
        console.error("카테고리 로드 오류:", error);
        return CATEGORIES; // 오류 시 기본 카테고리 사용
      }
    },
  });

  // 중복 제거된 카테고리 목록 생성 함수
  const getUniqueCategories = () => {
    const categories = categoriesData || CATEGORIES;

    // 디버깅 출력
    console.log("카테고리 데이터:", JSON.stringify(categories));

    // 각 항목이 객체인 경우 문자열로 변환
    const processedCategories = categories.map((category: any) => {
      // 카테고리가 객체인 경우 name 속성 사용
      if (typeof category === "object" && category !== null) {
        return category.name || "기타";
      }
      // 이미 문자열이면 그대로 반환
      return category;
    });

    // 중복 제거
    return processedCategories.filter(
      (category: string, index: number, array: string[]) =>
        array.indexOf(category) === index,
    );
  };

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
      try {
        console.log("상품 데이터 요청 시작:", getQueryParams());
        const response = await productAPI.getProducts(getQueryParams());
        console.log("상품 API 응답:", response);

        // 응답이 배열인 경우 (API가 상품 목록을 직접 반환)
        if (Array.isArray(response)) {
          console.log("응답이 배열 형태임:", response.length);
          return response;
        }
        // 응답이 객체인 경우 (API가 { products: [...] } 형태로 반환)
        else if (
          response &&
          response.products &&
          Array.isArray(response.products)
        ) {
          console.log("응답이 객체 형태임:", response.products.length);
          return response.products;
        }
        // 응답이 비어있거나 예상치 못한 형태인 경우 빈 배열 반환
        console.log("응답이 예상과 다름, 빈 배열 반환");
        return [];
      } catch (error) {
        console.error("상품 로드 오류:", error);
        // 오류 발생 시에도 빈 배열 반환
        return [];
      }
    },
  });

  // 상품 클릭 핸들러
  const handleProductClick = (product: Product) => {
    if (onProductClick) {
      onProductClick(product.id);
    } else {
      // 상품 상세 페이지로 이동
      setLocation(`/product/${product.id}`);
    }
  };

  // 검색이나 필터 변경 시 상품 목록 갱신
  useEffect(() => {
    refetch();
  }, [selectedCategory, sortBy, searchTerm, refetch]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 쇼핑몰 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ShoppingBag className="h-8 w-8 text-blue-600" />
          <span>케어링크 쇼핑몰</span>
        </h1>
        <p className="text-gray-600 mt-2">
          생산자와 소비자를 직접 연결하는 신선한 농수산물 직거래 플랫폼입니다.
        </p>
      </div>

      {/* 검색 및 필터 */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="상품명, 태그 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Button
              variant="outline"
              className="flex items-center gap-1"
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
            >
              <Filter className="h-4 w-4" />
              <span>{selectedCategory}</span>
            </Button>
            <div
              className={`absolute top-full right-0 mt-1 bg-white shadow-lg rounded-md border border-gray-200 z-10 ${showCategoryDropdown ? "block" : "hidden"}`}
            >
              {getUniqueCategories().map((category: string) => (
                <button
                  key={category}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                  onClick={() => handleCategoryChange(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
          <Button
            variant="outline"
            className="flex items-center gap-1"
            onClick={() => {
              setSortBy(sortBy === "price_asc" ? "price_desc" : "price_asc");
            }}
          >
            <ArrowUpDown className="h-4 w-4" />
            <span>
              {sortBy === "latest"
                ? "최신순"
                : sortBy === "price_asc"
                  ? "낮은가격순"
                  : sortBy === "price_desc"
                    ? "높은가격순"
                    : "인기순"}
            </span>
          </Button>
        </div>
      </div>

      {/* 카테고리 필터 */}
      <div className="flex flex-wrap gap-2 mb-6">
        {getUniqueCategories().map((category: string) => (
          <Badge
            key={category}
            variant={selectedCategory === category ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => handleCategoryChange(category)}
          >
            {category}
          </Badge>
        ))}
      </div>

      {/* 상품 목록 */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-2 text-gray-600">상품을 불러오는 중...</span>
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">
          상품을 불러오는 데 문제가 발생했습니다. 다시 시도해주세요.
        </div>
      ) : data && data.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {data.map((product: Product) => (
            <div
              key={product.id}
              className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow border border-gray-200 cursor-pointer"
              onClick={() => handleProductClick(product)}
            >
              <div className="h-36 sm:h-44 md:h-48 bg-gray-200 relative">
                {product.images && product.images.length > 0 ? (
                  <img
                    src={getImageUrl(product.images[0])}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                    이미지 없음
                  </div>
                )}
                {product.discountPrice && (
                  <Badge className="absolute top-2 left-2 bg-red-500">
                    {Math.round(
                      ((product.price - product.discountPrice) /
                        product.price) *
                        100,
                    )}
                    % 할인
                  </Badge>
                )}
                {/* 인증 마크 추가 */}
                {product.isCertified && (
                  <div className="absolute top-2 right-2">
                    <div className="w-16 h-16 rounded-lg bg-white shadow-md border-2 border-sky-300 flex items-center justify-center p-0">
                      <img
                        src="/images/certify.png"
                        alt="인증 마크"
                        className="w-16 h-16"
                        title="인증된 판매자 상품"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="p-3 sm:p-4">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" className="text-xs">
                    {getCategoryName(product)}
                  </Badge>
                  {product.rating !== undefined && (
                    <div className="flex items-center text-yellow-500 text-xs">
                      ★{" "}
                      {typeof product.rating === "number"
                        ? product.rating.toFixed(1)
                        : product.rating}{" "}
                      ({product.reviewCount || 0})
                    </div>
                  )}
                </div>
                <h3 className="font-medium text-gray-900 mb-0.5 truncate">
                  {product.title}
                </h3>
                <p className="hidden sm:block text-gray-600 text-sm mb-1 sm:mb-2 line-clamp-2">
                  {product.description ? stripHtml(product.description) : ""}
                </p>
                {/* 옵션 정보 표시 */}
                {(product as any).options &&
                  (product as any).options.length > 0 && (
                    <div className="hidden sm:block text-xs text-gray-500 mb-1 sm:mb-2">
                      <span className="font-medium">옵션:</span>{" "}
                      {(product as any).options
                        .map((opt: any) => opt.name)
                        .join(", ")}
                    </div>
                  )}
                <div className="flex items-end justify-between">
                  <div>
                    {product.discountPrice ? (
                      <>
                        <span className="text-gray-400 line-through text-sm">
                          {Math.floor(product.price).toLocaleString()}원
                        </span>
                        <p className="font-bold text-red-600">
                          {Math.floor(product.discountPrice).toLocaleString()}원
                        </p>
                      </>
                    ) : (
                      <p className="font-bold text-gray-900">
                        {Math.floor(product.price).toLocaleString()}원
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <pre className="text-left bg-gray-100 p-4 rounded-md mx-auto max-w-lg overflow-auto text-xs">
            {JSON.stringify(data, null, 2)}
          </pre>
          <p className="mt-4">검색 결과가 없습니다.</p>
          <Button
            className="mt-4"
            onClick={() => {
              setSelectedCategory("전체");
              setSearchTerm("");
              setSortBy("latest");
              refetch();
            }}
          >
            모든 상품 보기
          </Button>
        </div>
      )}
    </div>
  );
}
