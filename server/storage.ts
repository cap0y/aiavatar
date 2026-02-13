// @ts-nocheck
import { db, initializeDatabase } from "./db.js";
import { users, careManagers, services, bookings, messages, type User, type InsertUser, type CareManager, type InsertCareManager, type Service, type InsertService, type Booking, type InsertBooking, type Message, type InsertMessage, notices, type InsertNotice, products, productCategories, type Product, type InsertProduct, type ProductCategory, type InsertProductCategory, orders, orderItems, favorites, inquiries, userNotificationSettings, userPrivacySettings, type Favorite, type InsertFavorite, type Inquiry, type InsertInquiry, type UserNotificationSettings, type InsertUserNotificationSettings, type UserPrivacySettings, type InsertUserPrivacySettings, productReviews, type InsertProductReview, type ProductReview, productComments, type InsertProductComment, type ProductComment, UserType, UserGrade, cartItems, type CartItem, type InsertCartItem } from "../shared/schema.ts";
import { and, asc, desc, eq, like, or, sql, ilike, gte, lte } from "drizzle-orm";

// 메모리 기반 더미 데이터 제거 - DB에서만 데이터 가져옴

// UserType, UserGrade는 상단 import에서 함께 가져옵니다.

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(userId: number | string, payload: Partial<User>): Promise<User | undefined>;
  
  // Care Manager operations
  getCareManager(id: number): Promise<CareManager | undefined>;
  getCareManagerByUserId(userId: string): Promise<CareManager | undefined>;
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
  getOrdersByCustomer(customerId: string): Promise<any[]>;
  getOrdersBySeller(sellerId: string): Promise<any[]>;
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

  // 서비스 패키지 관련
  updateCareManagerServicePackages(careManagerId: number, packages: any[]): Promise<boolean>;
  getCareManagerServicePackages(careManagerId: number): Promise<any[] | null>;

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
    // Initialize avatar services (아바타 관련 서비스)
    const servicesData = [
      { name: 'Live2D 모델링', icon: 'fas fa-magic', color: 'bg-gradient-to-br from-purple-500 to-pink-500', description: 'Live2D 기술을 활용한 고품질 아바타 모델링 서비스', averageDuration: '평균 1-2주 소요' },
      { name: '3D 모델링', icon: 'fas fa-cube', color: 'bg-gradient-to-br from-blue-500 to-cyan-500', description: '3D 기술을 활용한 실감나는 아바타 제작', averageDuration: '평균 2-3주 소요' },
      { name: '커스텀 의상', icon: 'fas fa-tshirt', color: 'bg-gradient-to-br from-green-500 to-teal-500', description: '개성있는 커스텀 의상 및 액세서리 제작', averageDuration: '평균 3-5일 소요' },
      { name: '애니메이션', icon: 'fas fa-play-circle', color: 'bg-gradient-to-br from-orange-500 to-red-500', description: '감정 표현 및 동작 애니메이션 제작', averageDuration: '평균 1주 소요' }
    ];

    servicesData.forEach(service => {
      const newService: Service = {
        id: this.currentServiceId++,
        ...service
      };
      this.services.set(newService.id, newService);
    });

    // Initialize avatar creators/sellers (아바타 제작자/판매자)
    const avatarCreatorsData = [
      {
        name: 'Avatar Studio',
        age: 0, // 스튜디오이므로 나이 대신 0
        rating: 49, // 4.9
        reviews: 127,
        experience: '5년',
        location: '서울 강남구',
        hourlyRate: 50000,
        services: ['Live2D 모델링', '3D 모델링'],
        certified: true,
        imageUrl: '/images/profile/avatar-studio.png',
        description: '전문적인 Live2D 및 3D 아바타 제작 스튜디오입니다. 고품질 아바타 제작 경험 5년.'
      },
      {
        name: '미라이 크리에이터',
        age: 28,
        rating: 48, // 4.8
        reviews: 89,
        experience: '3년',
        location: '서울 송파구',
        hourlyRate: 35000,
        services: ['커스텀 의상', '애니메이션'],
        certified: true,
        imageUrl: '/images/profile/mirai-creator.png',
        description: '창의적인 아바타 의상 및 애니메이션 전문 크리에이터입니다.'
      },
      {
        name: 'PixelArt Master',
        age: 32,
        rating: 47, // 4.7
        reviews: 156,
        experience: '6년',
        location: '서울 마포구',
        hourlyRate: 40000,
        services: ['Live2D 모델링', '커스텀 의상', '애니메이션'],
        certified: true,
        imageUrl: '/images/profile/pixelart-master.png',
        description: '다양한 스타일의 아바타 제작이 가능한 베테랑 크리에이터입니다.'
      }
    ];

    avatarCreatorsData.forEach(creator => {
      const newCreator: CareManager = {
        id: this.currentCareManagerId++,
        ...creator,
        isApproved: true,
        createdAt: new Date(),
        introContents: null,
      };
      this.careManagers.set(newCreator.id, newCreator);
    });

    // 상품 카테고리와 상품 더미 데이터 초기화 제거 - DB에서만 가져옴
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

  async updateUser(userId: number | string, payload: Partial<User>): Promise<User | undefined> {
    const id = typeof userId === 'string' ? parseInt(userId) : userId;
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = {
      ...user,
      ...payload,
      updatedAt: new Date()
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Avatar Creator operations (아바타 크리에이터 관련)
  async getCareManager(id: number): Promise<CareManager | undefined> {
    return this.careManagers.get(id);
  }

  async getCareManagerByUserId(userId: string): Promise<CareManager | undefined> {
    return Array.from(this.careManagers.values()).find(cm => cm.userId === userId);
  }

  async getAllCareManagers(): Promise<CareManager[]> {
    return Array.from(this.careManagers.values());
  }

  async getCareManagersByService(serviceId: number): Promise<CareManager[]> {
    const service = this.services.get(serviceId);
    if (!service) return [];
    
    // 아바타 크리에이터가 해당 서비스를 제공하는지 확인
    return Array.from(this.careManagers.values()).filter(creator => 
      (creator.services as string[]).includes(service.name)
    );
  }

  async createCareManager(insertCareManager: InsertCareManager): Promise<CareManager> {
    // 아바타 크리에이터 생성
    const avatarCreator: CareManager = {
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
    this.careManagers.set(avatarCreator.id, avatarCreator);
    return avatarCreator;
  }

  // 아바타 크리에이터 정보 업데이트
  async updateCareManager(id: number, payload: Partial<CareManager>): Promise<CareManager | undefined> {
    const creator = this.careManagers.get(id);
    if (!creator) return undefined;
    const updated: CareManager = {
      ...creator,
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
    // MemStorage는 DB 연결 실패 시에만 사용 - 빈 배열 반환
    console.log("⚠️ MemStorage.getAllProducts 호출 - DB를 사용하세요");
    return [];
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
    // MemStorage는 DB 연결 실패 시에만 사용 - 빈 배열 반환
    console.log("⚠️ MemStorage.getAllProductCategories 호출 - DB를 사용하세요");
    return [];
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

  async getOrdersByCustomer(customerId: string): Promise<any[]> {
    return Array.from(this.orders.values()).filter(
      (order: any) => order.customerId === customerId
    );
  }

  async getOrdersBySeller(sellerId: string): Promise<any[]> {
    return Array.from(this.orders.values()).filter(
      (order: any) => order.sellerId === sellerId
    );
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
    order.order_status = status;
    order.updatedAt = new Date().toISOString();
    this.orders.set(orderId, order);
    return order;
  }

  async updateOrderShipping(orderId: string, trackingNumber: string, shippingCompany: string): Promise<any | undefined> {
    const order = this.orders.get(orderId);
    if (!order) return undefined;
    order.tracking_number = trackingNumber;
    order.shipping_company = shippingCompany;
    order.order_status = 'shipped';
    order.updatedAt = new Date().toISOString();
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

  // 아바타 크리에이터 소개글 콘텐츠 관련
  async updateCareManagerIntroContents(careManagerId: number, introContents: any[]): Promise<boolean> {
    const creator = this.careManagers.get(careManagerId);
    if (!creator) return false;
    creator.introContents = introContents;
    this.careManagers.set(careManagerId, creator);
    return true;
  }

  async getCareManagerIntroContents(careManagerId: number): Promise<any[] | null> {
    const creator = this.careManagers.get(careManagerId);
    if (!creator || !creator.introContents) {
      return null;
    }
    return creator.introContents as any[];
  }

  async updateCareManagerServicePackages(careManagerId: number, packages: any[]): Promise<boolean> {
    const creator = this.careManagers.get(careManagerId);
    if (!creator) return false;
    (creator as any).servicePackages = packages;
    this.careManagers.set(careManagerId, creator);
    return true;
  }

  async getCareManagerServicePackages(careManagerId: number): Promise<any[] | null> {
    const creator = this.careManagers.get(careManagerId);
    if (!creator || !(creator as any).servicePackages) {
      return null;
    }
    return (creator as any).servicePackages as any[];
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

  async getUserByFirebaseId(firebaseId: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, firebaseId));
      return user || undefined;
    } catch (error) {
      console.error("Firebase ID로 사용자 조회 오류:", error);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    console.log("📝 데이터베이스에 사용자 생성 시도:", insertUser);
    
    try {
      const [user] = await db
        .insert(users)
        .values({
          ...insertUser,
          userType: (insertUser.userType as UserType) || 'customer',
          grade: (insertUser.grade as UserGrade) || 'bronze',
          isApproved: insertUser.isApproved ?? false,
        })
        .returning();
      
      console.log("✅ 데이터베이스 사용자 생성 성공:", { id: user.id, email: user.email });
      return user;
    } catch (error) {
      console.error("❌ 데이터베이스 사용자 생성 실패:", error);
      throw error;
    }
  }

  // 사용자 유형 업데이트 메서드 추가
  async updateUserType(userId: string, userType: string) {
    const results = await db
      .update(users)
      .set({ userType })
      .where(eq(users.id, userId))
      .returning();
    return results[0];
  }

  // 사용자 정보 업데이트 메서드 추가
  async updateUser(userId: number | string, payload: Partial<User>) {
    try {
      const results = await db
        .update(users)
        .set(payload)
        .where(eq(users.id, userId))
        .returning();
      return results[0];
    } catch (error) {
      console.error("사용자 업데이트 오류:", error);
      return undefined;
    }
  }

  // 아바타 크리에이터 승인 메서드 추가
  async approveCareManager(userId: string) {
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
  async updatePassword(userId: string, hashedPassword: string) {
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

  // Avatar Creator operations (아바타 크리에이터 관련)
  async getCareManager(id: number): Promise<CareManager | undefined> {
    const [avatarCreator] = await db.select().from(careManagers).where(eq(careManagers.id, id));
    if (!avatarCreator) return undefined;
    
    // 디버깅: description 및 age 확인
    console.log(`🔍 getCareManager(${id}) - 데이터:`, {
      name: avatarCreator.name,
      age: avatarCreator.age,
      hasDescription: !!avatarCreator.description,
      descriptionLength: avatarCreator.description?.length || 0,
      descriptionPreview: avatarCreator.description?.substring(0, 50) || 'null/undefined',
      hourlyRate: avatarCreator.hourlyRate
    });
    
    // isApproved 속성이 없는 경우 기본값 추가
    return {
      ...avatarCreator,
      isApproved: (avatarCreator as any).isApproved ?? true
    };
  }

  async getCareManagerByUserId(userId: string): Promise<CareManager | undefined> {
    const [avatarCreator] = await db
      .select()
      .from(careManagers)
      .where(eq(careManagers.userId, userId))
      .limit(1);
    
    if (!avatarCreator) return undefined;
    
    // isApproved 속성이 없는 경우 기본값 추가
    return {
      ...avatarCreator,
      isApproved: (avatarCreator as any).isApproved ?? true
    };
  }

  async getAllCareManagers(): Promise<CareManager[]> {
    try {
      const allAvatarCreators = await db.select().from(careManagers);
      
      // isApproved 속성이 없는 경우 기본값 추가
      const creatorsWithApproval = allAvatarCreators.map((creator: any) => ({
        ...creator,
        isApproved: creator.isApproved ?? true
      }));
      
      return creatorsWithApproval;
    } catch (error) {
      console.error("아바타 크리에이터 목록 조회 오류:", error);
      // 오류 발생시 기본 데이터 제공
      return [];
    }
  }

  async getCareManagersByService(serviceId: number): Promise<CareManager[]> {
    // 아바타 크리에이터 서비스별 조회 (실제 구현에서는 JSON 연산 필요)
    return await db.select().from(careManagers);
  }

  async createCareManager(insertCareManager: InsertCareManager): Promise<CareManager> {
    const [avatarCreator] = await db
      .insert(careManagers)
      .values(insertCareManager)
      .returning();
    return avatarCreator;
  }

  // 아바타 크리에이터 정보 업데이트 (부분 업데이트)
  async updateCareManager(id: number, payload: Partial<CareManager>): Promise<CareManager | undefined> {
    // undefined 값 제거 (실제로 업데이트할 필드만 남김)
    const cleanPayload: any = {};
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        cleanPayload[key] = value;
      }
    });

    // 업데이트할 필드가 없으면 현재 데이터 반환
    if (Object.keys(cleanPayload).length === 0) {
      console.log(`⚠️ 업데이트할 필드가 없음 (id: ${id})`);
      return await this.getCareManager(id);
    }

    console.log(`📝 실제 업데이트할 필드:`, cleanPayload);
    
    const [updated] = await db
      .update(careManagers)
      .set(cleanPayload)
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
    try {
      // date가 "YYYY-MM-DD" 형식이므로 해당 날짜의 시작과 끝을 계산
      const startDate = new Date(`${date}T00:00:00.000Z`);
      const endDate = new Date(`${date}T23:59:59.999Z`);
      
      return await db
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.careManagerId, careManagerId),
            gte(bookings.bookingDate, startDate),
            lte(bookings.bookingDate, endDate)
          )
        );
    } catch (error) {
      console.error("날짜별 예약 조회 오류:", error);
      return [];
    }
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

  async updateBookingWithCompletion(
    id: number | string,
    status: string,
    completionFiles: string[],
    completionNote: string,
    completedAt?: string
  ): Promise<Booking | undefined> {
    try {
      const numId = typeof id === 'string' ? parseInt(id) : id;
      
      const [booking] = await db
        .update(bookings)
        .set({
          status,
          completionFiles: completionFiles as any,
          completionNote,
          completedAt: completedAt ? new Date(completedAt) : new Date()
        })
        .where(eq(bookings.id, numId))
        .returning();
      return booking || undefined;
    } catch (error) {
      console.error("예약 완료 처리 오류:", error);
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
      console.log(`📦 상품 조회 시도: ID ${id}`);
      
      const result = await db
        .select({
          id: products.id,
          name: products.name,
          title: products.title,
          description: products.description,
          price: products.price,
          discountPrice: products.discountPrice,
          stock: products.stock,
          images: products.images,
          sellerId: products.sellerId,
          categoryId: products.categoryId,
          rating: products.rating,
          reviewCount: products.reviewCount,
          isActive: products.isActive,
          createdAt: products.createdAt,
          // 카테고리 정보 추가
          category: productCategories.name,
        })
        .from(products)
        .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
        .where(eq(products.id, id));

      if (result.length === 0) {
        console.log(`❌ 상품 없음: ID ${id}`);
        return undefined;
      }

      const product = result[0];
      console.log("✅ 상품 조회 성공:", {
        id: product.id,
        name: product.name,
        title: product.title,
        categoryId: product.categoryId,
        category: product.category,
        isActive: product.isActive
      });

      return product as any;
    } catch (error) {
      console.error(`❌ 상품 조회 오류 (ID ${id}):`, error);
      return undefined;
    }
  }

  async getAllProducts(params?: { sellerId?: number; categoryId?: number; category?: string; search?: string; limit?: number; offset?: number }): Promise<Product[]> {
    try {
      console.log("DB에서 상품 목록 조회 시도");
      
      // WHERE 조건들을 배열로 수집
      const whereConditions: any[] = [];

      // 판매자 ID로 필터링
      if (params?.sellerId) {
        whereConditions.push(eq(products.sellerId, params.sellerId));
      }

      // 카테고리 ID로 필터링
      if (params?.categoryId) {
        whereConditions.push(eq(products.categoryId, params.categoryId));
      }

      // 카테고리 이름으로 필터링
      if (params?.category && params.category !== '전체') {
        const categoryMapping: { [key: string]: number } = {
          "전체": 1,
          "VTuber": 2,
          "애니메이션": 3,
          "리얼리스틱": 4,
          "판타지": 5,
          "SF/미래": 6,
          "동물/펫": 7,
          "커스텀": 8,
          "액세서리": 9,
          "이모션팩": 10
        };
        const categoryId = categoryMapping[params.category];
        if (categoryId) {
          whereConditions.push(eq(products.categoryId, categoryId));
        }
      }

      // 검색어로 필터링
      if (params?.search) {
        whereConditions.push(
          or(
            like(products.name, `%${params.search}%`),
            like(products.description || '', `%${params.search}%`)
          )
        );
      }

      // 쿼리 빌드 (조건이 있으면 and로 연결)
      let query = db.select().from(products);
      if (whereConditions.length > 0) {
        query = query.where(whereConditions.length === 1 ? whereConditions[0] : and(...whereConditions));
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
      return [];
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
      return [];
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
            { product: { title: "테크노" }, quantity: 2, price: 15000 }
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
            { product: { title: "사쿠라" }, quantity: 1, price: 25000 }
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
      console.log("주문 생성 시작:", orderData);
      
      // snake_case와 camelCase 모두 지원
      const totalAmount = orderData.totalAmount || orderData.total_amount;
      const paymentMethod = orderData.paymentMethod || orderData.payment_method;
      const paymentId = orderData.paymentId || orderData.payment_id;
      const paymentStatus = orderData.paymentStatus || orderData.payment_status;
      const orderStatus = orderData.orderStatus || orderData.order_status;
      const customerId = orderData.customerId || orderData.customer_id;
      const sellerId = orderData.sellerId || orderData.seller_id;
      const shippingAddress = orderData.shippingAddress || orderData.shipping_address;
      const customerName = orderData.customerName || orderData.customer_name;
      const customerPhone = orderData.customerPhone || orderData.customer_phone;
      
      console.log("변환된 주문 데이터:", {
        totalAmount,
        paymentMethod,
        customerId,
        sellerId,
        customerName,
        customerPhone
      });
      
      // 주문 생성
      const [newOrder] = await db.insert(orders).values({
        customerId: customerId,
        sellerId: sellerId,
        totalAmount: totalAmount,
        paymentMethod: paymentMethod,
        paymentId: paymentId,
        paymentStatus: paymentStatus || (paymentMethod === 'bank_transfer' || paymentMethod === 'bank' ? 'awaiting_deposit' : 'pending'),
        orderStatus: orderStatus || (paymentMethod === 'bank_transfer' || paymentMethod === 'bank' ? 'awaiting_deposit' : 'pending'),
        shippingAddress: shippingAddress,
        customerName: customerName,
        customerPhone: customerPhone,
        notes: orderData.notes,
      }).returning();

      console.log("주문 생성 완료:", newOrder);

      // 주문 항목 생성
      if (orderData.items && orderData.items.length > 0) {
        const orderItemsData = orderData.items.map((item: any) => {
          const productId = item.productId || item.product_id;
          const selectedOptions = item.selectedOptions || item.selected_options;
          
          return {
            orderId: newOrder.id,
            productId: parseInt(productId),
            quantity: item.quantity || 1,
            price: item.price || 0,
            selectedOptions: selectedOptions || [],
          };
        });

        console.log("주문 항목 데이터:", orderItemsData);
        await db.insert(orderItems).values(orderItemsData);
        console.log("주문 항목 생성 완료:", orderItemsData.length, "개");
      }

      // 주문 정보를 상품 정보와 함께 조회
      const orderWithItems = await this.getOrderById(newOrder.id);

      // 관리자 알림 생성
      await this.createAdminNotification({
        type: "order",
        message: `새로운 주문이 접수되었습니다. (주문번호: ORD-${newOrder.id.toString().padStart(3, '0')})`,
        order_id: newOrder.id.toString(),
        reference_id: newOrder.id.toString()
      });

      // 판매자 알림 생성
      if (sellerId) {
        await this.createSellerNotification({
          sellerId: sellerId,
          type: "order",
          message: `새로운 주문이 접수되었습니다. (주문번호: ORD-${newOrder.id.toString().padStart(3, '0')})`,
          orderId: newOrder.id,
          referenceId: newOrder.id.toString()
        });
      }

      return orderWithItems;
    } catch (error) {
      console.error("주문 생성 오류:", error);
      throw error;
    }
  }

  async getOrderById(orderId: number): Promise<any> {
    try {
      const orderResult = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (!orderResult || orderResult.length === 0) {
        return null;
      }

      const order = orderResult[0];

      // 주문 항목 조회
      const items = await db
        .select({
          id: orderItems.id,
          productId: orderItems.productId,
          quantity: orderItems.quantity,
          price: orderItems.price,
          selectedOptions: orderItems.selectedOptions,
          product: products,
        })
        .from(orderItems)
        .leftJoin(products, eq(orderItems.productId, products.id))
        .where(eq(orderItems.orderId, orderId));

      return {
        ...order,
        orderItems: items,
      };
    } catch (error) {
      console.error("주문 조회 오류:", error);
      return null;
    }
  }

  async getOrdersByCustomer(customerId: string): Promise<any[]> {
    try {
      console.log("고객 주문 조회:", customerId);
      
      const customerOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.customerId, customerId))
        .orderBy(desc(orders.createdAt));

      console.log("조회된 주문 수:", customerOrders.length);

      // 각 주문의 항목 조회
      const ordersWithItems = await Promise.all(
        customerOrders.map(async (order) => {
          const items = await db
            .select({
              id: orderItems.id,
              productId: orderItems.productId,
              quantity: orderItems.quantity,
              price: orderItems.price,
              selectedOptions: orderItems.selectedOptions,
              product: products,
            })
            .from(orderItems)
            .leftJoin(products, eq(orderItems.productId, products.id))
            .where(eq(orderItems.orderId, order.id));

          return {
            ...order,
            id: `ORD-${order.id.toString().padStart(3, '0')}`,
            total_amount: Number(order.totalAmount),
            payment_status: order.paymentStatus,
            order_status: order.orderStatus,
            tracking_number: order.trackingNumber,
            shipping_company: order.shippingCompany,
            orderItems: items,
          };
        })
      );

      return ordersWithItems;
    } catch (error) {
      console.error("고객 주문 조회 오류:", error);
      return [];
    }
  }

  async getOrdersBySeller(sellerId: string): Promise<any[]> {
    try {
      console.log("판매자 주문 조회:", sellerId);
      
      const sellerOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.sellerId, sellerId))
        .orderBy(desc(orders.createdAt));

      console.log("조회된 주문 수:", sellerOrders.length);

      // 각 주문의 항목 조회
      const ordersWithItems = await Promise.all(
        sellerOrders.map(async (order) => {
          const items = await db
            .select({
              id: orderItems.id,
              productId: orderItems.productId,
              quantity: orderItems.quantity,
              price: orderItems.price,
              selectedOptions: orderItems.selectedOptions,
              product: products,
            })
            .from(orderItems)
            .leftJoin(products, eq(orderItems.productId, products.id))
            .where(eq(orderItems.orderId, order.id));

          return {
            ...order,
            id: `ORD-${order.id.toString().padStart(3, '0')}`,
            total_amount: Number(order.totalAmount),
            payment_status: order.paymentStatus,
            order_status: order.orderStatus,
            customer_name: order.customerName,
            customer_phone: order.customerPhone,
            tracking_number: order.trackingNumber,
            shipping_company: order.shippingCompany,
            orderItems: items,
          };
        })
      );

      return ordersWithItems;
    } catch (error) {
      console.error("판매자 주문 조회 오류:", error);
      return [];
    }
  }

  async updateOrderStatus(orderId: string, status: string): Promise<any | undefined> {
    try {
      console.log(`주문 상태 변경 시도: orderId=${orderId}, status=${status}`);
      
      // ORD-001 형식의 ID에서 숫자만 추출
      const numericId = parseInt(orderId.replace(/^ORD-0*/, ''));
      
      if (isNaN(numericId)) {
        console.error("유효하지 않은 주문 ID:", orderId);
        return undefined;
      }

      const [updatedOrder] = await db
        .update(orders)
        .set({ 
          orderStatus: status,
          updatedAt: new Date()
        })
        .where(eq(orders.id, numericId))
        .returning();

      if (!updatedOrder) {
        console.error("주문을 찾을 수 없음:", numericId);
        return undefined;
      }

      console.log("주문 상태 변경 성공:", updatedOrder);

      return {
        id: `ORD-${updatedOrder.id.toString().padStart(3, '0')}`,
        order_status: updatedOrder.orderStatus,
        payment_status: updatedOrder.paymentStatus,
        updatedAt: updatedOrder.updatedAt
      };
    } catch (error) {
      console.error("주문 상태 변경 오류:", error);
      return undefined;
    }
  }

  async updateOrderShipping(orderId: string, trackingNumber: string, shippingCompany: string): Promise<any | undefined> {
    try {
      console.log(`배송 정보 업데이트 시도: orderId=${orderId}, trackingNumber=${trackingNumber}, shippingCompany=${shippingCompany}`);
      
      // ORD-001 형식의 ID에서 숫자만 추출
      const numericId = parseInt(orderId.replace(/^ORD-0*/, ''));
      
      if (isNaN(numericId)) {
        console.error("유효하지 않은 주문 ID:", orderId);
        return undefined;
      }

      const [updatedOrder] = await db
        .update(orders)
        .set({ 
          trackingNumber: trackingNumber,
          shippingCompany: shippingCompany,
          orderStatus: 'shipped',
          updatedAt: new Date()
        })
        .where(eq(orders.id, numericId))
        .returning();

      if (!updatedOrder) {
        console.error("주문을 찾을 수 없음:", numericId);
        return undefined;
      }

      console.log("배송 정보 업데이트 성공:", updatedOrder);

      return {
        id: `ORD-${updatedOrder.id.toString().padStart(3, '0')}`,
        tracking_number: updatedOrder.trackingNumber,
        shipping_company: updatedOrder.shippingCompany,
        order_status: updatedOrder.orderStatus,
        payment_status: updatedOrder.paymentStatus,
        updatedAt: updatedOrder.updatedAt
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

  // Seller notifications operations
  async getSellerNotifications(sellerId: string): Promise<any[]> {
    try {
      const { sellerNotifications } = await import("../shared/schema");
      const results = await db
        .select()
        .from(sellerNotifications)
        .where(eq(sellerNotifications.sellerId, sellerId))
        .orderBy(desc(sellerNotifications.createdAt));
      
      return results.map((notif: any) => ({
        id: notif.id,
        type: notif.type,
        message: notif.message,
        order_id: notif.orderId,
        reference_id: notif.referenceId,
        is_read: notif.isRead,
        createdAt: notif.createdAt
      }));
    } catch (error) {
      console.error("판매자 알림 조회 오류:", error);
      return [];
    }
  }

  async createSellerNotification(notification: { sellerId: string; type: string; message: string; orderId?: number; referenceId?: string; }): Promise<any> {
    try {
      const { sellerNotifications } = await import("../shared/schema");
      const [newNotification] = await db
        .insert(sellerNotifications)
        .values({
          sellerId: notification.sellerId,
          type: notification.type,
          message: notification.message,
          orderId: notification.orderId,
          referenceId: notification.referenceId,
          isRead: false
        })
        .returning();
      
      console.log("판매자 알림 생성 완료:", newNotification);
      return newNotification;
    } catch (error) {
      console.error("판매자 알림 생성 오류:", error);
      throw error;
    }
  }

  async markSellerNotificationAsRead(notificationId: number): Promise<any | undefined> {
    try {
      const { sellerNotifications } = await import("../shared/schema");
      const [updated] = await db
        .update(sellerNotifications)
        .set({ isRead: true })
        .where(eq(sellerNotifications.id, notificationId))
        .returning();
      
      return updated;
    } catch (error) {
      console.error("판매자 알림 읽음 처리 오류:", error);
      return undefined;
    }
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

  // 아바타 크리에이터 소개글 콘텐츠 관련
  async updateCareManagerIntroContents(careManagerId: number, introContents: any[]): Promise<boolean> {
    try {
      // 아바타 크리에이터 테이블 업데이트
      await db.update(careManagers)
        .set({ introContents })
        .where(eq(careManagers.id, careManagerId));
      return true;
    } catch (error) {
      console.error("아바타 크리에이터 소개글 콘텐츠 업데이트 오류:", error);
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
      console.error("아바타 크리에이터 소개글 콘텐츠 조회 오류:", error);
      return null;
    }
  }

  async updateCareManagerServicePackages(careManagerId: number, packages: any[]): Promise<boolean> {
    try {
      // 아바타 크리에이터 테이블 업데이트
      await db.update(careManagers)
        .set({ servicePackages: packages as any })
        .where(eq(careManagers.id, careManagerId));
      return true;
    } catch (error) {
      console.error("아바타 크리에이터 서비스 패키지 업데이트 오류:", error);
      return false;
    }
  }

  async getCareManagerServicePackages(careManagerId: number): Promise<any[] | null> {
    try {
      const result = await db.select({ servicePackages: careManagers.servicePackages })
        .from(careManagers)
        .where(eq(careManagers.id, careManagerId));
      
      if (result.length === 0 || !result[0].servicePackages) {
        return null;
      }
      
      return result[0].servicePackages as any[];
    } catch (error) {
      console.error("아바타 크리에이터 서비스 패키지 조회 오류:", error);
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
    // db 객체가 존재하고 제대로 초기화되었는지 확인
    if (!db || typeof db.select !== 'function') {
      console.log("데이터베이스 객체가 초기화되지 않음");
      return false;
    }
    
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
  // 먼저 데이터베이스 초기화 시도
  const dbInitialized = await initializeDatabase();
  
  if (dbInitialized) {
    // 데이터베이스 연결 테스트
    const isConnected = await checkDatabaseConnection();
    
    if (isConnected) {
      console.log("✅ 데이터베이스 연결 성공 - DatabaseStorage 사용");
      storage = new DatabaseStorage();
    } else {
      console.log("⚠️  데이터베이스 초기화는 되었지만 연결 실패 - MemStorage 사용");
      storage = new MemStorage();
    }
  } else {
    console.log("⚠️  데이터베이스 초기화 실패 - MemStorage 사용");
    storage = new MemStorage();
  }
}

// 기본값으로 MemStorage 설정 (initializeStorage 호출 전까지)
storage = new MemStorage();
