import { Express, Request, Response } from 'express';
import { storage } from './storage.js';

interface AuthRequest extends Request {
  user?: {
    userId: number;
    username: string;
    email: string;
    role?: string;
  };
}

// 포트원 결제 정보 타입 정의
interface PortOnePayment {
  id: string;
  status: string;
  amount?: {
    total: number;
    currency: string;
  };
  payMethod?: string;
  paidAt?: string;
  orderName?: string;
  [key: string]: any;
}

// 포트원 API 설정
const PORTONE_API_URL = 'https://api.portone.io';
const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET || 'your-api-secret-here';

// 포트원 결제 정보 조회 함수
async function getPaymentFromPortOne(paymentId: string): Promise<PortOnePayment> {
  try {
    const response = await fetch(`${PORTONE_API_URL}/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `PortOne ${PORTONE_API_SECRET}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`포트원 API 요청 실패: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data as PortOnePayment;
  } catch (error) {
    console.error('포트원 결제 정보 조회 오류:', error);
    throw error;
  }
}

export function registerPaymentRoutes(app: Express) {
  // 결제 완료 처리 엔드포인트
  app.post('/api/payment/complete', async (req: Request, res: Response) => {
    try {
      const { paymentId, items, shipping_address, customer_name, customer_phone, total_amount, payment_method } = req.body;

      if (!items || !total_amount || !customer_name) {
        return res.status(400).json({
          error: '필수 정보가 누락되었습니다.',
          details: { items, total_amount, customer_name }
        });
      }

      console.log('결제 완료 처리 요청:', {
        paymentId,
        items,
        total_amount,
        payment_method
      });

      // 주문 데이터 준비
      const orderData = {
        customerId: req.body.customer_id || req.body.user_id, // 고객 ID
        sellerId: items[0]?.sellerId || req.body.seller_id, // 판매자 ID (첫 번째 상품의 판매자)
        totalAmount: total_amount,
        paymentMethod: payment_method || 'card',
        paymentId: paymentId,
        paymentStatus: payment_method === 'bank_transfer' ? 'awaiting_deposit' : 'paid',
        orderStatus: payment_method === 'bank_transfer' ? 'awaiting_deposit' : 'pending',
        shippingAddress: shipping_address,
        customerName: customer_name,
        customerPhone: customer_phone,
        notes: req.body.notes || '',
        items: items.map((item: any) => ({
          productId: item.productId || item.product_id,
          quantity: item.quantity,
          price: item.price,
          selectedOptions: item.selected_options || item.selectedOptions,
        })),
      };

      console.log('주문 데이터:', orderData);

      // DB에 주문 저장
      const order = await storage.createOrder(orderData);

      console.log('결제 완료 처리 성공:', order);

      res.json({
        success: true,
        order: order,
        message: payment_method === 'bank_transfer' 
          ? '주문이 접수되었습니다. 입금 확인 후 처리됩니다.' 
          : '결제가 완료되었습니다.'
      });

    } catch (error) {
      console.error('결제 완료 처리 오류:', error);
      res.status(500).json({
        error: '결제 처리 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      });
    }
  });

  // 포트원 웹훅 엔드포인트
  app.post('/api/payment/webhook', async (req: Request, res: Response) => {
    try {
      const { type, data } = req.body;
      
      console.log('포트원 웹훅 수신:', { type, data });

      if (type === 'Transaction.Paid') {
        // 결제 완료 웹훅 처리
        const paymentId = data.paymentId;
        console.log(`웹훅으로 결제 ${paymentId} 완료 처리`);
      }

      res.json({ success: true });
    } catch (error) {
      console.error('포트원 웹훅 처리 오류:', error);
      res.status(500).json({ error: '웹훅 처리 중 오류가 발생했습니다.' });
    }
  });

  // 결제 정보 조회 엔드포인트
  app.get('/api/payment/info/:paymentId', async (req: Request, res: Response) => {
    try {
      const { paymentId } = req.params;

      // 임시 결제 정보 반환
      const paymentInfo = {
        paymentId: paymentId,
        status: 'PAID',
        amount: 15000,
        method: 'CARD',
        paidAt: new Date().toISOString()
      };

      res.json(paymentInfo);

    } catch (error) {
      console.error('결제 정보 조회 오류:', error);
      res.status(500).json({ error: '결제 정보를 조회할 수 없습니다.' });
    }
  });
} 