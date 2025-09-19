// @ts-nocheck
import { db } from "./db.js";
import { users, careManagers, services, bookings, messages, type User, type InsertUser, type CareManager, type InsertCareManager, type Service, type InsertService, type Booking, type InsertBooking, type Message, type InsertMessage, notices, type InsertNotice, products, productCategories, type Product, type InsertProduct, type ProductCategory, type InsertProductCategory, favorites, inquiries, userNotificationSettings, userPrivacySettings, type Favorite, type InsertFavorite, type Inquiry, type InsertInquiry, type UserNotificationSettings, type InsertUserNotificationSettings, type UserPrivacySettings, type InsertUserPrivacySettings, productReviews, type InsertProductReview, type ProductReview, productComments, type InsertProductComment, type ProductComment, UserType, UserGrade, cartItems, type CartItem, type InsertCartItem } from "../shared/schema.ts";
import { and, asc, desc, eq, like, or, sql, ilike, gte, lte } from "drizzle-orm";

// 메모리 기반 아바타 카테고리 데이터 (1.sql 파일 기준)
const memoryProductCategories = [
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

// 메모리 기반 아바타 상품 데이터 (1.sql 파일 기준)
const memoryProducts = [
  // VTuber 카테고리
  {
    id: 1,
    title: '미라이 - VTuber 아바타',
    description: 'AI 기반 상호작용이 가능한 미래형 VTuber 아바타입니다. 실시간 채팅과 감정 표현이 뛰어납니다.',
    price: 150000,
    discountPrice: 120000,
    stock: 10,
    images: JSON.stringify(["/images/2dmodel/1.png", "/images/2dmodel/2.png"]),
    sellerId: 1,
    categoryId: 2,
    category: 'VTuber',
    status: 'active',
    rating: 4.8,
    reviewCount: 24,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 2,
    title: '사쿠라 - 일본풍 VTuber',
    description: '전통적인 일본 스타일의 VTuber 아바타로 우아한 움직임과 다양한 의상을 제공합니다.',
    price: 130000,
    discountPrice: null,
    stock: 15,
    images: JSON.stringify(["/images/2dmodel/3.png"]),
    sellerId: 1,
    categoryId: 2,
    category: 'VTuber',
    status: 'active',
    rating: 4.6,
    reviewCount: 18,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 3,
    title: '테크노 - 사이버펑크 VTuber',
    description: '네온사인과 홀로그램 효과가 있는 사이버펑크 스타일 VTuber 아바타입니다.',
    price: 180000,
    discountPrice: 160000,
    stock: 8,
    images: JSON.stringify(["/images/2dmodel/4.png"]),
    sellerId: 1,
    categoryId: 2,
    category: 'VTuber',
    status: 'active',
    rating: 4.9,
    reviewCount: 31,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  // 애니메이션 카테고리
  {
    id: 4,
    title: '루나 - 마법소녀 아바타',
    description: '마법소녀 컨셉의 귀여운 애니메이션 스타일 아바타입니다. 마법 이펙트 포함.',
    price: 100000,
    discountPrice: 80000,
    stock: 20,
    images: JSON.stringify(["/images/2dmodel/5.gif"]),
    sellerId: 1,
    categoryId: 3,
    category: '애니메이션',
    status: 'active',
    rating: 4.7,
    reviewCount: 42,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 5,
    title: '카이토 - 학원물 주인공',
    description: '학원 애니메이션의 남성 주인공 스타일 아바타로 교복과 캐주얼 의상을 제공합니다.',
    price: 90000,
    discountPrice: null,
    stock: 25,
    images: JSON.stringify(["/images/2dmodel/6.png"]),
    sellerId: 1,
    categoryId: 3,
    category: '애니메이션',
    status: 'active',
    rating: 4.5,
    reviewCount: 33,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  // 리얼리스틱 카테고리
  {
    id: 6,
    title: '아리아 - 리얼 휴먼 아바타',
    description: '실제 인간과 구별하기 어려운 고품질 리얼리스틱 여성 아바타입니다.',
    price: 250000,
    discountPrice: 220000,
    stock: 5,
    images: JSON.stringify(["/images/2dmodel/7.png"]),
    sellerId: 1,
    categoryId: 4,
    category: '리얼리스틱',
    status: 'active',
    rating: 4.9,
    reviewCount: 15,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 7,
    title: '맥스 - 비즈니스 아바타',
    description: '비즈니스 미팅과 프레젠테이션에 적합한 전문적인 남성 아바타입니다.',
    price: 200000,
    discountPrice: null,
    stock: 12,
    images: JSON.stringify(["/images/2dmodel/1.png"]),
    sellerId: 1,
    categoryId: 4,
    category: '리얼리스틱',
    status: 'active',
    rating: 4.6,
    reviewCount: 21,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  // 판타지 카테고리
  {
    id: 8,
    title: '엘프 프린세스 - 아리엘',
    description: '우아한 엘프 공주 아바타로 마법 능력과 아름다운 의상을 제공합니다.',
    price: 140000,
    discountPrice: 120000,
    stock: 18,
    images: JSON.stringify(["/images/2dmodel/2.png"]),
    sellerId: 1,
    categoryId: 5,
    category: '판타지',
    status: 'active',
    rating: 4.8,
    reviewCount: 27,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 9,
    title: '드래곤 나이트 - 드레이크',
    description: '용의 힘을 가진 강력한 기사 아바타입니다. 용 변신 기능 포함.',
    price: 170000,
    discountPrice: null,
    stock: 10,
    images: JSON.stringify(["/images/2dmodel/3.png"]),
    sellerId: 1,
    categoryId: 5,
    category: '판타지',
    status: 'active',
    rating: 4.7,
    reviewCount: 19,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  // SF/미래 카테고리
  {
    id: 10,
    title: '사이보그 - 제로',
    description: '미래형 사이보그 아바타로 다양한 사이버네틱 강화 기능을 제공합니다.',
    price: 190000,
    discountPrice: 170000,
    stock: 7,
    images: JSON.stringify(["/images/2dmodel/4.png"]),
    sellerId: 1,
    categoryId: 6,
    category: 'SF/미래',
    status: 'active',
    rating: 4.8,
    reviewCount: 22,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  // 동물/펫 카테고리
  {
    id: 11,
    title: '코기 - 귀여운 강아지',
    description: '사랑스러운 코기 강아지 아바타입니다. 다양한 표정과 동작을 지원합니다.',
    price: 80000,
    discountPrice: 70000,
    stock: 30,
    images: JSON.stringify(["/images/2dmodel/5.gif"]),
    sellerId: 1,
    categoryId: 7,
    category: '동물/펫',
    status: 'active',
    rating: 4.9,
    reviewCount: 56,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 12,
    title: '냥이 - 고양이 아바타',
    description: '우아하고 신비로운 고양이 아바타로 다양한 품종 스킨을 제공합니다.',
    price: 75000,
    discountPrice: null,
    stock: 35,
    images: JSON.stringify(["/images/2dmodel/6.png"]),
    sellerId: 1,
    categoryId: 7,
    category: '동물/펫',
    status: 'active',
    rating: 4.7,
    reviewCount: 41,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  // 액세서리 카테고리
  {
    id: 13,
    title: '홀로그램 윙즈',
    description: '아바타용 홀로그램 날개 액세서리입니다. 다양한 색상과 효과를 제공합니다.',
    price: 25000,
    discountPrice: 20000,
    stock: 100,
    images: JSON.stringify(["/images/2dmodel/7.png"]),
    sellerId: 1,
    categoryId: 9,
    category: '액세서리',
    status: 'active',
    rating: 4.6,
    reviewCount: 73,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 14,
    title: '마법 지팡이 세트',
    description: '다양한 마법 지팡이와 마법진 이펙트가 포함된 액세서리 세트입니다.',
    price: 35000,
    discountPrice: null,
    stock: 80,
    images: JSON.stringify(["/images/2dmodel/1.png"]),
    sellerId: 1,
    categoryId: 9,
    category: '액세서리',
    status: 'active',
    rating: 4.8,
    reviewCount: 65,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  // 이모션팩 카테고리
  {
    id: 15,
    title: '기본 감정 표현 팩',
    description: '기쁨, 슬픔, 화남, 놀람 등 기본적인 감정 표현이 포함된 팩입니다.',
    price: 15000,
    discountPrice: 12000,
    stock: 200,
    images: JSON.stringify(["/images/2dmodel/2.png"]),
    sellerId: 1,
    categoryId: 10,
    category: '이모션팩',
    status: 'active',
    rating: 4.5,
    reviewCount: 89,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 16,
    title: '프리미엄 감정 팩',
    description: '섬세한 감정 변화와 특수 표정이 포함된 고급 감정 표현 팩입니다.',
    price: 30000,
    discountPrice: 25000,
    stock: 150,
    images: JSON.stringify(["/images/2dmodel/3.png"]),
    sellerId: 1,
    categoryId: 10,
    category: '이모션팩',
    status: 'active',
    rating: 4.9,
    reviewCount: 112,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// UserType, UserGrade는 상단 import에서 함께 가져옵니다.

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Care Manager operations
  getCareManager(id: number): Promise<CareManager | undefined>;
  getAllCareManagers(): Promise<CareManager[]>;
  getCareManagersByService(serviceId: number): Promise<CareManager[]>;
  createCareManager(careManager: InsertCareManager): Promise<CareManager>;
  updateCareManager(id: number, payload: Partial<CareManager>): Promise<CareManager | undefined>;
  getUsers(): Promise<User[]>;
  getAllBookings(): Promise<Booking[]>;
  
  // Dispute operations (간단 버전)
  getAllDisputes(): Promise<any[]>;
  updateDisputeStatus(id: number, status: string): Promise<any | undefined>;
  
  // Notice operations
  getAllNotices(): Promise<any[]>;
  createNotice(notice: { title: string; content: string }): Promise<any>;
  updateNotice(id: number, payload: Partial<any>): Promise<any | undefined>;
  deleteNotice(id: number): Promise<boolean>;
  
  // Service operations
  getService(id: number): Promise<Service | undefined>;
  getAllServices(): Promise<Service[]>;
  createService(service: InsertService): Promise<Service>;
  
  // Booking operations
  getBooking(id: number): Promise<Booking | undefined>;
  getBookingsByUser(userId: string): Promise<Booking[]>;
  getBookingsByCareManager(careManagerId: number): Promise<Booking[]>;
  getBookingsByCareManagerAndDate(careManagerId: number, date: string): Promise<Booking[]>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBookingStatus(id: number | string, status: string): Promise<Booking | undefined>;
  
  // Message operations
  getMessagesBetweenUsers(userId1: number, userId2: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(id: number): Promise<Message | undefined>;

  // Product operations
  getProduct(id: number): Promise<Product | undefined>;
  getAllProducts(params?: { sellerId?: number; categoryId?: number; category?: string; search?: string; limit?: number; offset?: number }): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, payload: Partial<Product>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;

  // Product Category operations
  getProductCategory(id: number): Promise<ProductCategory | undefined>;
  getAllProductCategories(): Promise<ProductCategory[]>;
  createProductCategory(category: InsertProductCategory): Promise<ProductCategory>;
  updateProductCategory(id: number, payload: Partial<ProductCategory>): Promise<ProductCategory | undefined>;
  deleteProductCategory(id: number): Promise<boolean>;

  // Favorites operations
  getFavorites(userId: string): Promise<Favorite[]>;
  addFavorite(favorite: InsertFavorite): Promise<Favorite>;
  removeFavorite(id: number): Promise<boolean>;
  
  // Inquiries operations
  getAllInquiries(): Promise<Inquiry[]>;
  getUserInquiries(userId: string): Promise<Inquiry[]>;
  createInquiry(inquiry: InsertInquiry): Promise<Inquiry>;
  answerInquiry(id: number, answer: string, answeredBy: string): Promise<Inquiry | undefined>;
  updateInquiryStatus(id: number, status: string): Promise<Inquiry | undefined>;
  
  // User settings operations
  getUserNotificationSettings(userId: string): Promise<UserNotificationSettings | undefined>;
  updateUserNotificationSettings(userId: string, settings: Partial<UserNotificationSettings>): Promise<UserNotificationSettings>;
  getUserPrivacySettings(userId: string): Promise<UserPrivacySettings | undefined>;
  updateUserPrivacySettings(userId: string, settings: Partial<UserPrivacySettings>): Promise<UserPrivacySettings>;

  // Order management operations
  getAllOrders(): Promise<any[]>;
  createOrder(orderData: any): Promise<any>;
  updateOrderStatus(orderId: string, status: string): Promise<any | undefined>;
  updateOrderShipping(orderId: string, trackingNumber: string, shippingCompany: string): Promise<any | undefined>;

  // Admin notifications operations
  getAdminNotifications(): Promise<any[]>;
  createAdminNotification(notification: { type: string; message: string; order_id?: string; reference_id?: string; }): Promise<any>;
  markAdminNotificationAsRead(notificationId: string): Promise<any | undefined>;
  
  // 상품 리뷰 관련
  getProductReviews(productId: number): Promise<ProductReview[]>;
  getUserProductReviews(userId: number): Promise<ProductReview[]>;
  createProductReview(review: InsertProductReview): Promise<ProductReview>;
  updateProductReview(id: number, payload: Partial<ProductReview>): Promise<ProductReview | undefined>;
  deleteProductReview(id: number): Promise<boolean>;
  checkUserPurchase(userId: number, productId: number): Promise<boolean>;
  
  // 상품 문의 관련
  getProductComments(productId: number): Promise<ProductComment[]>;
  getUserProductComments(userId: number): Promise<ProductComment[]>;
  createProductComment(comment: InsertProductComment): Promise<ProductComment>;
  createProductCommentReply(comment: InsertProductComment): Promise<ProductComment>;
  updateProductComment(id: number, payload: Partial<ProductComment>): Promise<ProductComment | undefined>;
  deleteProductComment(id: number): Promise<boolean>;

  // 소개글 콘텐츠 관련
  updateCareManagerIntroContents(careManagerId: number, introContents: any[]): Promise<boolean>;
  getCareManagerIntroContents(careManagerId: number): Promise<any[] | null>;

  // Cart operations
  getCartItems(userId: number): Promise<CartItem[]>;
  getCartItemsByFirebaseId(firebaseUid: string): Promise<CartItem[]>;
  findCartItem(userId: number, productId: number, selectedOptions: any | null): Promise<CartItem | undefined>;
  findCartItemByFirebaseId(firebaseUid: string, productId: number, selectedOptions: any | null): Promise<CartItem | undefined>;
  addCartItem(cart: InsertCartItem): Promise<CartItem>;
  addCartItemByFirebaseId(firebaseUid: string, productId: number, quantity: number, selectedOptions: any | null): Promise<CartItem>;
  updateCartItem(id: number, payload: Partial<CartItem>): Promise<CartItem | undefined>;
  removeCartItem(id: number): Promise<boolean>;
  clearCart(userId: number): Promise<boolean>;
  clearCartByFirebaseId(firebaseUid: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private careManagers: Map<number, CareManager>;
  private services: Map<number, Service>;
  private bookings: Map<number, Booking>;
  private disputes: Map<number, any>;
  private notices: Map<number, any>;
  private messages: Map<number, Message>;
  private products: Map<number, Product>;
  private productCategories: Map<number, ProductCategory>;
  private favorites: Map<number, Favorite>;
  private inquiries: Map<number, Inquiry>;
  private userNotificationSettings: Map<string, UserNotificationSettings>;
  private userPrivacySettings: Map<string, UserPrivacySettings>;
  private orders: Map<string, any>;
  private adminNotifications: Map<string, any>;
  private productReviews: Map<number, ProductReview>;
  private productComments: Map<number, ProductComment>;
  private cartItemsStore: Map<number, CartItem>;

  private currentUserId: number;
  private currentCareManagerId: number;
  private currentServiceId: number;
  private currentBookingId: number;
  private currentMessageId: number;
  private currentDisputeId: number;
  private currentNoticeId: number;
  private currentProductId: number;
  private currentProductCategoryId: number;
  private currentFavoriteId: number;
  private currentInquiryId: number;
  private currentAdminNotificationId: number;
  private currentProductReviewId: number;
  private currentProductCommentId: number;
  private currentCartItemId: number;

  constructor() {
    this.users = new Map();
    this.careManagers = new Map();
    this.services = new Map();
    this.bookings = new Map();
    this.disputes = new Map();
    this.notices = new Map();
    this.messages = new Map();
    this.products = new Map();
    this.productCategories = new Map();
    this.favorites = new Map();
    this.inquiries = new Map();
    this.userNotificationSettings = new Map();
    this.userPrivacySettings = new Map();
    this.orders = new Map();
    this.adminNotifications = new Map();
    this.productReviews = new Map();
    this.productComments = new Map();
    this.cartItemsStore = new Map();
    this.currentUserId = 1;
    this.currentCareManagerId = 1;
    this.currentServiceId = 1;
    this.currentBookingId = 1;
    this.currentMessageId = 1;
    this.currentDisputeId = 1;
    this.currentNoticeId = 1;
    this.currentProductId = 1;
    this.currentProductCategoryId = 1;
    this.currentFavoriteId = 1;
    this.currentInquiryId = 1;
    this.currentAdminNotificationId = 1;
    this.currentProductReviewId = 1;
    this.currentProductCommentId = 1;
    this.currentCartItemId = 1;
    
    this.initializeData();
    // 샘플 데이터 생성 메서드들 제거
    // this.initializeSampleBookings();
    // this.initializeSampleDisputes();
    // this.initializeSampleProducts();
  }

  private initializeData() {
    // Initialize services
    const servicesData = [
      { name: '병원 동행', icon: 'fas fa-hospital', color: 'bg-gradient-to-br from-blue-500 to-cyan-500', description: '의료진과의 소통을 도와드리고 안전한 병원 방문을 지원합니다', averageDuration: '평균 3-4시간 소요' },
      { name: '장보기', icon: 'fas fa-shopping-cart', color: 'bg-gradient-to-br from-green-500 to-teal-500', description: '신선한 식재료와 생필품을 대신 구매해드립니다', averageDuration: '평균 2-3시간 소요' },
      { name: '가사 도움', icon: 'fas fa-home', color: 'bg-gradient-to-br from-purple-500 to-pink-500', description: '청소, 세탁, 정리정돈 등 집안일을 도와드립니다', averageDuration: '평균 4-5시간 소요' },
      { name: '말벗', icon: 'fas fa-comments', color: 'bg-gradient-to-br from-orange-500 to-red-500', description: '따뜻한 대화와 정서적 지원을 제공합니다', averageDuration: '평균 2-3시간 소요' }
    ];

    servicesData.forEach(service => {
      const newService: Service = {
        id: this.currentServiceId++,
        ...service
      };
      this.services.set(newService.id, newService);
    });

    // Initialize care managers
    const careManagersData = [
      {
        name: '김미영',
        age: 45,
        rating: 49, // 4.9
        reviews: 127,
        experience: '5년',
        location: '서울 강남구',
        hourlyRate: 25000,
        services: ['병원 동행', '장보기'],
        certified: true,
        imageUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=120&h=120',
        description: '5년간의 경험을 바탕으로 세심하고 전문적인 케어 서비스를 제공합니다.'
      },
      {
        name: '박정수',
        age: 52,
        rating: 48, // 4.8
        reviews: 89,
        experience: '7년',
        location: '서울 송파구',
        hourlyRate: 23000,
        services: ['가사 도움', '말벗'],
        certified: true,
        imageUrl: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=120&h=120',
        description: '7년의 풍부한 경험으로 어르신들께 따뜻한 돌봄을 제공합니다.'
      },
      {
        name: '이순희',
        age: 48,
        rating: 47, // 4.7
        reviews: 156,
        experience: '6년',
        location: '서울 마포구',
        hourlyRate: 24000,
        services: ['병원 동행', '말벗', '장보기'],
        certified: true,
        imageUrl: 'https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=120&h=120',
        description: '다양한 서비스 경험을 통해 개인별 맞춤 케어를 제공합니다.'
      }
    ];

    careManagersData.forEach(manager => {
      const newManager: CareManager = {
        id: this.currentCareManagerId++,
        ...manager,
        isApproved: true, // isApproved 속성 추가
        createdAt: new Date(), // createdAt 속성 추가
        introContents: null,
      };
      this.careManagers.set(newManager.id, newManager);
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user: User = {
      id: this.currentUserId++,
      ...insertUser,
      phone: insertUser.phone || null,
      userType: (insertUser.userType as UserType) || 'customer',
      grade: (insertUser.grade as UserGrade) || 'bronze',
      isApproved: insertUser.isApproved ?? false,
      isCertified: insertUser.isCertified ?? null, // undefined를 null로 변환
      certificationDate: insertUser.certificationDate ?? null, // undefined를 null로 변환  
      certificationPaymentId: insertUser.certificationPaymentId ?? null, // undefined를 null로 변환
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(user.id, user);
    return user;
  }

  // Care Manager operations
  async getCareManager(id: number): Promise<CareManager | undefined> {
    return this.careManagers.get(id);
  }

  async getAllCareManagers(): Promise<CareManager[]> {
    return Array.from(this.careManagers.values());
  }

  async getCareManagersByService(serviceId: number): Promise<CareManager[]> {
    const service = this.services.get(serviceId);
    if (!service) return [];
    
    return Array.from(this.careManagers.values()).filter(manager => 
      (manager.services as string[]).includes(service.name)
    );
  }

  async createCareManager(insertCareManager: InsertCareManager): Promise<CareManager> {
    const careManager: CareManager = {
      id: this.currentCareManagerId++,
      ...insertCareManager,
      description: insertCareManager.description || null,
      imageUrl: insertCareManager.imageUrl || null,
      reviews: 0,
      certified: insertCareManager.certified || false,
      isApproved: true,
      createdAt: new Date(),
      introContents: null,
    };
    this.careManagers.set(careManager.id, careManager);
    return careManager;
  }

  // 케어매니저 정보 업데이트
  async updateCareManager(id: number, payload: Partial<CareManager>): Promise<CareManager | undefined> {
    const manager = this.careManagers.get(id);
    if (!manager) return undefined;
    const updated: CareManager = {
      ...manager,
      ...payload,
    } as CareManager;
    this.careManagers.set(id, updated);
    return updated;
  }

  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getAllBookings(): Promise<Booking[]> {
    return Array.from(this.bookings.values());
  }

  // Dispute operations
  async getAllDisputes(): Promise<any[]> {
    return Array.from(this.disputes.values());
  }

  async updateDisputeStatus(id:number, status:string) {
    const dispute=this.disputes.get(id);
    if(!dispute) return undefined;
    dispute.status=status;
    this.disputes.set(id,dispute);
    return dispute;
  }

  // Notice operations
  async getAllNotices(): Promise<any[]> {
    return Array.from(this.notices.values()).sort((a,b)=> b.id - a.id);
  }

  async createNotice({title,content}:{title:string;content:string}) {
    const notice={id:this.currentNoticeId++,title,content,date:new Date().toISOString().slice(0,10)};
    this.notices.set(notice.id,notice);
    return notice;
  }

  async updateNotice(id:number,payload:Partial<any>) {
    const n=this.notices.get(id); if(!n) return undefined;
    const updated={...n,...payload};
    this.notices.set(id,updated); return updated;
  }

  async deleteNotice(id:number){
    return this.notices.delete(id);
  }

  // Service operations
  async getService(id: number): Promise<Service | undefined> {
    return this.services.get(id);
  }

  async getAllServices(): Promise<Service[]> {
    return Array.from(this.services.values());
  }

  async createService(insertService: InsertService): Promise<Service> {
    const service: Service = {
      id: this.currentServiceId++,
      ...insertService,
      description: insertService.description || null,
      averageDuration: insertService.averageDuration || null
    };
    this.services.set(service.id, service);
    return service;
  }

  // Booking operations
  async getBooking(id: number): Promise<Booking | undefined> {
    return this.bookings.get(id);
  }

  async getBookingsByUser(userId: string): Promise<Booking[]> {
    // 모든 예약 데이터 가져오기
    const allBookings = Array.from(this.bookings.values());
    
    // userId 비교 시 문자열 변환하여 비교
    const result = allBookings.filter(booking => {
      const bookingUserId = String(booking.userId);
      const searchUserId = String(userId);
      return bookingUserId === searchUserId;
    });
    
    return result;
  }

  async getBookingsByCareManager(careManagerId: number): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter(
      (booking) => booking.careManagerId === careManagerId
    );
  }
  
  async getBookingsByCareManagerAndDate(careManagerId: number, date: string): Promise<Booking[]> {
    // date가 "YYYY-MM-DD" 형식이므로 해당 날짜의 시작과 끝을 계산
    const startDate = new Date(`${date}T00:00:00.000Z`);
    const endDate = new Date(`${date}T23:59:59.999Z`);
    
    return Array.from(this.bookings.values()).filter(booking => 
      booking.careManagerId === careManagerId &&
      booking.date >= startDate &&
      booking.date <= endDate
    );
  }

  async createBooking(insertBooking: InsertBooking): Promise<Booking> {
    const booking: Booking = {
      id: this.currentBookingId++,
      ...insertBooking,
      status: insertBooking.status || "pending",
      notes: insertBooking.notes || null,
      createdAt: new Date()
    };
    this.bookings.set(booking.id, booking);
    return booking;
  }

  async updateBookingStatus(id: number | string, status: string): Promise<Booking | undefined> {
    // number 타입으로 변환해서 처리
    const numId = typeof id === 'string' ? parseInt(id) : id;
    const booking = this.bookings.get(numId);
    if (!booking) return undefined;
    
    const updatedBooking = { ...booking, status };
    this.bookings.set(numId, updatedBooking);
    return updatedBooking;
  }

  // Message operations
  async getMessagesBetweenUsers(userId1: number, userId2: number): Promise<Message[]> {
    return Array.from(this.messages.values()).filter(message => 
      (message.senderId === userId1 && message.receiverId === userId2) ||
      (message.senderId === userId2 && message.receiverId === userId1)
    ).sort((a, b) => (a.timestamp?.getTime() || 0) - (b.timestamp?.getTime() || 0));
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const message: Message = {
      id: this.currentMessageId++,
      ...insertMessage,
      timestamp: new Date(),
      isRead: false
    };
    this.messages.set(message.id, message);
    return message;
  }

  async markMessageAsRead(id: number): Promise<Message | undefined> {
    const message = this.messages.get(id);
    if (!message) return undefined;
    
    const updatedMessage = { ...message, isRead: true };
    this.messages.set(id, updatedMessage);
    return updatedMessage;
  }

  // Product operations
  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async getAllProducts(params?: { sellerId?: number; categoryId?: number; category?: string; search?: string; limit?: number; offset?: number }): Promise<Product[]> {
    let result = Array.from(this.products.values());

    if (params?.sellerId) {
      result = result.filter(product => product.sellerId === params.sellerId);
    }

    if (params?.categoryId) {
      result = result.filter(product => product.categoryId === params.categoryId);
    }

    // 카테고리 이름으로 필터링 (MemStorage에서는 매핑 필요)
    if (params?.category) {
      const categoryMapping: { [key: string]: number } = {
        "가공식품": 2,
        "건강식품": 3,
        "기타": 4,
        "농산물": 5,
        "디지털상품": 6,
        "생활용품": 7,
        "수산물": 8,
        "전자제품": 9,
        "주류": 10,
        "축산물": 11,
        "취미/게임": 12,
        "카페/베이커리": 13,
        "패션": 14,
        "하드웨어": 15
      };
      
      const categoryId = categoryMapping[params.category];
      if (categoryId) {
        result = result.filter(product => product.categoryId === categoryId);
      }
    }

    // 검색어 필터링
    if (params?.search) {
      const searchLower = params.search.toLowerCase();
      result = result.filter(product => 
        product.title.toLowerCase().includes(searchLower) ||
        product.description?.toLowerCase().includes(searchLower)
      );
    }

    // 최신순 정렬
    result.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));

    // 페이지네이션
    if (params?.offset) {
      result = result.slice(params.offset);
    }
    if (params?.limit) {
      result = result.slice(0, params.limit);
    }

    return result;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const product: Product = {
      id: this.currentProductId++,
      sellerId: insertProduct.sellerId || null,
      categoryId: insertProduct.categoryId || null,
      title: insertProduct.title,
      description: insertProduct.description || null,
      price: insertProduct.price,
      discountPrice: insertProduct.discountPrice || null,
      stock: insertProduct.stock || 0,
      images: insertProduct.images || null,
      tags: insertProduct.tags || null,
      status: insertProduct.status || 'active',
      rating: null,
      reviewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.products.set(product.id, product);
    return product;
  }

  async updateProduct(id: number, payload: Partial<Product>): Promise<Product | undefined> {
    const product = this.products.get(id);
    if (!product) return undefined;
    
    const updatedProduct: Product = {
      ...product,
      ...payload,
      updatedAt: new Date()
    };
    this.products.set(id, updatedProduct);
    return updatedProduct;
  }

  async deleteProduct(id: number): Promise<boolean> {
    return this.products.delete(id);
  }

  // Product Category operations
  async getProductCategory(id: number): Promise<ProductCategory | undefined> {
    return this.productCategories.get(id);
  }

  async getAllProductCategories(): Promise<ProductCategory[]> {
    return Array.from(this.productCategories.values()).sort((a, b) => (a.categoryOrder || 0) - (b.categoryOrder || 0));
  }

  async createProductCategory(insertCategory: InsertProductCategory): Promise<ProductCategory> {
    const category: ProductCategory = {
      id: this.currentProductCategoryId++,
      ...insertCategory,
      description: insertCategory.description || null,
      parentId: insertCategory.parentId || null,
      imageUrl: insertCategory.imageUrl || null,
      isActive: insertCategory.isActive ?? true,
      categoryOrder: insertCategory.categoryOrder ?? 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.productCategories.set(category.id, category);
    return category;
  }

  async updateProductCategory(id: number, payload: Partial<ProductCategory>): Promise<ProductCategory | undefined> {
    const category = this.productCategories.get(id);
    if (!category) return undefined;
    
    const updatedCategory: ProductCategory = {
      ...category,
      ...payload,
      updatedAt: new Date()
    };
    this.productCategories.set(id, updatedCategory);
    return updatedCategory;
  }

  async deleteProductCategory(id: number): Promise<boolean> {
    return this.productCategories.delete(id);
  }

  // Favorites operations
  async getFavorites(userId: string): Promise<Favorite[]> {
    return Array.from(this.favorites.values()).filter(favorite => favorite.userId === userId);
  }

  async addFavorite(favorite: InsertFavorite): Promise<Favorite> {
    const newFavorite: Favorite = {
      id: this.currentFavoriteId++,
      ...favorite,
      createdAt: new Date(),
    } as any;
    this.favorites.set(newFavorite.id, newFavorite);
    return newFavorite;
  }

  async removeFavorite(id: number): Promise<boolean> {
    return this.favorites.delete(id);
  }

  // Inquiries operations
  async getAllInquiries(): Promise<Inquiry[]> {
    return Array.from(this.inquiries.values());
  }

  async getUserInquiries(userId: string): Promise<Inquiry[]> {
    return Array.from(this.inquiries.values()).filter(inquiry => inquiry.userId === userId);
  }

  async createInquiry(inquiry: InsertInquiry): Promise<Inquiry> {
    const newInquiry = {
      id: this.currentInquiryId++,
      userId: inquiry.userId,
      subject: inquiry.subject,
      category: inquiry.category,
      message: inquiry.message,
      urgency: (inquiry.urgency || 'normal') as string,
      status: 'pending' as string,
      answer: null as string | null,
      answeredBy: null as string | null,
      answeredAt: null as Date | null,
      createdAt: new Date() as Date | null,
      updatedAt: new Date() as Date | null
    } as Inquiry;
    this.inquiries.set(newInquiry.id, newInquiry);
    return newInquiry;
  }

  async answerInquiry(id: number, answer: string, answeredBy: string): Promise<Inquiry | undefined> {
    const inquiry = this.inquiries.get(id);
    if (!inquiry) return undefined;
    inquiry.answer = answer;
    inquiry.answeredBy = answeredBy;
    inquiry.answeredAt = new Date();
    inquiry.status = 'answered';
    inquiry.updatedAt = new Date();
    this.inquiries.set(id, inquiry);
    return inquiry;
  }

  async updateInquiryStatus(id: number, status: string): Promise<Inquiry | undefined> {
    const inquiry = this.inquiries.get(id);
    if (!inquiry) return undefined;
    inquiry.status = status;
    inquiry.updatedAt = new Date();
    this.inquiries.set(id, inquiry);
    return inquiry;
  }

  // User settings operations
  async getUserNotificationSettings(userId: string): Promise<UserNotificationSettings | undefined> {
    return this.userNotificationSettings.get(userId);
  }

  async updateUserNotificationSettings(userId: string, settings: Partial<UserNotificationSettings>): Promise<UserNotificationSettings> {
    const currentSettings = this.userNotificationSettings.get(userId) || {
      id: 0,
      userId,
      pushNotifications: true,
      emailNotifications: true,
      smsNotifications: false,
      bookingReminders: true,
      promotionAlerts: true,
      serviceUpdates: true,
      careManagerMessages: true,
      systemNotifications: true,
      updatedAt: new Date()
    };
    const updatedSettings = { ...currentSettings, ...settings, updatedAt: new Date() };
    this.userNotificationSettings.set(userId, updatedSettings);
    return updatedSettings;
  }

  async getUserPrivacySettings(userId: string): Promise<UserPrivacySettings | undefined> {
    return this.userPrivacySettings.get(userId);
  }

  async updateUserPrivacySettings(userId: string, settings: Partial<UserPrivacySettings>): Promise<UserPrivacySettings> {
    const currentSettings = this.userPrivacySettings.get(userId) || {
      id: 0,
      userId,
      profileVisible: true,
      showLocation: true,
      showAge: false,
      showPhone: false,
      allowDataCollection: false,
      allowMarketingEmails: false,
      twoFactorEnabled: false,
      accountDeletionRequested: false,
      updatedAt: new Date()
    };
    const updatedSettings = { ...currentSettings, ...settings, updatedAt: new Date() };
    this.userPrivacySettings.set(userId, updatedSettings);
    return updatedSettings;
  }

  // Order management operations
  async getAllOrders(): Promise<any[]> {
    return Array.from(this.orders.values());
  }

  async createOrder(orderData: any): Promise<any> {
    const orderId = `ORD-${this.orders.size + 1}`.padStart(7, '0');
    const newOrder = {
      id: orderId,
      ...orderData,
      createdAt: new Date().toISOString(),
      payment_status: orderData.payment_status || "pending",
      order_status: orderData.order_status || "pending",
      tracking_number: orderData.tracking_number || "",
      shipping_company: orderData.shipping_company || "",
    };
    this.orders.set(orderId, newOrder);
    return newOrder;
  }

  async updateOrderStatus(orderId: string, status: string): Promise<any | undefined> {
    const order = this.orders.get(orderId);
    if (!order) return undefined;
    order.status = status;
    this.orders.set(orderId, order);
    return order;
  }

  async updateOrderShipping(orderId: string, trackingNumber: string, shippingCompany: string): Promise<any | undefined> {
    const order = this.orders.get(orderId);
    if (!order) return undefined;
    order.trackingNumber = trackingNumber;
    order.shippingCompany = shippingCompany;
    this.orders.set(orderId, order);
    return order;
  }

  // Admin notifications operations
  async getAdminNotifications(): Promise<any[]> {
    return Array.from(this.adminNotifications.values());
  }

  async createAdminNotification(notification: { type: string; message: string; order_id?: string; reference_id?: string; }): Promise<any> {
    const newNotification = {
      id: this.currentAdminNotificationId++,
      ...notification,
      isRead: false,
      createdAt: new Date()
    };
    this.adminNotifications.set(String(newNotification.id), newNotification);
    return newNotification;
  }

  async markAdminNotificationAsRead(notificationId: string): Promise<any | undefined> {
    const notification = this.adminNotifications.get(notificationId);
    if (!notification) return undefined;
    notification.isRead = true;
    this.adminNotifications.set(notificationId, notification);
    return notification;
  }

  // 상품 리뷰 관련
  async getProductReviews(productId: number): Promise<ProductReview[]> {
    return Array.from(this.productReviews.values()).filter(review => review.productId === productId);
  }

  async getUserProductReviews(userId: number): Promise<ProductReview[]> {
    return Array.from(this.productReviews.values()).filter(review => review.userId === userId);
  }

  async createProductReview(review: InsertProductReview): Promise<ProductReview> {
    const newReview: ProductReview = {
      id: this.currentProductReviewId++,
      ...review,
      status: review.status || "active", // null 또는 기본값 제공
      createdAt: new Date(),
      updatedAt: null,
      images: review.images || null,
      isVerifiedPurchase: review.isVerifiedPurchase || false
    };
    this.productReviews.set(newReview.id, newReview);
    return newReview;
  }

  async updateProductReview(id: number, payload: Partial<ProductReview>): Promise<ProductReview | undefined> {
    const review = this.productReviews.get(id);
    if (!review) return undefined;
    const updatedReview: ProductReview = {
      ...review,
      ...payload,
      updatedAt: new Date()
    };
    this.productReviews.set(id, updatedReview);
    return updatedReview;
  }

  async deleteProductReview(id: number): Promise<boolean> {
    return this.productReviews.delete(id);
  }

  async checkUserPurchase(userId: number, productId: number): Promise<boolean> {
    // 임시 구현: 사용자가 해당 상품을 구매한 경험이 있는지 확인
    // 실제 구현에서는 사용자의 구매 내역을 데이터베이스에서 조회
    return false; // 임시로 구매 내역이 없음
  }
  
  // 상품 문의 관련
  async getProductComments(productId: number): Promise<ProductComment[]> {
    return Array.from(this.productComments.values()).filter(comment => comment.productId === productId);
  }

  async getUserProductComments(userId: number): Promise<ProductComment[]> {
    return Array.from(this.productComments.values()).filter(comment => comment.userId === userId);
  }

  async createProductComment(comment: InsertProductComment): Promise<ProductComment> {
    const newComment: ProductComment = {
      id: this.currentProductCommentId++,
      userId: comment.userId,
      productId: comment.productId,
      content: comment.content,
      status: comment.status || "active",
      createdAt: new Date(),
      updatedAt: null,
      parentId: comment.parentId || null,
      isPrivate: comment.isPrivate || false,
      isAdmin: comment.isAdmin || false
    };
    this.productComments.set(newComment.id, newComment);
    return newComment;
  }

  async createProductCommentReply(comment: InsertProductComment): Promise<ProductComment> {
    const newReply: ProductComment = {
      id: this.currentProductCommentId++,
      userId: comment.userId,
      productId: comment.productId,
      content: comment.content,
      status: comment.status || "active",
      createdAt: new Date(),
      updatedAt: null,
      parentId: comment.parentId || null,
      isPrivate: comment.isPrivate || false,
      isAdmin: comment.isAdmin || false
    };
    this.productComments.set(newReply.id, newReply);
    return newReply;
  }

  async updateProductComment(id: number, payload: Partial<ProductComment>): Promise<ProductComment | undefined> {
    const comment = this.productComments.get(id);
    if (!comment) return undefined;
    const updatedComment: ProductComment = {
      ...comment,
      ...payload,
      updatedAt: new Date()
    };
    this.productComments.set(id, updatedComment);
    return updatedComment;
  }

  async deleteProductComment(id: number): Promise<boolean> {
    return this.productComments.delete(id);
  }

  // 소개글 콘텐츠 관련
  async updateCareManagerIntroContents(careManagerId: number, introContents: any[]): Promise<boolean> {
    const manager = this.careManagers.get(careManagerId);
    if (!manager) return false;
    manager.introContents = introContents;
    this.careManagers.set(careManagerId, manager);
    return true;
  }

  async getCareManagerIntroContents(careManagerId: number): Promise<any[] | null> {
    const manager = this.careManagers.get(careManagerId);
    if (!manager || !manager.introContents) {
      return null;
    }
    return manager.introContents as any[];
  }

  // Cart operations (memory)
  async getCartItems(userId: number): Promise<CartItem[]> {
    return Array.from(this.cartItemsStore.values()).filter(ci => ci.userId === userId);
  }

  async getCartItemsByFirebaseId(firebaseUid: string): Promise<CartItem[]> {
    // 메모리 스토리지에서는 빈 배열 반환 (실제로는 Firebase UID로 매핑 필요)
    console.log(`[MemStorage] Firebase UID ${firebaseUid}의 장바구니 조회 - 임시 빈 배열 반환`);
    return [];
  }

  async findCartItem(userId: number, productId: number, selectedOptions: any | null): Promise<CartItem | undefined> {
    return Array.from(this.cartItemsStore.values()).find(ci => ci.userId === userId && ci.productId === productId && JSON.stringify(ci.selectedOptions ?? null) === JSON.stringify(selectedOptions ?? null));
  }

  async findCartItemByFirebaseId(firebaseUid: string, productId: number, selectedOptions: any | null): Promise<CartItem | undefined> {
    // 메모리 스토리지에서는 undefined 반환 (실제로는 Firebase UID로 매핑 필요)
    console.log(`[MemStorage] Firebase UID ${firebaseUid}로 장바구니 아이템 검색 - 임시 undefined 반환`);
    return undefined;
  }

  async addCartItemByFirebaseId(firebaseUid: string, productId: number, quantity: number, selectedOptions: any | null): Promise<CartItem> {
    // 메모리 스토리지에서는 임시 아이템 생성 (실제로는 Firebase UID로 매핑 필요)
    console.log(`[MemStorage] Firebase UID ${firebaseUid}로 장바구니 아이템 추가 - 임시 구현`);
    const newItem: CartItem = {
      id: this.currentCartItemId++,
      userId: 0, // 임시값
      productId,
      quantity,
      selectedOptions,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    this.cartItemsStore.set(newItem.id as any, newItem);
    return newItem;
  }

  async clearCartByFirebaseId(firebaseUid: string): Promise<boolean> {
    // 메모리 스토리지에서는 임시로 true 반환 (실제로는 Firebase UID로 매핑 필요)
    console.log(`[MemStorage] Firebase UID ${firebaseUid}의 장바구니 비우기 - 임시 true 반환`);
    return true;
  }

  async addCartItem(cart: InsertCartItem): Promise<CartItem> {
    const newItem: CartItem = {
      id: this.currentCartItemId++,
      userId: cart.userId,
      productId: cart.productId,
      quantity: cart.quantity ?? 1,
      selectedOptions: cart.selectedOptions ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    this.cartItemsStore.set(newItem.id as any, newItem);
    return newItem;
  }

  async updateCartItem(id: number, payload: Partial<CartItem>): Promise<CartItem | undefined> {
    const exist = this.cartItemsStore.get(id);
    if (!exist) return undefined;
    const updated: CartItem = { ...exist, ...payload, updatedAt: new Date() } as any;
    this.cartItemsStore.set(id, updated);
    return updated;
  }

  async removeCartItem(id: number): Promise<boolean> {
    return this.cartItemsStore.delete(id);
  }

  async clearCart(userId: number): Promise<boolean> {
    const before = this.cartItemsStore.size;
    Array.from(this.cartItemsStore.entries()).forEach(([id, item]) => {
      if (item.userId === userId) this.cartItemsStore.delete(id);
    });
    return this.cartItemsStore.size < before;
  }
}

export class DatabaseStorage implements IStorage {
  
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        userType: (insertUser.userType as UserType) || 'customer',
        grade: (insertUser.grade as UserGrade) || 'bronze',
        isApproved: insertUser.isApproved ?? false,
      })
      .returning();
    return user;
  }

  // 사용자 유형 업데이트 메서드 추가
  async updateUserType(userId: number, userType: string) {
    const results = await db
      .update(users)
      .set({ userType })
      .where(eq(users.id, userId))
      .returning();
    return results[0];
  }

  // 케어 매니저 승인 메서드 추가
  async approveCareManager(userId: number) {
    const results = await db
      .update(users)
      .set({ 
        isApproved: true,
        // 승인시 등급을 기본 브론즈로 설정
        grade: 'bronze'
      })
      .where(eq(users.id, userId))
      .returning();
    return results[0];
  }

  // 사용자 비밀번호 업데이트 메서드 추가
  async updatePassword(userId: number, hashedPassword: string) {
    const results = await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId))
      .returning();
    return results[0];
  }

  async getUsers() {
    return await db.select().from(users);
  }

  async getAllBookings(): Promise<Booking[]> {
    return await db.select().from(bookings);
  }

  // Dispute operations (DB 스텁)
  async getAllDisputes(): Promise<any[]> {
    // 실제 DB에 disputes 테이블이 없으므로 빈 배열 반환
    return [];
  }

  async updateDisputeStatus(id:number,status:string){ return undefined; }

  // Notice operations (stub)
  async getAllNotices(): Promise<any[]> { 
    try {
      const results = await db.select().from(notices).orderBy(desc(notices.id));
      return results || [];
    } catch (error) {
      console.error("공지사항 조회 오류:", error);
      return [];
    }
  }
  
  async createNotice(notice:{title:string;content:string}) { 
    try {
      const [result] = await db.insert(notices).values({
        title: notice.title,
        content: notice.content,
        date: new Date().toISOString().slice(0,10),
        isImportant: notice.title.includes('중요') || false,
        category: notice.title.includes('시스템') ? 'system' : 'notice'
      }).returning();
      return result;
    } catch (error) {
      console.error("공지사항 생성 오류:", error);
      // 에러 발생 시 메모리에 임시 저장 (폴백 솔루션)
      if (!(global as any).notices) {
        (global as any).notices = [];
      }
      if (!(global as any).noticeId) {
        (global as any).noticeId = 1;
      }
      
      const newNotice = {
        id: (global as any).noticeId++,
        title: notice.title,
        content: notice.content,
        date: new Date().toISOString().slice(0,10),
        isImportant: notice.title.includes('중요') || false,
        category: notice.title.includes('시스템') ? 'system' : 'notice'
      };
      
      (global as any).notices.push(newNotice);
      return newNotice;
    }
  }
  
  async updateNotice(id:number, payload:Partial<any>) { 
    try {
      const [result] = await db.update(notices)
        .set(payload)
        .where(eq(notices.id, id))
        .returning();
      return result;
    } catch (error) {
      console.error("공지사항 수정 오류:", error);
      
      // 에러 발생 시 메모리에서 처리 (폴백 솔루션)
      if (!(global as any).notices) {
        return undefined;
      }
      
      const index = (global as any).notices.findIndex((n: any) => n.id === id);
      if (index === -1) return undefined;
      
      (global as any).notices[index] = {
        ...(global as any).notices[index],
        ...payload
      };
      
      return (global as any).notices[index];
    }
  }
  
  async deleteNotice(id:number) { 
    try {
      await db.delete(notices).where(eq(notices.id, id));
      return true;
    } catch (error) {
      console.error("공지사항 삭제 오류:", error);
      
      // 에러 발생 시 메모리에서 처리 (폴백 솔루션)
      if (!(global as any).notices) {
        return false;
      }
      
      const initialLength = (global as any).notices.length;
      (global as any).notices = (global as any).notices.filter((n: any) => n.id !== id);
      
      return initialLength > (global as any).notices.length;
    }
  }

  async getUserById(id: number) {
    const results = await db.select().from(users).where(eq(users.id, id));
    return results[0];
  }

  // Care Manager operations
  async getCareManager(id: number): Promise<CareManager | undefined> {
    const [careManager] = await db.select().from(careManagers).where(eq(careManagers.id, id));
    if (!careManager) return undefined;
    
    // isApproved 속성이 없는 경우 기본값 추가
    return {
      ...careManager,
      isApproved: (careManager as any).isApproved ?? true
    };
  }

  async getAllCareManagers(): Promise<CareManager[]> {
    try {
      const allCareManagers = await db.select().from(careManagers);
      
      // isApproved 속성이 없는 경우 기본값 추가
      const managersWithApproval = allCareManagers.map((manager: any) => ({
        ...manager,
        isApproved: manager.isApproved ?? true
      }));
      
      return managersWithApproval;
    } catch (error) {
      console.error("케어매니저 목록 조회 오류:", error);
      // 오류 발생시 기본 데이터 제공
      return [];
    }
  }

  async getCareManagersByService(serviceId: number): Promise<CareManager[]> {
    // This would require a more complex query with JSON operations in a real implementation
    return await db.select().from(careManagers);
  }

  async createCareManager(insertCareManager: InsertCareManager): Promise<CareManager> {
    const [careManager] = await db
      .insert(careManagers)
      .values(insertCareManager)
      .returning();
    return careManager;
  }

  // 케어매니저 정보 업데이트 (부분 업데이트)
  async updateCareManager(id: number, payload: Partial<CareManager>): Promise<CareManager | undefined> {
    const [updated] = await db
      .update(careManagers)
      .set(payload as any)
      .where(eq(careManagers.id, id))
      .returning();
    return updated;
  }

  // Service operations
  async getService(id: number): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service || undefined;
  }

  async getAllServices(): Promise<Service[]> {
    return await db.select().from(services);
  }

  async createService(insertService: InsertService): Promise<Service> {
    const [service] = await db
      .insert(services)
      .values(insertService)
      .returning();
    return service;
  }

  // Booking operations
  async getBooking(id: number): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking || undefined;
  }

  async getBookingsByUser(userId: string): Promise<Booking[]> {
    try {
      // 모든 예약 목록 조회
      const allBookings = await db.select().from(bookings);
      
      // 현재 로그인한 사용자의 예약만 필터링
      const filteredBookings = allBookings.filter((booking: Booking) => {
        // userId는 string이므로 문자열로 변환하여 비교
        return String(booking.userId) === String(userId);
      });
      
      return filteredBookings;
    } catch (error) {
      console.error("데이터베이스 조회 오류:", error);
      // 에러 발생시 빈 배열 반환
      return [];
    }
  }

  async getBookingsByCareManager(careManagerId: number): Promise<Booking[]> {
    return await db
      .select()
      .from(bookings)
      .where(eq(bookings.careManagerId, careManagerId));
  }
  
  async getBookingsByCareManagerAndDate(careManagerId: number, date: string): Promise<Booking[]> {
    // date가 "YYYY-MM-DD" 형식이므로 해당 날짜의 시작과 끝을 계산
    const startDate = new Date(`${date}T00:00:00.000Z`);
    const endDate = new Date(`${date}T23:59:59.999Z`);
    
    return await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.careManagerId, careManagerId),
          gte(bookings.date, startDate),
          lte(bookings.date, endDate)
        )
      );
  }

  async createBooking(insertBooking: InsertBooking): Promise<Booking> {
    const [booking] = await db
      .insert(bookings)
      .values(insertBooking)
      .returning();
    return booking;
  }

  async updateBookingStatus(id: number | string, status: string): Promise<Booking | undefined> {
    try {
      // number 타입으로 변환해서 처리
      const numId = typeof id === 'string' ? parseInt(id) : id;
      
      const [booking] = await db
        .update(bookings)
        .set({ status })
        .where(eq(bookings.id, numId))
        .returning();
      return booking || undefined;
    } catch (error) {
      console.error("예약 상태 변경 오류:", error);
      return undefined;
    }
  }

  // Message operations
  async getMessagesBetweenUsers(userId1: number, userId2: number): Promise<Message[]> {
    return await db.select().from(messages)
      .where(
        or(
          and(eq(messages.senderId, userId1), eq(messages.receiverId, userId2)),
          and(eq(messages.senderId, userId2), eq(messages.receiverId, userId1))
        )
      )
      .orderBy(desc(messages.timestamp));
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values(insertMessage)
      .returning();
    return message;
  }

  async markMessageAsRead(id: number): Promise<Message | undefined> {
    const [message] = await db
      .update(messages)
      .set({ isRead: true })
      .where(eq(messages.id, id))
      .returning();
    return message || undefined;
  }

  // Product operations
  async getProduct(id: number): Promise<Product | undefined> {
    try {
      const result = await db
        .select({
          id: products.id,
          title: products.title,
          description: products.description,
          price: products.price,
          discountPrice: products.discountPrice,
          stock: products.stock,
          images: products.images,
          tags: products.tags,
          sellerId: products.sellerId,
          categoryId: products.categoryId,
          status: products.status,
          rating: products.rating,
          reviewCount: products.reviewCount,
          createdAt: products.createdAt,
          updatedAt: products.updatedAt,
          // 카테고리 정보 추가
          category: productCategories.name,
        })
        .from(products)
        .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
        .where(eq(products.id, id));

      if (result.length === 0) {
        return undefined;
      }

      const product = result[0];
      console.log("상품 조회 결과 (카테고리 포함):", {
        id: product.id,
        title: product.title,
        categoryId: product.categoryId,
        category: product.category
      });

      return product as any;
    } catch (error) {
      console.error("상품 조회 오류:", error);
      
      // 메모리 데이터에서 상품 찾기
      const memoryProduct = memoryProducts.find(p => p.id === id);
      if (memoryProduct) {
        console.log("메모리 데이터에서 상품 찾음:", memoryProduct.title);
        return memoryProduct as unknown as Product;
      }
      
      return undefined;
    }
  }

  async getAllProducts(params?: { sellerId?: number; categoryId?: number; category?: string; search?: string; limit?: number; offset?: number }): Promise<Product[]> {
    try {
      console.log("DB에서 상품 목록 조회 시도");
      let query = db.select().from(products);

      // 판매자 ID로 필터링
      if (params?.sellerId) {
        query = query.where(eq(products.sellerId, params.sellerId));
      }

      // 카테고리 ID로 필터링
      if (params?.categoryId) {
        query = query.where(eq(products.categoryId, params.categoryId));
      }

      // 검색어로 필터링
      if (params?.search) {
        query = query.where(
          or(
            like(products.name, `%${params.search}%`),
            like(products.description || '', `%${params.search}%`)
          )
        );
      }

      // 최신순 정렬
      query = query.orderBy(desc(products.createdAt));

      // 페이지네이션
      if (params?.limit !== undefined) {
        query = query.limit(params.limit);
      }
      if (params?.offset !== undefined) {
        query = query.offset(params.offset);
      }

      const result = await query;
      console.log(`DB에서 ${result.length}개 상품 조회 성공`);
      return result;
    } catch (error) {
      console.error("상품 목록 조회 오류:", error);
      console.log("메모리 기반 상품 데이터 사용");
      
      // 메모리 기반 데이터 필터링
      let result = [...memoryProducts];

      if (params?.sellerId) {
        result = result.filter(product => product.sellerId === params.sellerId);
      }

      if (params?.categoryId) {
        result = result.filter(product => product.categoryId === params.categoryId);
      }

      // 카테고리 이름으로 필터링
      if (params?.category && params.category !== '전체') {
        result = result.filter(product => product.category === params.category);
      }

      // 검색어 필터링
      if (params?.search) {
        const searchLower = params.search.toLowerCase();
        result = result.filter(product => 
          (product.title?.toLowerCase().includes(searchLower) || false) ||
          (product.description?.toLowerCase().includes(searchLower) || false)
        );
      }

      // 최신순 정렬
      result.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
        const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
        return dateB - dateA;
      });

      // 페이지네이션
      if (params?.offset !== undefined) {
        result = result.slice(params.offset);
      }
      if (params?.limit !== undefined) {
        result = result.slice(0, params.limit);
      }

      return result;
    }
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    try {
      const [product] = await db
        .insert(products)
        .values(insertProduct)
        .returning();
      return product;
    } catch (error) {
      console.error("상품 생성 오류:", error);
      throw error;
    }
  }

  async updateProduct(id: number, payload: Partial<Product>): Promise<Product | undefined> {
    try {
      const [updated] = await db
        .update(products)
        .set({ ...payload, updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning();
      return updated || undefined;
    } catch (error) {
      console.error("상품 업데이트 오류:", error);
      return undefined;
    }
  }

  async deleteProduct(id: number): Promise<boolean> {
    try {
      await db.delete(products).where(eq(products.id, id));
      return true;
    } catch (error) {
      console.error("상품 삭제 오류:", error);
      return false;
    }
  }

  // Product Category operations
  async getProductCategory(id: number): Promise<ProductCategory | undefined> {
    try {
      const [category] = await db.select().from(productCategories).where(eq(productCategories.id, id));
      return category || undefined;
    } catch (error) {
      console.error("상품 카테고리 조회 오류:", error);
      return undefined;
    }
  }

  async getAllProductCategories(): Promise<ProductCategory[]> {
    try {
      const result = await db.select().from(productCategories).orderBy(productCategories.categoryOrder);
      return result;
    } catch (error) {
      console.error("상품 카테고리 목록 조회 오류:", error);
      console.log("메모리 기반 상품 카테고리 데이터 사용");
      return memoryProductCategories as ProductCategory[];
    }
  }

  async createProductCategory(insertCategory: InsertProductCategory): Promise<ProductCategory> {
    try {
      const [category] = await db
        .insert(productCategories)
        .values(insertCategory)
        .returning();
      return category;
    } catch (error) {
      console.error("상품 카테고리 생성 오류:", error);
      throw error;
    }
  }

  async updateProductCategory(id: number, payload: Partial<ProductCategory>): Promise<ProductCategory | undefined> {
    try {
      const [updated] = await db
        .update(productCategories)
        .set({ ...payload, updatedAt: new Date() })
        .where(eq(productCategories.id, id))
        .returning();
      return updated || undefined;
    } catch (error) {
      console.error("상품 카테고리 업데이트 오류:", error);
      return undefined;
    }
  }

  async deleteProductCategory(id: number): Promise<boolean> {
    try {
      await db.delete(productCategories).where(eq(productCategories.id, id));
      return true;
    } catch (error) {
      console.error("상품 카테고리 삭제 오류:", error);
      return false;
    }
  }

  // Favorites operations
  async getFavorites(userId: string): Promise<Favorite[]> {
    try {
      return await db.select().from(favorites).where(eq(favorites.userId, userId));
    } catch (error) {
      console.error("즐겨찾기 조회 오류:", error);
      return [];
    }
  }

  async addFavorite(favorite: InsertFavorite): Promise<Favorite> {
    try {
      const [newFavorite] = await db
        .insert(favorites)
        .values(favorite)
        .returning();
      return newFavorite;
    } catch (error) {
      console.error("즐겨찾기 추가 오류:", error);
      throw error;
    }
  }

  async removeFavorite(id: number): Promise<boolean> {
    try {
      await db.delete(favorites).where(eq(favorites.id, id));
      return true;
    } catch (error) {
      console.error("즐겨찾기 삭제 오류:", error);
      return false;
    }
  }

  // Inquiries operations
  async getAllInquiries(): Promise<Inquiry[]> {
    try {
      return await db.select().from(inquiries);
    } catch (error) {
      console.error("문의사항 목록 조회 오류:", error);
      return [];
    }
  }

  async getUserInquiries(userId: string): Promise<Inquiry[]> {
    try {
      return await db.select().from(inquiries).where(eq(inquiries.userId, userId));
    } catch (error) {
      console.error("사용자 문의사항 조회 오류:", error);
      return [];
    }
  }

  async createInquiry(inquiry: InsertInquiry): Promise<Inquiry> {
    try {
      const [newInquiry] = await db
        .insert(inquiries)
        .values(inquiry)
        .returning();
      return newInquiry;
    } catch (error) {
      console.error("문의사항 생성 오류:", error);
      throw error;
    }
  }

  async answerInquiry(id: number, answer: string, answeredBy: string): Promise<Inquiry | undefined> {
    try {
      const [inquiry] = await db
        .update(inquiries)
        .set({ answer, answeredBy, status: 'answered', updatedAt: new Date() })
        .where(eq(inquiries.id, id))
        .returning();
      return inquiry || undefined;
    } catch (error) {
      console.error("문의사항 답변 오류:", error);
      return undefined;
    }
  }

  async updateInquiryStatus(id: number, status: string): Promise<Inquiry | undefined> {
    try {
      const [inquiry] = await db
        .update(inquiries)
        .set({ status, updatedAt: new Date() })
        .where(eq(inquiries.id, id))
        .returning();
      return inquiry || undefined;
    } catch (error) {
      console.error("문의사항 상태 업데이트 오류:", error);
      return undefined;
    }
  }

  // User settings operations
  async getUserNotificationSettings(userId: string): Promise<UserNotificationSettings | undefined> {
    try {
      const [settings] = await db.select().from(userNotificationSettings).where(eq(userNotificationSettings.userId, userId));
      return settings || undefined;
    } catch (error) {
      console.error("사용자 알림 설정 조회 오류:", error);
      return undefined;
    }
  }

  async updateUserNotificationSettings(userId: string, settings: Partial<UserNotificationSettings>): Promise<UserNotificationSettings> {
    try {
      const [updated] = await db
        .update(userNotificationSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(userNotificationSettings.userId, userId))
        .returning();
      return updated;
    } catch (error) {
      console.error("사용자 알림 설정 업데이트 오류:", error);
      throw error;
    }
  }

  async getUserPrivacySettings(userId: string): Promise<UserPrivacySettings | undefined> {
    try {
      const [settings] = await db.select().from(userPrivacySettings).where(eq(userPrivacySettings.userId, userId));
      return settings || undefined;
    } catch (error) {
      console.error("사용자 개인정보 설정 조회 오류:", error);
      return undefined;
    }
  }

  async updateUserPrivacySettings(userId: string, settings: Partial<UserPrivacySettings>): Promise<UserPrivacySettings> {
    try {
      const [updated] = await db
        .update(userPrivacySettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(userPrivacySettings.userId, userId))
        .returning();
      return updated;
    } catch (error) {
      console.error("사용자 개인정보 설정 업데이트 오류:", error);
      throw error;
    }
  }

  // Order management operations
  async getAllOrders(): Promise<any[]> {
    try {
      // 일시적인 더미 구현
      return [
        {
          id: "ORD-001",
          createdAt: new Date().toISOString(),
          customer_name: "김영희",
          customer_phone: "010-1234-5678",
          orderItems: [
            { product: { title: "신선한 사과" }, quantity: 2, price: 15000 }
          ],
          total_amount: 30000,
          payment_method: "카드결제",
          payment_status: "paid",
          order_status: "pending",
          shipping_address: {
            name: "김영희",
            phone: "010-1234-5678",
            address: "서울시 강남구 테헤란로 123",
          },
          tracking_number: "",
          shipping_company: "",
        },
        {
          id: "ORD-002", 
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          customer_name: "박철수",
          customer_phone: "010-9876-5432",
          orderItems: [
            { product: { title: "유기농 배" }, quantity: 1, price: 25000 }
          ],
          total_amount: 25000,
          payment_method: "무통장입금",
          payment_status: "paid",
          order_status: "shipped",
          shipping_address: {
            name: "박철수",
            phone: "010-9876-5432", 
            address: "부산시 해운대구 센텀중앙로 456",
          },
          tracking_number: "123456789",
          shipping_company: "CJ대한통운",
        }
      ];
    } catch (error) {
      console.error("주문 목록 조회 오류:", error);
      return [];
    }
  }

  async createOrder(orderData: any): Promise<any> {
    try {
      // 주문 ID 생성 (실제로는 DB에서 자동 생성되거나 시퀀스 사용)
      const orderId = `ORD-${Date.now().toString().slice(-6)}`;
      
      // 주문 데이터 생성
      const newOrder = {
        id: orderId,
        ...orderData,
        createdAt: new Date().toISOString(),
        payment_status: orderData.payment_status || "pending",
        order_status: orderData.order_status || "pending",
        tracking_number: orderData.tracking_number || "",
        shipping_company: orderData.shipping_company || "",
      };
      
      // 실제 구현에서는 DB에 저장
      console.log("새 주문 생성:", newOrder);
      
      // 관리자 알림 생성
      await this.createAdminNotification({
        type: "order",
        message: `새로운 주문이 접수되었습니다. (주문번호: ${orderId})`,
        order_id: orderId,
        reference_id: orderId
      });
      
      return newOrder;
    } catch (error) {
      console.error("주문 생성 오류:", error);
      throw error;
    }
  }

  async updateOrderStatus(orderId: string, status: string): Promise<any | undefined> {
    try {
      // 일시적인 더미 구현
      return {
        id: orderId,
        order_status: status,
        updatedAt: new Date()
      };
    } catch (error) {
      console.error("주문 상태 변경 오류:", error);
      return undefined;
    }
  }

  async updateOrderShipping(orderId: string, trackingNumber: string, shippingCompany: string): Promise<any | undefined> {
    try {
      // 일시적인 더미 구현
      return {
        id: orderId,
        tracking_number: trackingNumber,
        shipping_company: shippingCompany,
        order_status: 'shipped',
        updatedAt: new Date()
      };
    } catch (error) {
      console.error("배송 정보 업데이트 오류:", error);
      return undefined;
    }
  }

  // Admin notifications operations
  async getAdminNotifications(): Promise<any[]> {
    // 더미 구현
    return [
      {
        id: "NOTIF-001",
        type: "shipping",
        message: "주문 #ORD-002의 배송이 시작되었습니다. 택배사: CJ대한통운, 운송장번호: 123456789",
        order_id: "ORD-002",
        reference_id: "ORD-002",
        is_read: false,
        status: "unread",
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: "NOTIF-002",
        type: "order",
        message: "새로운 주문이 접수되었습니다.",
        order_id: "ORD-001",
        reference_id: "ORD-001",
        is_read: true,
        status: "read",
        createdAt: new Date().toISOString(),
      }
    ];
  }

  async createAdminNotification(notification: { type: string; message: string; order_id?: string; reference_id?: string; }): Promise<any> {
    // 더미 구현
    return { 
      id: `NOTIF-${Date.now()}`, 
      ...notification, 
      is_read: false, 
      status: "unread",
      createdAt: new Date().toISOString() 
    };
  }

  async markAdminNotificationAsRead(notificationId: string): Promise<any | undefined> {
    // 더미 구현
    return { 
      id: notificationId, 
      is_read: true,
      status: "read",
      updatedAt: new Date().toISOString()
    };
  }

  // 상품 리뷰 관련
  async getProductReviews(productId: number): Promise<ProductReview[]> {
    return await db.select().from(productReviews).where(eq(productReviews.productId, productId));
  }

  async getUserProductReviews(userId: number): Promise<ProductReview[]> {
    return await db.select().from(productReviews).where(eq(productReviews.userId, userId));
  }

  async createProductReview(review: InsertProductReview): Promise<ProductReview> {
    const [newReview] = await db.insert(productReviews).values(review).returning();
    return newReview;
  }

  async updateProductReview(id: number, payload: Partial<ProductReview>): Promise<ProductReview | undefined> {
    const [updated] = await db.update(productReviews).set(payload).where(eq(productReviews.id, id)).returning();
    return updated || undefined;
  }

  async deleteProductReview(id: number): Promise<boolean> {
    const { count } = await db.delete(productReviews).where(eq(productReviews.id, id)).returning().count();
    return count > 0;
  }

  async checkUserPurchase(userId: number, productId: number): Promise<boolean> {
    // 임시 구현: 사용자가 해당 상품을 구매한 경험이 있는지 확인
    // 실제 구현에서는 사용자의 구매 내역을 데이터베이스에서 조회
    return false; // 임시로 구매 내역이 없음
  }
  
  // 상품 문의 관련
  async getProductComments(productId: number): Promise<ProductComment[]> {
    return await db.select().from(productComments).where(eq(productComments.productId, productId));
  }

  async getUserProductComments(userId: number): Promise<ProductComment[]> {
    return await db.select().from(productComments).where(eq(productComments.userId, userId));
  }

  async createProductComment(comment: InsertProductComment): Promise<ProductComment> {
    const [newComment] = await db.insert(productComments).values(comment).returning();
    return newComment;
  }

  async createProductCommentReply(comment: InsertProductComment): Promise<ProductComment> {
    // db.insert를 사용하여 데이터베이스에 직접 저장
    const [newReply] = await db.insert(productComments).values(comment).returning();
    return newReply;
  }

  async updateProductComment(id: number, payload: Partial<ProductComment>): Promise<ProductComment | undefined> {
    const [updated] = await db.update(productComments).set(payload).where(eq(productComments.id, id)).returning();
    return updated || undefined;
  }

  async deleteProductComment(id: number): Promise<boolean> {
    const { count } = await db.delete(productComments).where(eq(productComments.id, id)).returning().count();
    return count > 0;
  }

  // 소개글 콘텐츠 관련
  async updateCareManagerIntroContents(careManagerId: number, introContents: any[]): Promise<boolean> {
    try {
      // 케어 매니저 테이블 업데이트
      await db.update(careManagers)
        .set({ introContents })
        .where(eq(careManagers.id, careManagerId));
      return true;
    } catch (error) {
      console.error("소개글 콘텐츠 업데이트 오류:", error);
      return false;
    }
  }

  async getCareManagerIntroContents(careManagerId: number): Promise<any[] | null> {
    try {
      const result = await db.select({ introContents: careManagers.introContents })
        .from(careManagers)
        .where(eq(careManagers.id, careManagerId));
      
      if (result.length === 0 || !result[0].introContents) {
        return null;
      }
      
      return result[0].introContents as any[];
    } catch (error) {
      console.error("소개글 콘텐츠 조회 오류:", error);
      return null;
    }
  }

  // Cart operations (DB)
  async getCartItems(userId: number): Promise<CartItem[]> {
    try {
      const items = await db.select().from(cartItems).where(eq(cartItems.userId, userId));
      return items as any;
    } catch (error) {
      console.error("장바구니 조회 오류:", error);
      return [] as any;
    }
  }

  async getCartItemsByFirebaseId(firebaseUid: string): Promise<CartItem[]> {
    try {
      console.log(`[DatabaseStorage] Firebase UID ${firebaseUid}로 장바구니 조회 시도`);
      
      // Firebase UID로 직접 장바구니 조회
      const items = await db.select().from(cartItems).where(eq(cartItems.userId, firebaseUid));
      
      console.log(`[DatabaseStorage] Firebase UID ${firebaseUid}의 장바구니 조회 완료: ${items.length}개 아이템`);
      return items as any;
    } catch (error) {
      console.error("Firebase UID로 장바구니 조회 오류:", error);
      return [];
    }
  }

  async findCartItem(userId: number, productId: number, selectedOptions: any | null): Promise<CartItem | undefined> {
    try {
      // jsonb 비교는 DB에서 동등비교 가능
      const results = await db
        .select()
        .from(cartItems)
        .where(
          and(
            eq(cartItems.userId, userId),
            eq(cartItems.productId, productId),
            // selectedOptions가 null이면 IS NULL로 비교, 아니면 값 비교
            selectedOptions == null ? (sql`(${cartItems.selectedOptions} IS NULL)`) : (eq(cartItems.selectedOptions, selectedOptions as any))
          )
        );
      return results[0] as any;
    } catch (error) {
      console.error("장바구니 항목 검색 오류:", error);
      return undefined;
    }
  }

  async findCartItemByFirebaseId(firebaseUid: string, productId: number, selectedOptions: any | null): Promise<CartItem | undefined> {
    try {
      console.log(`[DatabaseStorage] Firebase UID ${firebaseUid}로 장바구니 아이템 검색`);
      
      const results = await db
        .select()
        .from(cartItems)
        .where(
          and(
            eq(cartItems.userId, firebaseUid),
            eq(cartItems.productId, productId),
            // selectedOptions가 null이면 IS NULL로 비교, 아니면 값 비교
            selectedOptions == null ? (sql`(${cartItems.selectedOptions} IS NULL)`) : (eq(cartItems.selectedOptions, selectedOptions as any))
          )
        );
      return results[0] as any;
    } catch (error) {
      console.error("Firebase UID로 장바구니 항목 검색 오류:", error);
      return undefined;
    }
  }

  async addCartItemByFirebaseId(firebaseUid: string, productId: number, quantity: number, selectedOptions: any | null): Promise<CartItem> {
    try {
      console.log(`[DatabaseStorage] Firebase UID ${firebaseUid}에게 장바구니 아이템 추가`);
      
      const newCartItem = {
        userId: firebaseUid,
        productId,
        quantity,
        selectedOptions,
        createdAt: new Date(),
      };
      
      const [inserted] = await db.insert(cartItems).values(newCartItem as any).returning();
      console.log(`[DatabaseStorage] 장바구니 아이템 추가 완료: ${inserted.id}`);
      return inserted as any;
    } catch (error) {
      console.error("Firebase UID로 장바구니 아이템 추가 오류:", error);
      throw error;
    }
  }

  async clearCartByFirebaseId(firebaseUid: string): Promise<boolean> {
    try {
      console.log(`[DatabaseStorage] Firebase UID ${firebaseUid}의 장바구니 비우기`);
      
      await db.delete(cartItems).where(eq(cartItems.userId, firebaseUid));
      console.log(`[DatabaseStorage] Firebase UID ${firebaseUid}의 장바구니 비우기 완료`);
      return true;
    } catch (error) {
      console.error("Firebase UID로 장바구니 비우기 오류:", error);
      return false;
    }
  }

  async addCartItem(cart: InsertCartItem): Promise<CartItem> {
    const [inserted] = await db.insert(cartItems).values(cart as any).returning();
    return inserted as any;
  }

  async updateCartItem(id: number, payload: Partial<CartItem>): Promise<CartItem | undefined> {
    const [updated] = await db.update(cartItems).set({ ...(payload as any), updatedAt: new Date() }).where(eq(cartItems.id, id)).returning();
    return updated as any;
  }

  async removeCartItem(id: number): Promise<boolean> {
    try {
      await db.delete(cartItems).where(eq(cartItems.id, id));
      return true;
    } catch (error) {
      console.error("장바구니 항목 삭제 오류:", error);
      return false;
    }
  }

  async clearCart(userId: number): Promise<boolean> {
    try {
      await db.delete(cartItems).where(eq(cartItems.userId, userId));
      return true;
    } catch (error) {
      console.error("장바구니 비우기 오류:", error);
      return false;
    }
  }
}

// 데이터베이스 연결 여부에 따라 스토리지 선택
export let storage: IStorage;

// 데이터베이스 연결 확인 함수
async function checkDatabaseConnection(): Promise<boolean> {
  try {
    // 간단한 쿼리로 연결 확인
    await db.select().from(users).limit(1);
    return true;
  } catch (error) {
    console.log("데이터베이스 연결 실패, 메모리 스토리지 사용:", error.message);
    return false;
  }
}

// 초기화 함수
export async function initializeStorage(): Promise<void> {
  const isConnected = await checkDatabaseConnection();
  
  if (isConnected) {
    console.log("✅ 데이터베이스 연결 성공 - DatabaseStorage 사용");
    storage = new DatabaseStorage();
  } else {
    console.log("⚠️  데이터베이스 연결 실패 - MemStorage 사용");
    storage = new MemStorage();
  }
}

// 기본값으로 MemStorage 설정 (initializeStorage 호출 전까지)
storage = new MemStorage();
