import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/header";
import BottomNavigation from "@/components/bottom-navigation";
import { Package, Clock, Truck, CheckCircle, XCircle } from "lucide-react";

export default function OrdersPage() {
  const { user } = useAuth();

  // 주문 목록 가져오기
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["customer-orders", user?.uid],
    queryFn: async () => {
      try {
        const userId = user?.uid || (user as any)?.id || user?.email;
        const response = await fetch(`/api/orders/customer/${userId}`);

        // Content-Type 확인
        const contentType = response.headers.get("content-type");
        
        if (!response.ok || !contentType || !contentType.includes("application/json")) {
          console.warn("주문 API가 아직 구현되지 않았거나 오류 발생, 빈 배열 반환");
          return [];
        }

        const data = await response.json();
        console.log("📦 주문 데이터 조회:", data);
        // 각 주문의 상세 정보 출력
        data.forEach((order: any, idx: number) => {
          console.log(`주문 ${idx + 1} (${order.id}):`, {
            order_status: order.order_status,
            payment_status: order.payment_status,
            tracking_number: order.tracking_number,
            shipping_company: order.shipping_company,
            orderItems: order.orderItems?.length || 0
          });
        });
        return data;
      } catch (error) {
        console.error("주문 로드 오류:", error);
        // API가 구현되지 않았을 경우 빈 배열 반환
        return [];
      }
    },
    enabled: !!user,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'processing':
        return <Package className="w-4 h-4" />;
      case 'shipped':
        return <Truck className="w-4 h-4" />;
      case 'delivered':
        return <CheckCircle className="w-4 h-4" />;
      case 'canceled':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '결제 완료';
      case 'awaiting_deposit':
        return '입금대기';
      case 'processing':
        return '처리 중';
      case 'shipped':
        return '배송 중';
      case 'delivered':
        return '배송 완료';
      case 'canceled':
        return '취소됨';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-600';
      case 'awaiting_deposit':
        return 'bg-orange-600';
      case 'processing':
        return 'bg-blue-600';
      case 'shipped':
        return 'bg-purple-600';
      case 'delivered':
        return 'bg-green-600';
      case 'canceled':
        return 'bg-red-600';
      default:
        return 'bg-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />
      
      <div className="container mx-auto px-4 py-8 mt-16 mb-20">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-6 flex items-center gap-2">
            <Package className="w-8 h-8 text-purple-400" />
            주문 내역 - 결제 완료 이상일때 다운주소 보임
          </h1>

          {isLoading ? (
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="py-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                <p className="text-white">주문 내역을 불러오는 중...</p>
              </CardContent>
            </Card>
          ) : orders.length === 0 ? (
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="py-12 text-center">
                <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  주문 내역이 없습니다
                </h3>
                <p className="text-gray-400">
                  아직 주문하신 상품이 없습니다.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {orders.map((order: any) => (
                <Card key={order.id} className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-all">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-white flex items-center gap-2">
                          <span className="text-sm text-gray-400">주문번호:</span>
                          {order.id}
                        </CardTitle>
                        <p className="text-sm text-gray-400 mt-1">
                          {new Date(order.createdAt).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <Badge className={`${getStatusColor(order.order_status)} text-white flex items-center gap-1`}>
                        {getStatusIcon(order.order_status)}
                        {getStatusText(order.order_status)}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {/* 주문 상품 목록 */}
                    <div className="space-y-3 mb-4">
                      {order.orderItems?.map((item: any, idx: number) => (
                        <div key={idx} className="flex gap-4">
                          {item.product?.image_url && (
                            <img
                              src={item.product.image_url}
                              alt={item.product.title}
                              className="w-16 h-16 object-cover rounded"
                            />
                          )}
                          <div className="flex-1">
                            <h4 className="text-white font-medium">
                              {item.product?.title || '상품명'}
                            </h4>
                            <p className="text-sm text-gray-400">
                              수량: {item.quantity}개 × {item.price?.toLocaleString()}원
                            </p>
                            {item.selected_options && item.selected_options.length > 0 && (
                              <p className="text-xs text-gray-500">
                                옵션: {item.selected_options.map((opt: any) => 
                                  `${opt.name}: ${opt.value}`
                                ).join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 배송/다운로드 정보 */}
                    {(() => {
                      // 결제 완료 이상 상태 확인
                      const isPaid = order.order_status !== 'awaiting_deposit' && order.order_status !== 'canceled';
                      
                      // 디지털 상품 확인 (상품의 digital_files 또는 is_digital 확인)
                      const digitalProduct = order.orderItems?.find((item: any) => 
                        item.product && (
                          (item.product.digital_files && item.product.digital_files.length > 0) ||
                          item.product.digitalFiles?.length > 0 ||
                          item.product.is_digital ||
                          item.product.isDigital
                        )
                      );
                      
                      const digitalFiles = digitalProduct?.product?.digital_files || 
                                          digitalProduct?.product?.digitalFiles || 
                                          [];
                      
                      // tracking_number가 있거나, 결제 완료 이상이고 디지털 상품인 경우
                      if (order.tracking_number || (isPaid && digitalFiles.length > 0)) {
                        return (
                          <div className="bg-gray-700/50 rounded-lg p-3 mb-3">
                            {order.shipping_company === "직접 다운로드" || digitalFiles.length > 0 ? (
                              <>
                                <h5 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                                  <i className="fas fa-download text-green-400"></i>
                                  다운로드 정보
                                </h5>
                                <p className="text-sm text-gray-300 mb-3">
                                  <span className="text-gray-400">배송 방식:</span> 직접 다운로드 (디지털 상품)
                                </p>
                                {digitalFiles.map((fileUrl: string, index: number) => (
                                  <a
                                    key={index}
                                    href={order.tracking_number || fileUrl}
                                    download
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-4 py-2 mb-2 mr-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg transition-all"
                                  >
                                    <i className="fas fa-download"></i>
                                    파일 다운로드 {digitalFiles.length > 1 ? `(${index + 1})` : ''}
                                  </a>
                                ))}
                                {!digitalFiles.length && order.tracking_number && (
                                  <a
                                    href={order.tracking_number}
                                    download
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg transition-all"
                                  >
                                    <i className="fas fa-download"></i>
                                    파일 다운로드
                                  </a>
                                )}
                                <p className="text-xs text-gray-400 mt-2">
                                  <i className="fas fa-info-circle mr-1"></i>
                                  결제 완료 후 언제든지 다운로드 가능합니다.
                                </p>
                              </>
                            ) : order.tracking_number ? (
                              <>
                                <h5 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                                  <Truck className="w-4 h-4 text-purple-400" />
                                  배송 정보
                                </h5>
                                <p className="text-sm text-gray-300">
                                  <span className="text-gray-400">택배사:</span> {order.shipping_company}
                                </p>
                                <p className="text-sm text-gray-300">
                                  <span className="text-gray-400">운송장번호:</span> {order.tracking_number}
                                </p>
                              </>
                            ) : null}
                          </div>
                        );
                      } else {
                        // tracking_number도 없고 디지털 파일도 없을 때
                        return (
                          <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-3 mb-3">
                            <div className="flex items-start gap-2">
                              <i className="fas fa-info-circle text-yellow-400 mt-1"></i>
                              <div className="text-sm text-yellow-300">
                                {order.order_status === 'awaiting_deposit' ? (
                                  <p>입금 확인 후 다운로드 링크가 제공됩니다.</p>
                                ) : (
                                  <p>배송 정보가 등록되면 여기에 표시됩니다.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }
                    })()}

                    {/* 총 금액 */}
                    <div className="border-t border-gray-700 pt-3 flex justify-between items-center">
                      <span className="text-gray-400">총 결제금액</span>
                      <span className="text-xl font-bold text-white">
                        {order.total_amount?.toLocaleString()}원
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <BottomNavigation />
    </div>
  );
}

