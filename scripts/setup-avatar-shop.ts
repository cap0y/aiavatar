import 'dotenv/config';
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { productCategories, products } from "../shared/schema";
import { eq } from "drizzle-orm";

// 데이터베이스 연결
const connectionString = process.env.DATABASE_URL || 
  "postgres://postgres:postgres@localhost:5432/postgres";

const sql = neon(connectionString);
const db = drizzle(sql);

async function setupAvatarShop() {
  try {
    console.log("아바타 상점 데이터 설정 시작...");

    // 기존 데이터 정리
    console.log("기존 데이터 정리 중...");
    await db.delete(products);
    await db.delete(productCategories);

    // 아바타 카테고리 삽입
    console.log("카테고리 데이터 삽입 중...");
    const categoryData = [
      { id: 1, name: '전체', description: '모든 아바타 캐릭터', categoryOrder: 0 },
      { id: 2, name: 'VTuber', description: 'VTuber 스타일 아바타 캐릭터', categoryOrder: 1 },
      { id: 3, name: '애니메이션', description: '애니메이션 스타일 아바타', categoryOrder: 2 },
      { id: 4, name: '리얼리스틱', description: '사실적인 스타일 아바타', categoryOrder: 3 },
      { id: 5, name: '판타지', description: '판타지 테마 아바타 캐릭터', categoryOrder: 4 },
      { id: 6, name: 'SF/미래', description: 'SF 및 미래형 아바타', categoryOrder: 5 },
      { id: 7, name: '동물/펫', description: '동물 및 펫 형태 아바타', categoryOrder: 6 },
      { id: 8, name: '커스텀', description: '맞춤 제작 아바타', categoryOrder: 7 },
      { id: 9, name: '액세서리', description: '아바타용 의상 및 액세서리', categoryOrder: 8 },
      { id: 10, name: '이모션팩', description: '아바타 감정 표현 팩', categoryOrder: 9 }
    ];

    for (const category of categoryData) {
      await db.insert(productCategories).values(category);
    }

    // 아바타 상품 삽입
    console.log("상품 데이터 삽입 중...");
    const productData = [
      // VTuber 카테고리
      {
        id: 1,
        categoryId: 2,
        name: '미라이 - VTuber 아바타',
        description: 'AI 기반 상호작용이 가능한 미래형 VTuber 아바타입니다. 실시간 채팅과 감정 표현이 뛰어납니다.',
        price: '150000',
        discountPrice: '120000',
        stock: 10,
        images: JSON.stringify(["/images/2dmodel/1.png", "/images/2dmodel/2.png"]),
        isActive: true
      },
      {
        id: 2,
        categoryId: 2,
        name: '사쿠라 - 일본풍 VTuber',
        description: '전통적인 일본 스타일의 VTuber 아바타로 우아한 움직임과 다양한 의상을 제공합니다.',
        price: '130000',
        stock: 15,
        images: JSON.stringify(["/images/2dmodel/3.png"]),
        isActive: true
      },
      {
        id: 3,
        categoryId: 2,
        name: '테크노 - 사이버펑크 VTuber',
        description: '네온사인과 홀로그램 효과가 있는 사이버펑크 스타일 VTuber 아바타입니다.',
        price: '180000',
        discountPrice: '160000',
        stock: 8,
        images: JSON.stringify(["/images/2dmodel/4.png"]),
        isActive: true
      },
      // 애니메이션 카테고리
      {
        id: 4,
        categoryId: 3,
        name: '루나 - 마법소녀 아바타',
        description: '마법소녀 컨셉의 귀여운 애니메이션 스타일 아바타입니다. 마법 이펙트 포함.',
        price: '100000',
        discountPrice: '80000',
        stock: 20,
        images: JSON.stringify(["/images/2dmodel/5.gif"]),
        isActive: true
      },
      {
        id: 5,
        categoryId: 3,
        name: '카이토 - 학원물 주인공',
        description: '학원 애니메이션의 남성 주인공 스타일 아바타로 교복과 캐주얼 의상을 제공합니다.',
        price: '90000',
        stock: 25,
        images: JSON.stringify(["/images/2dmodel/6.png"]),
        isActive: true
      },
      // 리얼리스틱 카테고리
      {
        id: 6,
        categoryId: 4,
        name: '아리아 - 리얼 휴먼 아바타',
        description: '실제 인간과 구별하기 어려운 고품질 리얼리스틱 여성 아바타입니다.',
        price: '250000',
        discountPrice: '220000',
        stock: 5,
        images: JSON.stringify(["/images/2dmodel/7.png"]),
        isActive: true
      },
      {
        id: 7,
        categoryId: 4,
        name: '맥스 - 비즈니스 아바타',
        description: '비즈니스 미팅과 프레젠테이션에 적합한 전문적인 남성 아바타입니다.',
        price: '200000',
        stock: 12,
        images: JSON.stringify(["/images/2dmodel/1.png"]),
        isActive: true
      },
      // 판타지 카테고리
      {
        id: 8,
        categoryId: 5,
        name: '엘프 프린세스 - 아리엘',
        description: '우아한 엘프 공주 아바타로 마법 능력과 아름다운 의상을 제공합니다.',
        price: '140000',
        discountPrice: '120000',
        stock: 18,
        images: JSON.stringify(["/images/2dmodel/2.png"]),
        isActive: true
      },
      {
        id: 9,
        categoryId: 5,
        name: '드래곤 나이트 - 드레이크',
        description: '용의 힘을 가진 강력한 기사 아바타입니다. 용 변신 기능 포함.',
        price: '170000',
        stock: 10,
        images: JSON.stringify(["/images/2dmodel/3.png"]),
        isActive: true
      },
      // SF/미래 카테고리
      {
        id: 10,
        categoryId: 6,
        name: '사이보그 - 제로',
        description: '미래형 사이보그 아바타로 다양한 사이버네틱 강화 기능을 제공합니다.',
        price: '190000',
        discountPrice: '170000',
        stock: 7,
        images: JSON.stringify(["/images/2dmodel/4.png"]),
        isActive: true
      },
      // 동물/펫 카테고리
      {
        id: 11,
        categoryId: 7,
        name: '코기 - 귀여운 강아지',
        description: '사랑스러운 코기 강아지 아바타입니다. 다양한 표정과 동작을 지원합니다.',
        price: '80000',
        discountPrice: '70000',
        stock: 30,
        images: JSON.stringify(["/images/2dmodel/5.gif"]),
        isActive: true
      },
      {
        id: 12,
        categoryId: 7,
        name: '냥이 - 고양이 아바타',
        description: '우아하고 신비로운 고양이 아바타로 다양한 품종 스킨을 제공합니다.',
        price: '75000',
        stock: 35,
        images: JSON.stringify(["/images/2dmodel/6.png"]),
        isActive: true
      },
      // 액세서리 카테고리
      {
        id: 13,
        categoryId: 9,
        name: '홀로그램 윙즈',
        description: '아바타용 홀로그램 날개 액세서리입니다. 다양한 색상과 효과를 제공합니다.',
        price: '25000',
        discountPrice: '20000',
        stock: 100,
        images: JSON.stringify(["/images/2dmodel/7.png"]),
        isActive: true
      },
      {
        id: 14,
        categoryId: 9,
        name: '마법 지팡이 세트',
        description: '다양한 마법 지팡이와 마법진 이펙트가 포함된 액세서리 세트입니다.',
        price: '35000',
        stock: 80,
        images: JSON.stringify(["/images/2dmodel/1.png"]),
        isActive: true
      },
      // 이모션팩 카테고리
      {
        id: 15,
        categoryId: 10,
        name: '기본 감정 표현 팩',
        description: '기쁨, 슬픔, 화남, 놀람 등 기본적인 감정 표현이 포함된 팩입니다.',
        price: '15000',
        discountPrice: '12000',
        stock: 200,
        images: JSON.stringify(["/images/2dmodel/2.png"]),
        isActive: true
      },
      {
        id: 16,
        categoryId: 10,
        name: '프리미엄 감정 팩',
        description: '섬세한 감정 변화와 특수 표정이 포함된 고급 감정 표현 팩입니다.',
        price: '30000',
        discountPrice: '25000',
        stock: 150,
        images: JSON.stringify(["/images/2dmodel/3.png"]),
        isActive: true
      }
    ];

    for (const product of productData) {
      await db.insert(products).values(product);
    }

    console.log("아바타 상점 데이터 설정 완료!");
    console.log(`- ${categoryData.length}개 카테고리 추가됨`);
    console.log(`- ${productData.length}개 상품 추가됨`);

  } catch (error) {
    console.error("아바타 상점 데이터 설정 중 오류 발생:", error);
    throw error;
  }
}

// 스크립트 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  setupAvatarShop()
    .then(() => {
      console.log("스크립트 실행 완료");
      process.exit(0);
    })
    .catch((error) => {
      console.error("스크립트 실행 실패:", error);
      process.exit(1);
    });
}

export default setupAvatarShop; 