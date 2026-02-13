import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Receipt, CreditCard, Calendar, Package } from "lucide-react";

interface Payment {
  id: string;
  order_id: string;
  payment_method: string;
  amount: number;
  status: string;
  created_at: string;
  items: {
    product_name: string;
    quantity: number;
    price: number;
  }[];
}

export default function PaymentHistoryPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // 결제 내역 조회 (임시 더미 데이터)
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments", user?.uid || user?.email],
    queryFn: async () => {
      // 실제 API 호출로 대체 예정
      await new Promise(resolve => setTimeout(resolve, 1000)); // 로딩 시뮬레이션
      
      return [
        {
          id: "pay_001",
          order_id: "order_001",
          payment_method: "card",
          amount: 35000,
          status: "completed",
          created_at: "2024-01-15T10:30:00Z",
          items: [
            { product_name: "미라이 - VTuber 아바타", quantity: 1, price: 120000 },
            { product_name: "아바타 커스터마이징", quantity: 1, price: 15000 },
          ]
        },
        {
          id: "pay_002",
          order_id: "order_002", 
          payment_method: "bank",
          amount: 25000,
          status: "pending",
          created_at: "2024-01-10T14:20:00Z",
          items: [
            { product_name: "사쿠라 - 일본풍 VTuber", quantity: 1, price: 25000 },
          ]
        },
        {
          id: "pay_003",
          order_id: "order_003",
          payment_method: "card", 
          amount: 47000,
          status: "completed",
          created_at: "2024-01-05T09:15:00Z",
          items: [
            { product_name: "AI 아바타 제작 의뢰", quantity: 1, price: 35000 },
            { product_name: "음성 합성 추가", quantity: 1, price: 12000 },
          ]
        }
      ] as Payment[];
    },
    enabled: !!user,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-500">결제완료</Badge>;
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-500 text-white">결제대기</Badge>;
      case "cancelled":
        return <Badge variant="destructive">결제취소</Badge>;
      case "failed":
        return <Badge variant="destructive">결제실패</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case "card":
        return "신용/체크카드";
      case "bank":
        return "무통장입금";
      case "kakao":
        return "카카오페이";
      default:
        return method;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString() + '원';
  };

  if (!user) {
    setLocation('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* 헤더 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => setLocation('/profile')}
          className="mb-4 text-white hover:text-gray-300"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          마이페이지로 돌아가기
        </Button>

        <div className="flex items-center gap-3 mb-2">
          <Receipt className="h-6 w-6 text-purple-600" />
          <h1 className="text-2xl font-bold text-white">구매 내역</h1>
        </div>
        <p className="text-gray-400">AI 아바타 구매 및 작품 의뢰 결제 내역을 확인할 수 있습니다.</p>
      </div>

      {/* 결제 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="bg-gray-800/70 border-gray-600/50">
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-blue-400 mb-1">
              {payments.length}건
            </div>
            <div className="text-sm text-gray-400">총 주문 건수</div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800/70 border-gray-600/50">
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-green-400 mb-1">
              {formatPrice(payments.reduce((sum, payment) => sum + payment.amount, 0))}
            </div>
            <div className="text-sm text-gray-400">총 결제 금액</div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800/70 border-gray-600/50">
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-purple-400 mb-1">
              {payments.filter(p => p.status === 'completed').length}건
            </div>
            <div className="text-sm text-gray-400">결제 완료</div>
          </CardContent>
        </Card>
      </div>

      {/* 결제 내역 목록 */}
      <div className="space-y-4">
        {isLoading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">결제 내역을 불러오는 중...</p>
            </CardContent>
          </Card>
        ) : payments.length === 0 ? (
          <Card className="bg-gray-800/70 border-gray-600/50">
            <CardContent className="p-8 text-center">
              <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">구매 내역이 없습니다</h3>
              <p className="text-gray-400 mb-4">아직 구매하신 AI 아바타가 없습니다.</p>
              <Button onClick={() => setLocation('/shop')}>
                아바타 구매하러 가기
              </Button>
            </CardContent>
          </Card>
        ) : (
          payments.map((payment) => (
            <Card key={payment.id} className="bg-gray-800/70 border-gray-600/50 overflow-hidden">
              <CardHeader className="bg-gray-700/50 border-b border-gray-600">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg mb-1 text-white">
                      주문번호: {payment.order_id}
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm text-gray-300">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(payment.created_at)}
                      </div>
                      <div className="flex items-center gap-1">
                        <CreditCard className="h-4 w-4" />
                        {getPaymentMethodText(payment.payment_method)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(payment.status)}
                    <div className="text-lg font-bold text-white mt-2">
                      {formatPrice(payment.amount)}
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-white">구매한 아바타 & 서비스</span>
                  </div>
                  
                  {payment.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-600 last:border-b-0">
                      <div>
                        <div className="font-medium text-white">{item.product_name}</div>
                        <div className="text-sm text-gray-400">수량: {item.quantity}개</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-white">{formatPrice(item.price * item.quantity)}</div>
                        <div className="text-sm text-gray-400">{formatPrice(item.price)} × {item.quantity}</div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-600">
                  <Button variant="default" size="sm" className="flex-1">
                    <Receipt className="h-4 w-4 mr-2" />
                    영수증 보기
                  </Button>
                  {payment.status === 'completed' && (
                    <Button variant="default" size="sm" className="flex-1">
                      재주문하기
                    </Button>
                  )}
                  {payment.status === 'pending' && (
                    <Button variant="destructive" size="sm" className="flex-1">
                      주문 취소
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
    </div>
  );
} 