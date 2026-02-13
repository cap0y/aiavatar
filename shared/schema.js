import { pgTable, text, serial, integer, boolean, timestamp, jsonb, decimal } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import bcrypt from "bcrypt";
export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    email: text("email").notNull().unique(),
    password: text("password").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    userType: text("user_type").$type().default('customer'),
    grade: text("grade").$type().default('bronze'),
    isApproved: boolean("is_approved").default(false),
    isCertified: boolean("is_certified").default(false),
    certificationDate: timestamp("certification_date"),
    certificationPaymentId: text("certification_payment_id"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});
export const careManagers = pgTable("care_managers", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    age: integer("age").notNull(),
    rating: integer("rating").notNull(), // stored as integer (e.g., 49 for 4.9)
    reviews: integer("reviews").notNull().default(0),
    experience: text("experience").notNull(),
    location: text("location").notNull(),
    hourlyRate: integer("hourly_rate").notNull(),
    services: jsonb("services").notNull(), // array of service names
    certified: boolean("certified").notNull().default(false),
    isApproved: boolean("is_approved").default(false),
    imageUrl: text("image_url"),
    description: text("description"),
    introContents: jsonb("intro_contents"),
    createdAt: timestamp("created_at").defaultNow(),
});
export const services = pgTable("services", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    icon: text("icon").notNull(),
    color: text("color").notNull(),
    description: text("description"),
    averageDuration: text("average_duration"),
});
export const bookings = pgTable("bookings", {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(), // integer에서 text로 변경
    careManagerId: integer("care_manager_id").notNull(),
    serviceId: integer("service_id").notNull(),
    date: timestamp("date").notNull(),
    duration: integer("duration").notNull(), // in hours
    status: text("status").notNull().default("pending"), // pending, confirmed, ongoing, completed, cancelled
    totalAmount: integer("total_amount").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
});
export const messages = pgTable("messages", {
    id: serial("id").primaryKey(),
    senderId: integer("sender_id").notNull(),
    receiverId: integer("receiver_id").notNull(),
    content: text("content").notNull(),
    timestamp: timestamp("timestamp").defaultNow(),
    isRead: boolean("is_read").notNull().default(false),
});
// 공지사항 테이블 추가
export const notices = pgTable("notices", {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    date: text("date").notNull(),
    isImportant: boolean("is_important").default(false),
    category: text("category").default("notice"),
});
// ==================== 쇼핑몰 관련 테이블 ====================
// 상품 카테고리 테이블
export const productCategories = pgTable("product_categories", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    parentId: integer("parent_id"),
    imageUrl: text("image_url"),
    isActive: boolean("is_active").default(true),
    categoryOrder: integer("category_order").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});
// 상품 테이블
export const products = pgTable("products", {
    id: serial("id").primaryKey(),
    sellerId: integer("seller_id"),
    categoryId: integer("category_id"),
    title: text("title").notNull(),
    description: text("description"),
    price: decimal("price", { precision: 12, scale: 2 }).notNull(),
    discountPrice: decimal("discount_price", { precision: 12, scale: 2 }),
    stock: integer("stock").notNull().default(0),
    images: jsonb("images"), // array of image URLs
    tags: jsonb("tags"), // array of tags
    status: text("status").default("active"), // active, sold_out, hidden, deleted
    rating: decimal("rating", { precision: 3, scale: 2 }),
    reviewCount: integer("review_count").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});
// 장바구니 테이블
export const cartItems = pgTable("cart_items", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    productId: integer("product_id").notNull(),
    quantity: integer("quantity").notNull().default(1),
    selectedOptions: jsonb("selected_options"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});
// 주소 테이블
export const addresses = pgTable("addresses", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    zipcode: text("zipcode").notNull(),
    address1: text("address1").notNull(),
    address2: text("address2"),
    isDefault: boolean("is_default").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});
