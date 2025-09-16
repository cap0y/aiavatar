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
        name: "김미영",
        age: 45,
        rating: 49,
        reviews: 127,
        experience: "5년",
        location: "서울 강남구",
        hourlyRate: 25000,
        services: ["병원 동행", "장보기"],
        certified: true,
        imageUrl: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=120&h=120",
        description: "5년간의 경험을 바탕으로 세심하고 전문적인 케어 서비스를 제공합니다.",
      },
      {
        name: "박정수",
        age: 52,
        rating: 48,
        reviews: 89,
        experience: "7년",
        location: "서울 송파구",
        hourlyRate: 23000,
        services: ["가사 도움", "말벗"],
        certified: true,
        imageUrl: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=120&h=120",
        description: "7년의 풍부한 경험으로 어르신들께 따뜻한 돌봄을 제공합니다.",
      },
      {
        name: "이순희",
        age: 48,
        rating: 47,
        reviews: 156,
        experience: "6년",
        location: "서울 마포구",
        hourlyRate: 24000,
        services: ["병원 동행", "말벗", "장보기"],
        certified: true,
        imageUrl: "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?auto=format&fit=crop&w=120&h=120",
        description: "다양한 서비스 경험을 통해 개인별 맞춤 케어를 제공합니다.",
      },
    ];
    for (const m of careManagers) {
      await storage.createCareManager(m);
    }
  }
} 