import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { Star, ShoppingCart } from "lucide-react";

interface Product {
  id: string | number;
  title: string;
  description?: string;
  price: number | string;
  discountPrice?: number | string;
  images?: string[];
  category?: string;
  rating?: number | string;
  reviewCount?: number | string;
  stock?: number | string;
  isCertified?: boolean; // 판매자 인증 여부 추가
}

interface ProductCardProps {
  product: Product;
}

// 이미지 URL을 올바르게 처리하는 함수
const getImageUrl = (image: string | undefined): string => {
  if (!image) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&h=300&fit=crop';

  // Base64 데이터인 경우 그대로 반환
  if (image.startsWith("data:")) {
    return image;
  }

  // 이미 완전한 URL인 경우 (http:// 또는 https://)
  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }

  // 상대 경로인 경우 서버 URL 사용
  if (image.startsWith("/uploads/") || image.startsWith("/api/uploads/") || 
      image.startsWith("/images/") || image.startsWith("/images/item/")) {
    // 경로에서 /api 접두사 제거 (필요한 경우)
    const cleanPath = image.startsWith("/api/") ? image.substring(4) : image;
    // 개발 환경에서는 서버가 5000 포트에서 실행되므로 이미지 URL을 서버 URL로 변경
    return `${cleanPath}`;
  }

  return image;
};

const ProductCard = ({ product }: ProductCardProps) => {
  const [, setLocation] = useLocation();

  const formatRating = (rating: any) => {
    if (rating == null || rating === undefined) return null;
    const numRating = typeof rating === 'string' ? parseFloat(rating) : Number(rating);
    return isNaN(numRating) ? null : numRating;
  };

  const formatPrice = (price: number | string) => {
    const numPrice = typeof price === 'string' ? parseFloat(price) : Number(price);
    return isNaN(numPrice) ? '0원' : numPrice.toLocaleString() + '원';
  };

  const getDiscountRate = () => {
    const price = typeof product.price === 'string' ? parseFloat(product.price) : Number(product.price);
    const discountPrice = product.discountPrice ? 
      (typeof product.discountPrice === 'string' ? parseFloat(product.discountPrice) : Number(product.discountPrice)) 
      : null;
    
    if (discountPrice && !isNaN(price) && !isNaN(discountPrice) && price > discountPrice) {
      return Math.round(((price - discountPrice) / price) * 100);
    }
    return 0;
  };

  const handleProductClick = () => {
    setLocation(`/product/${product.id}`);
  };

  const handleShopClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLocation('/shop');
  };

  // 상품 이미지 URL 처리
  const productImageUrl = product.images && product.images.length > 0 
    ? getImageUrl(product.images[0]) 
    : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&h=300&fit=crop';

  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 overflow-hidden h-full min-h-[420px] flex flex-col"
      onClick={handleProductClick}
    >
      <div className="relative">
        {/* 상품 이미지 */}
        <div className="aspect-[4/3] overflow-hidden">
          <img
            src={productImageUrl}
            alt={product.title}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          />
        </div>

        {/* 할인 배지 */}
        {getDiscountRate() > 0 && (
          <Badge className="absolute top-2 left-2 bg-red-500 text-white">
            {getDiscountRate()}% 할인
          </Badge>
        )}

        {/* 인증 마크 추가 */}
        {product.isCertified && (
          <div className="absolute top-2 right-2">
            <div className="w-24 h-24 rounded-lg bg-white shadow-md border-2 border-sky-300 flex items-center justify-center p-0">
              <img 
                src="/images/certify.png"
                alt="인증 마크" 
                className="w-24 h-24"
                title="인증된 판매자 상품"
              />
            </div>
          </div>
        )}

        {/* 품절 오버레이 */}
        {(() => {
          const stock = typeof product.stock === 'string' ? parseInt(product.stock) : Number(product.stock || 0);
          return stock === 0 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Badge variant="destructive" className="text-white">
                품절
              </Badge>
            </div>
          );
        })()}
      </div>

      <CardContent className="p-4 flex flex-col h-full">
        <div className="flex-1">
          {/* 카테고리 */}
          {product.category && (
            <Badge variant="default" className="text-xs mb-2">
              {product.category}
            </Badge>
          )}

          {/* 상품명 */}
          <h3 className="font-bold text-gray-800 mb-2 line-clamp-2 min-h-[2.5rem]">
            {product.title}
          </h3>

          {/* 설명 */}
          {product.description && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
              {product.description}
            </p>
          )}

          {/* 평점 */}
          {(() => {
            const safeRating = formatRating(product.rating);
            return safeRating !== null && (
              <div className="flex items-center gap-1 mb-2">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-medium">{safeRating.toFixed(1)}</span>
                {product.reviewCount && (
                  <span className="text-xs text-gray-500">({product.reviewCount})</span>
                )}
              </div>
            );
          })()}

          {/* 가격 */}
          <div className="mb-3">
            {(() => {
              const price = typeof product.price === 'string' ? parseFloat(product.price) : Number(product.price);
              const discountPrice = product.discountPrice ? 
                (typeof product.discountPrice === 'string' ? parseFloat(product.discountPrice) : Number(product.discountPrice)) 
                : null;
              
              if (discountPrice && !isNaN(discountPrice) && discountPrice > 0) {
                return (
                  <div>
                    <div className="text-lg font-bold text-blue-600">
                      {formatPrice(discountPrice)}
                    </div>
                    <div className="text-sm text-gray-500 line-through">
                      {formatPrice(price)}
                    </div>
                  </div>
                );
              } else {
                return (
                  <div className="text-lg font-bold text-gray-800">
                    {formatPrice(price)}
                  </div>
                );
              }
            })()}
          </div>
        </div>

        {/* 구매 버튼 - 카드 하단에 고정 */}
        {(() => {
          const stock = typeof product.stock === 'string' ? parseInt(product.stock) : Number(product.stock || 0);
          const isOutOfStock = stock === 0;
          
          return (
            <Button 
              className="w-full text-sm mt-auto"
              onClick={handleShopClick}
              disabled={isOutOfStock}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              {isOutOfStock ? '품절' : '장바구니 담기'}
            </Button>
          );
        })()}
      </CardContent>
    </Card>
  );
};

export default ProductCard; 