// 주문 테이블
export const orders = pgTable("orders", {
    id: serial("id").primaryKey(),
    userId: integer("user_id"),
    totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
    shippingAddressId: integer("shipping_address_id"),
    paymentMethod: text("payment_method").notNull(),
    paymentStatus: text("payment_status").default("pending"),
    orderStatus: text("order_status").default("pending"),
    trackingNumber: text("tracking_number"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});
// 주문 상품 테이블
export const orderItems = pgTable("order_items", {
    id: serial("id").primaryKey(),
    orderId: integer("order_id").notNull(),
    productId: integer("product_id"),
    quantity: integer("quantity").notNull(),
    price: decimal("price", { precision: 12, scale: 2 }).notNull(),
    totalPrice: decimal("total_price", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
});
// 배송 알림 테이블
export const shippingNotifications = pgTable("shipping_notifications", {
    id: serial("id").primaryKey(),
    orderId: integer("order_id").notNull(),
    message: text("message").notNull(),
    status: text("status").default("unread"),
    createdAt: timestamp("created_at").defaultNow(),
});
// ==================== 상품 리뷰 및 문의 테이블 ====================
// 상품 리뷰 테이블
export const productReviews = pgTable("product_reviews", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    productId: integer("product_id").notNull(),
    rating: integer("rating").notNull(), // 1-5 별점 평가
    comment: text("comment").notNull(),
    images: jsonb("images"), // 리뷰 이미지 (선택 사항)
    isVerifiedPurchase: boolean("is_verified_purchase").default(false), // 구매 확인 여부
    status: text("status").default("active"), // active, hidden, deleted
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});
// 상품 문의 테이블
export const productComments = pgTable("product_comments", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    productId: integer("product_id").notNull(),
    content: text("content").notNull(),
    isPrivate: boolean("is_private").default(false), // 비밀 문의 여부
    status: text("status").default("active"), // active, answered, hidden, deleted
    parentId: integer("parent_id"), // 답글인 경우 원 문의의 ID (self-reference)
    isAdmin: boolean("is_admin").default(false), // 관리자 답변 여부
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});
// ==================== 새로운 기능 테이블들 ====================
// 찜한 크리에이터테이블
export const favorites = pgTable("favorites", {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    careManagerId: integer("care_manager_id").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
});
// 문의 관리 테이블
export const inquiries = pgTable("inquiries", {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    subject: text("subject").notNull(),
    category: text("category").notNull(), // account, service, payment, cancel, technical, other
    message: text("message").notNull(),
    urgency: text("urgency").default("normal"), // urgent, high, normal, low
    status: text("status").default("pending"), // pending, in_progress, answered, closed
    answer: text("answer"),
    answeredBy: text("answered_by"),
    answeredAt: timestamp("answered_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});
// 사용자 알림 설정 테이블
export const userNotificationSettings = pgTable("user_notification_settings", {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().unique(),
    pushNotifications: boolean("push_notifications").default(true),
    emailNotifications: boolean("email_notifications").default(true),
    smsNotifications: boolean("sms_notifications").default(false),
    bookingReminders: boolean("booking_reminders").default(true),
    promotionAlerts: boolean("promotion_alerts").default(true),
    serviceUpdates: boolean("service_updates").default(true),
    careManagerMessages: boolean("care_manager_messages").default(true),
    systemNotifications: boolean("system_notifications").default(true),
    updatedAt: timestamp("updated_at").defaultNow(),
});
// 사용자 개인정보 보호 설정 테이블
export const userPrivacySettings = pgTable("user_privacy_settings", {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().unique(),
    profileVisible: boolean("profile_visible").default(true),
    showLocation: boolean("show_location").default(true),
    showAge: boolean("show_age").default(false),
    showPhone: boolean("show_phone").default(false),
    allowDataCollection: boolean("allow_data_collection").default(false),
    allowMarketingEmails: boolean("allow_marketing_emails").default(false),
    twoFactorEnabled: boolean("two_factor_enabled").default(false),
    accountDeletionRequested: boolean("account_deletion_requested").default(false),
    updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertUserSchema = createInsertSchema(users)
    .refine(async (data) => {
    if (!data.password)
        return false;
    return true;
}, { message: "Password is required", path: ["password"] });
// 암호화된 비밀번호로 사용자 생성하는 함수
export const createUserWithHash = async (userData) => {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(userData.password, saltRounds);
    return {
        ...userData,
        password: hashedPassword,
    };
};
// 비밀번호 검증 함수
export const verifyPassword = async (plainPassword, hashedPassword) => {
    return await bcrypt.compare(plainPassword, hashedPassword);
};
export const insertCareManagerSchema = createInsertSchema(careManagers).omit({
    id: true,
    createdAt: true,
});
export const insertServiceSchema = createInsertSchema(services).omit({
    id: true,
});
export const insertBookingSchema = createInsertSchema(bookings).omit({
    id: true,
    createdAt: true,
});
export const insertMessageSchema = createInsertSchema(messages).omit({
    id: true,
    timestamp: true,
});
// 상품 관련 스키마
export const insertProductCategorySchema = createInsertSchema(productCategories).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
export const insertProductSchema = createInsertSchema(products).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
export const insertCartItemSchema = createInsertSchema(cartItems).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
export const insertAddressSchema = createInsertSchema(addresses).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
export const insertOrderSchema = createInsertSchema(orders).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
    id: true,
    createdAt: true,
});
// 새로운 기능들을 위한 스키마
export const insertFavoriteSchema = createInsertSchema(favorites).omit({
    id: true,
    createdAt: true,
});
export const insertInquirySchema = createInsertSchema(inquiries).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
export const insertUserNotificationSettingsSchema = createInsertSchema(userNotificationSettings).omit({
    id: true,
    updatedAt: true,
});
export const insertUserPrivacySettingsSchema = createInsertSchema(userPrivacySettings).omit({
    id: true,
    updatedAt: true,
});
// Relations
export const usersRelations = relations(users, ({ many }) => ({
    bookings: many(bookings),
    sentMessages: many(messages, { relationName: "sender" }),
    receivedMessages: many(messages, { relationName: "receiver" }),
    products: many(products),
    cartItems: many(cartItems),
    addresses: many(addresses),
    orders: many(orders),
    favorites: many(favorites),
    inquiries: many(inquiries),
    notificationSettings: many(userNotificationSettings),
    privacySettings: many(userPrivacySettings),
}));
export const careManagersRelations = relations(careManagers, ({ many }) => ({
    bookings: many(bookings),
}));
export const servicesRelations = relations(services, ({ many }) => ({
    bookings: many(bookings),
}));
export const bookingsRelations = relations(bookings, ({ one }) => ({
    user: one(users, {
        fields: [bookings.userId],
        references: [users.id],
    }),
    careManager: one(careManagers, {
        fields: [bookings.careManagerId],
        references: [careManagers.id],
    }),
    service: one(services, {
        fields: [bookings.serviceId],
        references: [services.id],
    }),
}));
export const messagesRelations = relations(messages, ({ one }) => ({
    sender: one(users, {
        fields: [messages.senderId],
        references: [users.id],
        relationName: "sender",
    }),
    receiver: one(users, {
        fields: [messages.receiverId],
        references: [users.id],
        relationName: "receiver",
    }),
}));
// 상품 관련 Relations
export const productCategoriesRelations = relations(productCategories, ({ one, many }) => ({
    parent: one(productCategories, {
        fields: [productCategories.parentId],
        references: [productCategories.id],
    }),
    children: many(productCategories),
    products: many(products),
}));
export const productsRelations = relations(products, ({ one, many }) => ({
    seller: one(users, {
        fields: [products.sellerId],
        references: [users.id],
    }),
    category: one(productCategories, {
        fields: [products.categoryId],
        references: [productCategories.id],
    }),
    cartItems: many(cartItems),
    orderItems: many(orderItems),
}));
export const cartItemsRelations = relations(cartItems, ({ one }) => ({
    user: one(users, {
        fields: [cartItems.userId],
        references: [users.id],
    }),
    product: one(products, {
        fields: [cartItems.productId],
        references: [products.id],
    }),
}));
export const addressesRelations = relations(addresses, ({ one, many }) => ({
    user: one(users, {
        fields: [addresses.userId],
        references: [users.id],
    }),
    orders: many(orders),
}));
export const ordersRelations = relations(orders, ({ one, many }) => ({
    user: one(users, {
        fields: [orders.userId],
        references: [users.id],
    }),
    shippingAddress: one(addresses, {
        fields: [orders.shippingAddressId],
        references: [addresses.id],
    }),
    orderItems: many(orderItems),
    shippingNotifications: many(shippingNotifications),
}));
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
    order: one(orders, {
        fields: [orderItems.orderId],
        references: [orders.id],
    }),
    product: one(products, {
        fields: [orderItems.productId],
        references: [products.id],
    }),
}));
export const shippingNotificationsRelations = relations(shippingNotifications, ({ one }) => ({
    order: one(orders, {
        fields: [shippingNotifications.orderId],
        references: [orders.id],
    }),
}));
// 새로운 기능들을 위한 Relations
export const favoritesRelations = relations(favorites, ({ one }) => ({
    user: one(users, {
        fields: [favorites.userId],
        references: [users.id],
    }),
    careManager: one(careManagers, {
        fields: [favorites.careManagerId],
        references: [careManagers.id],
    }),
}));
export const inquiriesRelations = relations(inquiries, ({ one }) => ({
    user: one(users, {
        fields: [inquiries.userId],
        references: [users.id],
    }),
}));
export const userNotificationSettingsRelations = relations(userNotificationSettings, ({ one }) => ({
    user: one(users, {
        fields: [userNotificationSettings.userId],
        references: [users.id],
    }),
}));
export const userPrivacySettingsRelations = relations(userPrivacySettings, ({ one }) => ({
    user: one(users, {
        fields: [userPrivacySettings.userId],
        references: [users.id],
    }),
}));
// 공지사항 타입 추가
export const insertNoticeSchema = createInsertSchema(notices).omit({
    id: true,
});
// 추가된 테이블들의 zod 스키마 정의
export const insertProductReviewSchema = createInsertSchema(productReviews)
    .extend({
    rating: z.number().min(1).max(5),
    comment: z.string().min(1),
});
export const insertProductCommentSchema = createInsertSchema(productComments);
