import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/header";
import BottomNavigation from "@/components/bottom-navigation";

export default function CheckoutCompletePage() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [paymentInfo, setPaymentInfo] = useState<any>(null);

  useEffect(() => {
    // URL 파라미터에서 결제 정보 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const paymentId = urlParams.get('paymentId');
    const code = urlParams.get('code');
    const message = urlParams.get('message');

    console.log('결제 완료 페이지 - 파라미터:', { paymentId, code, message });

    if (code) {
      // 결제 실패
      setStatus('failed');
      setPaymentInfo({ code, message });
    } else if (paymentId) {
      // 결제 성공
      setStatus('success');
      setPaymentInfo({ paymentId });
      
      // 성공 시 3초 후 주문 완료 페이지로 이동
      setTimeout(() => {
        setLocation('/orders');
      }, 3000);
    } else {
      // 파라미터가 없으면 홈으로
      setTimeout(() => {
        setLocation('/');
      }, 2000);
    }
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto px-4 py-8 mt-16 mb-20">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-center">
              {status === 'loading' && '결제 처리 중...'}
              {status === 'success' && '결제 완료'}
              {status === 'failed' && '결제 실패'}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="text-center">
            {status === 'loading' && (
              <div className="py-12">
                <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin text-blue-500" />
                <p className="text-gray-600">결제 정보를 확인하고 있습니다...</p>
              </div>
            )}
            
            {status === 'success' && (
              <div className="py-12">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
                <h3 className="text-xl font-semibold mb-2">결제가 완료되었습니다!</h3>
                <p className="text-gray-600 mb-6">
                  주문이 정상적으로 처리되었습니다.
                </p>
                {paymentInfo?.paymentId && (
                  <p className="text-sm text-gray-500 mb-4">
                    결제 ID: {paymentInfo.paymentId}
                  </p>
                )}
                <p className="text-sm text-gray-500">
                  잠시 후 주문 내역 페이지로 이동합니다...
                </p>
              </div>
            )}
            
            {status === 'failed' && (
              <div className="py-12">
                <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
                <h3 className="text-xl font-semibold mb-2">결제에 실패했습니다</h3>
                <p className="text-gray-600 mb-6">
                  {paymentInfo?.message || '결제 처리 중 오류가 발생했습니다.'}
                </p>
                {paymentInfo?.code && (
                  <p className="text-sm text-gray-500 mb-6">
                    오류 코드: {paymentInfo.code}
                  </p>
                )}
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setLocation('/')}
                  >
                    홈으로
                  </Button>
                  <Button
                    onClick={() => setLocation('/checkout')}
                  >
                    다시 시도
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <BottomNavigation />
    </div>
  );
}

