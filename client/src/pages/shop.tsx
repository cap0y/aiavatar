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
  if (!image) return "/images/placeholder-product.png";

  try {
    // 이미지가 배열인 경우
    if (Array.isArray(image)) {
      if (image.length > 0) {
        return getImageUrl(image[0]);
      }
      return "/images/placeholder-product.png";
    }

    // 이미지가 JSON 문자열인 경우 파싱
    if (
      typeof image === "string" &&
      (image.startsWith("[") || image.startsWith("{"))
    ) {
      try {
        const parsed = JSON.parse(image);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return getImageUrl(parsed[0]);
        } else if (parsed && typeof parsed === "object") {
          if ("url" in parsed) return parsed.url;
          if ("src" in parsed) return parsed.src;
          if ("path" in parsed) return parsed.path;
          if ("image" in parsed) return parsed.image;
        }
      } catch (e) {
        // JSON 파싱 실패 시 원래 문자열 사용
        console.warn("이미지 JSON 파싱 실패:", e);
      }
    }

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

      // 상대 경로인 경우 처리
      // 이미지 경로에 /images/ 또는 /api/uploads/ 등이 포함된 경우
      if (
        image.includes("/images/") ||
        image.includes("/uploads/") ||
        image.includes("/api/uploads/") ||
        image.includes("/assets/")
      ) {
        return image;
      }

      // 단순 파일명인 경우 이미지 경로 추가
      if (!image.startsWith("/")) {
        return `/images/2dmodel/${image}`;
      }

      // 그 외의 경우 그대로 반환
      return image;
    }

    // 객체인 경우
    if (image && typeof image === "object") {
      // url 속성이 있는 경우
      if ("url" in image && image.url) return getImageUrl(image.url);
      if ("src" in image && image.src) return getImageUrl(image.src);
      if ("path" in image && image.path) return getImageUrl(image.path);
      if ("image" in image && image.image) return getImageUrl(image.image);
    }
  } catch (e) {
    console.error("이미지 URL 처리 오류:", e);
  }

  return "/images/placeholder-product.png";
};

// 상품 카테고리 목록 (AI 아바타 세상)
const CATEGORIES = [
  "전체",
  "애니메이션 스타일",
  "사실적 스타일",
  "카툰 스타일",
  "픽셀 스타일",
  "동물 캐릭터",
  "판타지 캐릭터",
  "게임 캐릭터",
  "커스텀 캐릭터",
  "기타",
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
    9: "기타",
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

export default function ShopPage({
  onProductClick,
  initialCategory,
}: ShopPageProps) {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(
    initialCategory || "전체",
  );
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
    console.log("상품 클릭:", product.id);

    // 1. 부모 컴포넌트에서 전달받은 핸들러가 있으면 사용 (Discord 레이아웃 내에서)
    if (onProductClick) {
      onProductClick(product.id);
      return;
    }

    // 2. 직접 페이지 이동 (독립 페이지에서)
    window.location.href = `/product/${product.id}`;
  };

  // 검색이나 필터 변경 시 상품 목록 갱신
  useEffect(() => {
    refetch();
  }, [selectedCategory, sortBy, searchTerm, refetch]);

  return (
    <div className="h-full bg-gray-800 text-white overflow-y-auto">
      <div className="container mx-auto px-4 py-6">
        {/* 카테고리 탭 목록 - 상단에 표시 */}
        <div className="mb-6 overflow-x-auto">
          <div className="flex space-x-2 pb-2">
            {getUniqueCategories().map((category: string) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                className={`whitespace-nowrap ${
                  selectedCategory === category
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600"
                }`}
                onClick={() => handleCategoryChange(category)}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* 검색 및 필터 */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="상품명, 태그 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex items-center gap-1 bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
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

        {/* 상품 목록 */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-gray-700 rounded-lg p-4 animate-pulse">
                <div className="bg-gray-600 h-48 rounded mb-4"></div>
                <div className="bg-gray-600 h-4 rounded mb-2"></div>
                <div className="bg-gray-600 h-4 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-400">
              상품을 불러오는 중 오류가 발생했습니다.
            </p>
            <Button
              onClick={() => refetch()}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
            >
              다시 시도
            </Button>
          </div>
        ) : !data || data.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag className="h-16 w-16 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">
              해당 카테고리에 상품이 없습니다.
            </p>
            <p className="text-gray-500 mt-2">다른 카테고리를 선택해보세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {data.map((product: Product) => (
              <div
                key={product.id}
                className="bg-gray-700 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-600 hover:border-gray-500"
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
                    className="w-full h-48 object-cover rounded-t-lg"
                    onError={(e) => {
                      console.log(
                        "이미지 로드 실패:",
                        product.title,
                        product.images,
                      );
                      const target = e.target as HTMLImageElement;
                      target.src = "/images/placeholder-product.png";
                    }}
                  />
                  {product.isCertified && (
                    <div className="absolute top-2 left-2">
                      <Badge
                        variant="secondary"
                        className="bg-green-600 text-white"
                      >
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
                      <Badge
                        variant="destructive"
                        className="bg-red-600 text-white"
                      >
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
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-white line-clamp-2 flex-1 mr-2">
                      {product.title}
                    </h3>
                    <Badge
                      variant="outline"
                      className="text-xs shrink-0 border-gray-500 text-gray-300"
                    >
                      {getCategoryName(product)}
                    </Badge>
                  </div>

                  <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                    {stripHtml(product.description || "")}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      {product.discountPrice ? (
                        <>
                          <span className="text-gray-500 line-through text-sm">
                            {product.price.toLocaleString()}원
                          </span>
                          <span className="text-white font-bold">
                            {product.discountPrice.toLocaleString()}원
                          </span>
                        </>
                      ) : (
                        <span className="text-white font-bold">
                          {product.price.toLocaleString()}원
                        </span>
                      )}
                    </div>

                    <div className="flex items-center text-sm text-gray-400">
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
    </div>
  );
}
