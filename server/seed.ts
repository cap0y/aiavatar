import { storage } from "./storage.js";
import type { InsertService, InsertCareManager } from "../shared/schema.ts";

export async function seedSampleData() {
  // Seed services
  const existingServices = await storage.getAllServices();
  if (existingServices.length === 0) {
    const services: InsertService[] = [
      { name: "병원 동행", icon: "fas fa-hospital", color: "bg-gradient-to-br from-blue-500 to-cyan-500", description: "의료진과의 소통을 도와드리고 안전한 병원 방문을 지원합니다", averageDuration: "평균 3-4시간 소요" },
      { name: "장보기", icon: "fas fa-shopping-cart", color: "bg-gradient-to-br from-green-500 to-teal-500", description: "신선한 식재료와 생필품을 대신 구매해드립니다", averageDuration: "평균 2-3시간 소요" },
      { name: "가사 도움", icon: "fas fa-home", color: "bg-gradient-to-br from-purple-500 to-pink-500", description: "청소, 세탁, 정리정돈 등 집안일을 도와드립니다", averageDuration: "평균 4-5시간 소요" },
      { name: "말벗", icon: "fas fa-comments", color: "bg-gradient-to-br from-orange-500 to-red-500", description: "따뜻한 대화와 정서적 지원을 제공합니다", averageDuration: "평균 2-3시간 소요" },
    ];
    for (const s of services) {
      await storage.createService(s);
    }
  }

  const existingManagers = await storage.getAllCareManagers();
  if (existingManagers.length === 0) {
    const careManagers: InsertCareManager[] = [
      {
        name: "미라이",
        age: 28,
        rating: 50,
        reviews: 245,
        experience: "5년 이상",
        location: "서울 강남구",
        hourlyRate: 80000,
        services: ["VTuber 아바타", "2D 애니메이션", "Live2D 모델링"],
        certified: true,
        specialization: "VTuber 캐릭터 전문",
        imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120",
        description: "AI 기반 VTuber 아바타 제작 전문가입니다. 실시간 상호작용이 가능한 고품질 2D Live 모델을 제작합니다.",
      },
      {
        name: "사쿠라",
        age: 32,
        rating: 49,
        reviews: 189,
        experience: "7년 이상",
        location: "서울 서초구",
        hourlyRate: 100000,
        services: ["3D 아바타", "캐릭터 디자인", "모델링"],
        certified: true,
        specialization: "3D 아바타 & 애니메이션",
        imageUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120",
        description: "7년 경력의 3D 아바타 전문 크리에이터입니다. 메타버스 및 게임용 고품질 3D 모델을 제작합니다.",
      },
      {
        name: "하루카",
        age: 26,
        rating: 48,
        reviews: 312,
        experience: "4년 이상",
        location: "서울 마포구",
        hourlyRate: 70000,
        services: ["AI 음성 합성", "캐릭터 보이스", "더빙"],
        certified: true,
        specialization: "AI 음성 & 캐릭터 보이스",
        imageUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=120&h=120",
        description: "AI 음성 합성 및 캐릭터 보이스 전문가입니다. 자연스럽고 감정이 풍부한 AI 보이스를 제작합니다.",
      },
    ];
    for (const m of careManagers) {
      await storage.createCareManager(m);
    }
  }
} 