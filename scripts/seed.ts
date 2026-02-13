import { db } from "../server/db";
import { services, careManagers } from "@shared/schema";

async function seed() {
  console.log("🌱 시딩 시작...");

  // 기존 데이터 삭제 (선택사항)
  await db.delete(careManagers);
  await db.delete(services);

  // 서비스 데이터 삽입
  const serviceData = [
    {
      name: '병원 동행',
      icon: 'fas fa-hospital',
      color: 'bg-gradient-to-br from-blue-500 to-cyan-500',
      description: '의료진과의 소통을 도와드리고 안전한 병원 방문을 지원합니다',
      averageDuration: '평균 3-4시간 소요'
    },
    {
      name: '장보기',
      icon: 'fas fa-shopping-cart',
      color: 'bg-gradient-to-br from-green-500 to-teal-500',
      description: '신선한 식재료와 생필품을 대신 구매해드립니다',
      averageDuration: '평균 2-3시간 소요'
    },
    {
      name: '가사 도움',
      icon: 'fas fa-home',
      color: 'bg-gradient-to-br from-purple-500 to-pink-500',
      description: '청소, 세탁, 정리정돈 등 집안일을 도와드립니다',
      averageDuration: '평균 4-5시간 소요'
    },
    {
      name: '말벗',
      icon: 'fas fa-comments',
      color: 'bg-gradient-to-br from-orange-500 to-red-500',
      description: '따뜻한 대화와 정서적 지원을 제공합니다',
      averageDuration: '평균 2-3시간 소요'
    }
  ];

  console.log("📝 서비스 데이터 삽입 중...");
  await db.insert(services).values(serviceData);

  // 크리에이터데이터 삽입
  const careManagerData = [
    {
      name: '김미영',
      age: 45,
      rating: 49, // 4.9
      reviews: 127,
      experience: '15년 경력의 베테랑 케어매니저',
      location: '서울 강남구',
      hourlyRate: 25000,
      services: ["병원 동행", "장보기"],
      certified: true,
      description: '오랜 경험을 바탕으로 세심한 케어를 제공합니다.',
      imageUrl: null
    },
    {
      name: '박정수',
      age: 38,
      rating: 47, // 4.7
      reviews: 89,
      experience: '10년 경력, 의료진과의 소통 전문',
      location: '서울 서초구',
      hourlyRate: 23000,
      services: ["병원 동행", "말벗"],
      certified: true,
      description: '환자분들과의 따뜻한 소통을 중시합니다.',
      imageUrl: null
    },
    {
      name: '이순희',
      age: 52,
      rating: 48, // 4.8
      reviews: 156,
      experience: '20년 경력의 가사 전문 케어매니저',
      location: '서울 송파구',
      hourlyRate: 22000,
      services: ["가사 도움", "장보기"],
      certified: true,
      description: '깨끗하고 체계적인 가사 관리를 도와드립니다.',
      imageUrl: null
    },
    {
      name: '최영호',
      age: 43,
      rating: 46, // 4.6
      reviews: 73,
      experience: '8년 경력, 남성 케어매니저',
      location: '서울 마포구',
      hourlyRate: 24000,
      services: ["병원 동행", "장보기", "말벗"],
      certified: true,
      description: '남성 고객분들께 편안한 케어 서비스를 제공합니다.',
      imageUrl: null
    },
    {
      name: '한소영',
      age: 29,
      rating: 45, // 4.5
      reviews: 42,
      experience: '3년 경력의 젊은 케어매니저',
      location: '서울 용산구',
      hourlyRate: 20000,
      services: ["말벗", "가사 도움"],
      certified: false,
      description: '활발하고 밝은 성격으로 즐거운 시간을 만들어드립니다.',
      imageUrl: null
    }
  ];

  console.log("👩‍⚕️ 크리에이터데이터 삽입 중...");
  await db.insert(careManagers).values(careManagerData);

  console.log("✅ 시딩 완료!");
  process.exit(0);
}

seed().catch((error) => {
  console.error("❌ 시딩 에러:", error);
  process.exit(1);
});