import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cartAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function CartPage() {
  const { user, setShowAuthModal } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    if (!user) {
      setShowAuthModal(true);
    }
  }, [user, setShowAuthModal]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["cart", user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      return await cartAPI.getCart(user.uid);
    },
    enabled: !!user?.uid,
  });

  // 선택 토글
  const toggleSelect = (id: number | string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectAll(prev => !prev);
    setSelectedIds(prev => {
      if (!items || items.length === 0) return new Set();
      if (!selectAll) {
        return new Set(items.map((it: any) => it.id));
      } else {
        return new Set();
      }
    });
  };

  const updateQty = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: number | string; quantity: number }) => {
      if (!user?.uid) throw new Error("로그인이 필요합니다.");
      return await cartAPI.updateItem(user.uid, itemId, { quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart", user?.uid] });
      queryClient.invalidateQueries({ queryKey: ["header-cart", user?.uid] });
    },
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: number | string) => {
      if (!user?.uid) throw new Error("로그인이 필요합니다.");
      return await cartAPI.removeItem(user.uid, itemId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart", user?.uid] });
      queryClient.invalidateQueries({ queryKey: ["header-cart", user?.uid] });
      toast({ title: "삭제되었습니다" });
    },
  });

  const clearCart = useMutation({
    mutationFn: async () => {
      if (!user?.uid) throw new Error("로그인이 필요합니다.");
      return await cartAPI.clear(user.uid);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart", user?.uid] });
      queryClient.invalidateQueries({ queryKey: ["header-cart", user?.uid] });
      setSelectedIds(new Set());
      setSelectAll(false);
      toast({ title: "장바구니를 비웠습니다" });
    },
  });

  const selectedItems = Array.isArray(items)
    ? items.filter((it: any) => selectedIds.has(it.id))
    : [];

  const totalQty = selectedItems.reduce((s: number, it: any) => s + Number(it.quantity || 0), 0);
  const subtotal = selectedItems.reduce((sum: number, it: any) => {
    const price = it.product?.discountPrice ?? it.product?.discount_price ?? it.product?.price ?? 0;
    const numPrice = typeof price === 'string' ? parseFloat(price) : Number(price);
    // 옵션 합 (선택된 옵션 가격 포함)
    const optionSum = Array.isArray(it.selectedOptions)
      ? it.selectedOptions.reduce((acc: number, o: any) => acc + (Number(o.price_adjust) || 0), 0)
      : 0;
    return sum + ((numPrice + optionSum) * (Number(it.quantity) || 1));
  }, 0);

  const toShop = () => setLocation('/shop');

  const toCheckoutSelected = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (selectedItems.length === 0) {
      toast({ title: "선택된 상품이 없습니다", variant: "destructive" });
      return;
    }
    // 선택된 카트 항목만 직접구매 형태로 체크아웃 데이터 구성
    const itemsForCheckout = selectedItems.map((it: any) => ({
      product_id: it.productId || it.product?.id,
      product: {
        ...it.product,
        id: it.product?.id || it.productId,
        title: it.product?.title,
        price: it.product?.price,
        discount_price: it.product?.discount_price ?? it.product?.discountPrice,
        images: it.product?.images,
      },
      quantity: Number(it.quantity) || 1,
      selected_options: Array.isArray(it.selectedOptions)
        ? it.selectedOptions.map((o: any) => ({
            name: o.name,
            value: o.value,
            price_adjust: Number(o.price_adjust) || 0,
          }))
        : [],
    }));

    const checkoutData = {
      directCheckout: true,
      items: itemsForCheckout,
      userInfo: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      },
    };

    localStorage.setItem('checkoutData', JSON.stringify(checkoutData));
    toast({ title: "결제 페이지로 이동합니다", variant: "default" });
    setLocation('/checkout');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2 text-white">로그인이 필요합니다</h2>
          <p className="text-gray-300 mb-4">장바구니를 보려면 로그인해주세요.</p>
          <Button onClick={() => setShowAuthModal(true)} className="bg-blue-600 hover:bg-blue-700">
            로그인
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-6 h-6 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-300 mt-2">장바구니를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-bold mb-4 text-white">장바구니</h1>

      {(!items || items.length === 0) ? (
        <div className="text-center py-12 bg-gray-800 rounded-lg border border-gray-600">
          <p className="text-gray-300">장바구니에 담긴 상품이 없습니다.</p>
          <Button className="mt-4 bg-blue-600 hover:bg-blue-700" onClick={toShop}>쇼핑 계속하기</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {/* 전체 선택 토글 */}
            <div className="flex items-center gap-2 mb-2">
              <input id="select-all" type="checkbox" checked={selectAll && selectedIds.size === items.length}
                     onChange={toggleSelectAll} />
              <label htmlFor="select-all" className="text-sm text-gray-300">전체 선택</label>
              {selectedIds.size > 0 && (
                <>
                  <span className="text-xs text-gray-400">선택 {selectedIds.size}개</span>
                  <Button variant="default" size="sm" onClick={() => {
                    // 선택 삭제
                    const ids = Array.from(selectedIds);
                    ids.forEach(id => removeItem.mutate(id));
                    setSelectedIds(new Set());
                    setSelectAll(false);
                  }}>선택 삭제</Button>
                </>
              )}
            </div>

            {items.map((it: any) => (
              <div key={it.id} className="flex items-center gap-4 bg-gray-800 border border-gray-600 rounded-lg p-3">
                <input type="checkbox" checked={selectedIds.has(it.id)} onChange={() => toggleSelect(it.id)} />
                <div className="w-20 h-20 bg-gray-700 rounded overflow-hidden flex-shrink-0">
                  {it.product?.images && it.product.images.length > 0 ? (
                    <img src={typeof it.product.images[0] === 'string' ? it.product.images[0] : ''} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">이미지</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-white">{it.product?.title || `상품 #${it.productId}`}</p>
                  {Array.isArray(it.selectedOptions) && it.selectedOptions.length > 0 && (
                    <div className="mt-1 text-xs text-gray-400">
                      {it.selectedOptions.map((opt: any, idx: number) => (
                        <Badge key={idx} variant="default" className="mr-1 mb-1 border-gray-600 text-gray-300">{opt.name}: {opt.value}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="mt-1 text-sm text-gray-300">
                    단가: {(() => {
                      const price = it.product?.discountPrice ?? it.product?.discount_price ?? it.product?.price ?? 0;
                      const num = typeof price === 'string' ? parseFloat(price) : Number(price);
                      return isNaN(num) ? 0 : Math.floor(num).toLocaleString();
                    })()}원
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="default" size="icon" className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white" onClick={() => updateQty.mutate({ itemId: it.id, quantity: Math.max(1, Number(it.quantity) - 1) })}>-</Button>
                  <span className="w-8 text-center text-white">{it.quantity}</span>
                  <Button variant="default" size="icon" className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white" onClick={() => updateQty.mutate({ itemId: it.id, quantity: Number(it.quantity) + 1 })}>+</Button>
                </div>
                <div>
                  <Button variant="ghost" className="text-gray-300 hover:text-red-400 hover:bg-gray-700" onClick={() => removeItem.mutate(it.id)}>삭제</Button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 h-fit">
            <h2 className="text-lg font-semibold mb-2 text-white">주문 요약</h2>
            <div className="text-xs text-gray-400 mb-2">선택한 상품만 계산됩니다.</div>
            <div className="flex justify-between text-sm mb-1 text-gray-300"><span>선택 수량</span><span className="text-white">{totalQty}개</span></div>
            <div className="flex justify-between text-sm mb-1 text-gray-300"><span>상품 금액</span><span className="text-white">{Math.floor(subtotal).toLocaleString()}원</span></div>
            <div className="flex justify-between text-sm mb-1 text-gray-300"><span>배송비</span><span className="text-white">{subtotal < 30000 && totalQty > 0 ? '3,000원' : (totalQty > 0 ? '무료' : '-')}</span></div>
            <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-600 mt-2 text-white"><span>결제 예정 금액</span><span className="text-blue-400">{totalQty > 0 ? Math.floor(subtotal + (subtotal < 30000 ? 3000 : 0)).toLocaleString() : '0'}원</span></div>
            <div className="mt-4 flex gap-2">
              <Button variant="default" className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white" onClick={() => clearCart.mutate()}>장바구니 비우기</Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={toCheckoutSelected} disabled={selectedItems.length === 0}>선택 상품 결제</Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
} 