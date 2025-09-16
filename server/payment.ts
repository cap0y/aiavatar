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
      const { paymentId, items, shipping_address_id, total_amount } = req.body;

      if (!paymentId || !items || !total_amount) {
        return res.status(400).json({
          error: '필수 정보가 누락되었습니다.',
          details: { paymentId, items, total_amount }
        });
      }

      console.log('결제 완료 처리 요청:', {
        paymentId,
        items,
        total_amount
      });

      // 임시로 결제 성공 처리 (실제 환경에서는 포트원 API 검증 필요)
      // 포트원 API 검증을 원한다면 아래 주석을 해제하세요
      /*
      let payment;
      try {
        payment = await getPaymentFromPortOne(paymentId);
        console.log('포트원 결제 조회 결과:', payment);
      } catch (error) {
        console.error('포트원 결제 조회 오류:', error);
        return res.status(400).json({
          error: '결제 정보를 찾을 수 없습니다.',
          details: error instanceof Error ? error.message : '알 수 없는 오류'
        });
      }

      // 결제 상태 확인
      if (payment.status !== 'PAID') {
        return res.status(400).json({
          error: '결제가 완료되지 않았습니다.',
          paymentStatus: payment.status
        });
      }

      // 결제 금액 검증
      if (payment.amount?.total !== total_amount) {
        return res.status(400).json({
          error: '결제 금액이 일치하지 않습니다.',
          expected: total_amount,
          actual: payment.amount?.total || 0
        });
      }
      */

      // 임시 주문 생성 (실제로는 DB에 저장해야 함)
      const order = {
        id: Math.floor(Math.random() * 1000) + 1,
        payment_id: paymentId,
        total_amount: total_amount,
        status: 'paid',
        items: items,
        created_at: new Date().toISOString()
      };

      console.log('결제 완료 처리 성공:', order);

      res.json({
        success: true,
        order: order,
        message: '결제가 완료되었습니다.'
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