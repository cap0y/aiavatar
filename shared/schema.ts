import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  boolean,
  json,
  decimal,
  serial,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import bcrypt from "bcryptjs";

// User types and grades
export type UserType = "customer" | "careManager" | "admin";
export type UserGrade = "bronze" | "silver" | "gold" | "platinum";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").unique(),
  displayName: text("display_name"),
  photoURL: text("photo_url"),
  bio: text("bio"), // 사용자 소개
  userType: text("user_type").default("customer"),
  grade: text("grade").default("bronze"),
  status: text("status").default("active"), // 사용자 계정 상태
  isApproved: boolean("is_approved").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const careManagers = pgTable("care_managers", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  name: text("name").notNull(),
  age: integer("age"),
  specialization: text("specialization"),
  experience: text("experience"),
  rating: decimal("rating", { precision: 3, scale: 2 }),
  reviews: integer("reviews").default(0),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  location: text("location"),
  photoURL: text("photo_url"),
  description: text("description"),
  certified: boolean("certified").default(false),
  isApproved: boolean("is_approved").default(false),
  introContents: json("intro_contents").$type<any>(),
  servicePackages: json("service_packages").$type<any>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }),
  duration: integer("duration"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"), // 외래 키 제약 조건 제거 (Firebase UID 호환성)
  careManagerId: integer("care_manager_id"), // 외래 키 제약 조건 제거 (유연성)
  serviceId: integer("service_id"), // 외래 키 제약 조건 제거 (services 테이블이 비어있을 수 있음)
  bookingDate: timestamp("booking_date", { withTimezone: true }),
  duration: integer("duration"),
  status: text("status").default("pending"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: varchar("sender_id"),
  receiverId: varchar("receiver_id"),
  content: text("content").notNull(),
  messageType: text("message_type").default("text"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const notices = pgTable("notices", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const productCategories = pgTable("product_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  parentId: integer("parent_id"),
  categoryOrder: integer("category_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  sellerId: varchar("seller_id"), // 외래 키 제약 조건 제거 (Firebase UID 호환성)
  categoryId: integer("category_id").references(() => productCategories.id),
  name: text("name").notNull(),
  title: text("title"),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }),
  discountPrice: decimal("discount_price", { precision: 10, scale: 2 }),
  images: json("images").$type<string[]>(),
  digitalFiles: json("digital_files").$type<any>(), // 디지털 상품 파일 URL 배열
  isDigital: boolean("is_digital").default(false), // 디지털 상품 여부
  stock: integer("stock").default(0),
  rating: decimal("rating", { precision: 3, scale: 2 }),
  reviewCount: integer("review_count").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerId: varchar("customer_id"), // 외래 키 제약 조건 제거 (Firebase UID 호환성)
  sellerId: varchar("seller_id"), // 외래 키 제약 조건 제거 (Firebase UID 호환성)
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method"), // "card", "bank_transfer", "virtual_account" 등
  paymentId: text("payment_id"), // 포트원 결제 ID
  paymentStatus: text("payment_status").default("pending"), // "pending", "paid", "failed", "cancelled"
  orderStatus: text("order_status").default("pending"), // "pending", "awaiting_deposit", "processing", "shipped", "delivered", "cancelled"
  shippingAddressId: integer("shipping_address_id"),
  shippingAddress: json("shipping_address").$type<any>(), // 배송지 정보
  trackingNumber: text("tracking_number"),
  shippingCompany: text("shipping_company"),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id),
  productId: integer("product_id").references(() => products.id),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(), // 주문 당시 가격
  selectedOptions: json("selected_options").$type<any>(), // 선택한 옵션들
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const favorites = pgTable("favorites", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  productId: integer("product_id").references(() => products.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const inquiries = pgTable("inquiries", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  status: text("status").default("pending"),
  answer: text("answer"),
  answeredBy: varchar("answered_by"),
  answeredAt: timestamp("answered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const userNotificationSettings = pgTable("user_notification_settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  emailNotifications: boolean("email_notifications").default(true),
  pushNotifications: boolean("push_notifications").default(true),
  smsNotifications: boolean("sms_notifications").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const userPrivacySettings = pgTable("user_privacy_settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  profileVisibility: text("profile_visibility").default("public"),
  contactVisibility: text("contact_visibility").default("private"),
  activityVisibility: text("activity_visibility").default("friends"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const productReviews = pgTable("product_reviews", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  productId: integer("product_id").references(() => products.id),
  rating: integer("rating"),
  content: text("content"),
  isVerifiedPurchase: boolean("is_verified_purchase").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const productComments = pgTable("product_comments", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  productId: integer("product_id").references(() => products.id),
  parentId: integer("parent_id"),
  content: text("content").notNull(),
  isSellerReply: boolean("is_seller_reply").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  productId: integer("product_id").references(() => products.id),
  quantity: integer("quantity").default(1),
  selectedOptions: json("selected_options").$type<any>(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

export const sellerNotifications = pgTable("seller_notifications", {
  id: serial("id").primaryKey(),
  sellerId: varchar("seller_id"), // 판매자 ID (Firebase UID)
  type: text("type").notNull(), // "order", "review", "inquiry" 등
  message: text("message").notNull(),
  orderId: integer("order_id"), // 관련 주문 ID
  referenceId: text("reference_id"), // 참조 ID (주문번호 등)
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Reddit-style feed posts
export const feedPosts = pgTable("feed_posts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"), // 작성자 ID (Firebase UID)
  title: text("title").notNull(),
  content: text("content"),
  mediaType: text("media_type"), // "image", "video", "text", "youtube"
  mediaUrl: text("media_url"), // 이미지 또는 비디오 URL (단일, 하위 호환성)
  mediaUrls: json("media_urls").$type<string[]>(), // 다중 이미지/비디오 URL 배열
  thumbnailUrl: text("thumbnail_url"), // 비디오 썸네일
  youtubeUrl: text("youtube_url"), // 유튜브 링크
  upvotes: integer("upvotes").default(0),
  downvotes: integer("downvotes").default(0),
  commentCount: integer("comment_count").default(0),
  viewCount: integer("view_count").default(0),
  reportCount: integer("report_count").default(0), // 신고 횟수
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const feedPostComments = pgTable("feed_post_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => feedPosts.id),
  userId: varchar("user_id"), // 댓글 작성자 ID
  parentId: integer("parent_id"), // 대댓글용
  content: text("content").notNull(),
  upvotes: integer("upvotes").default(0),
  downvotes: integer("downvotes").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const feedPostVotes = pgTable("feed_post_votes", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => feedPosts.id),
  userId: varchar("user_id"), // 투표한 사용자 ID
  voteType: text("vote_type").notNull(), // "upvote" or "downvote"
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const feedPostCommentVotes = pgTable("feed_post_comment_votes", {
  id: serial("id").primaryKey(),
  commentId: integer("comment_id").references(() => feedPostComments.id),
  userId: varchar("user_id"), // 투표한 사용자 ID
  voteType: text("vote_type").notNull(), // "upvote" or "downvote"
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// 북마크 테이블
export const feedPostBookmarks = pgTable("feed_post_bookmarks", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => feedPosts.id, {
    onDelete: "cascade",
  }),
  userId: varchar("user_id").notNull(), // 북마크한 사용자 ID
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// 이모티콘 반응 테이블
export const feedPostReactions = pgTable("feed_post_reactions", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => feedPosts.id, {
    onDelete: "cascade",
  }),
  userId: varchar("user_id").notNull(), // 반응한 사용자 ID
  emoji: text("emoji").notNull(), // 이모티콘 (예: "👍", "❤️", "😂", "😮", "😢", "😡")
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// 게시물 신고 테이블
export const feedPostReports = pgTable("feed_post_reports", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => feedPosts.id, {
    onDelete: "cascade",
  }),
  userId: varchar("user_id").notNull(), // 신고한 사용자 ID
  reason: text("reason").notNull(), // 신고 사유
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Create insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  displayName: true,
  photoURL: true,
  userType: true,
  grade: true,
  isApproved: true,
});

export const insertCareManagerSchema = createInsertSchema(careManagers).omit({
  id: true,
  createdAt: true,
});
export const insertServiceSchema = createInsertSchema(services).omit({
  id: true,
  createdAt: true,
});
export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  createdAt: true,
});
export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});
export const insertNoticeSchema = createInsertSchema(notices).omit({
  id: true,
  createdAt: true,
});
export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});
export const insertProductCategorySchema = createInsertSchema(
  productCategories,
).omit({ id: true, createdAt: true });
export const insertFavoriteSchema = createInsertSchema(favorites).omit({
  id: true,
  createdAt: true,
});
export const insertInquirySchema = createInsertSchema(inquiries).omit({
  id: true,
  createdAt: true,
});
export const insertUserNotificationSettingsSchema = createInsertSchema(
  userNotificationSettings,
).omit({ id: true, createdAt: true });
export const insertUserPrivacySettingsSchema = createInsertSchema(
  userPrivacySettings,
).omit({ id: true, createdAt: true });
export const insertProductReviewSchema = createInsertSchema(
  productReviews,
).omit({ id: true, createdAt: true });
export const insertProductCommentSchema = createInsertSchema(
  productComments,
).omit({ id: true, createdAt: true });
export const insertCartItemSchema = createInsertSchema(cartItems).omit({
  id: true,
  createdAt: true,
});
export const insertFeedPostSchema = createInsertSchema(feedPosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertFeedPostCommentSchema = createInsertSchema(
  feedPostComments,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFeedPostVoteSchema = createInsertSchema(feedPostVotes).omit({
  id: true,
  createdAt: true,
});
export const insertFeedPostCommentVoteSchema = createInsertSchema(
  feedPostCommentVotes,
).omit({ id: true, createdAt: true });

// Export types
export type User = typeof users.$inferSelect;
export type CareManager = typeof careManagers.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Notice = typeof notices.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductCategory = typeof productCategories.$inferSelect;
export type Favorite = typeof favorites.$inferSelect;
export type Inquiry = typeof inquiries.$inferSelect;
export type UserNotificationSettings =
  typeof userNotificationSettings.$inferSelect;
export type UserPrivacySettings = typeof userPrivacySettings.$inferSelect;
export type ProductReview = typeof productReviews.$inferSelect;
export type ProductComment = typeof productComments.$inferSelect;
export type CartItem = typeof cartItems.$inferSelect;
export type FeedPost = typeof feedPosts.$inferSelect;
export type FeedPostComment = typeof feedPostComments.$inferSelect;
export type FeedPostVote = typeof feedPostVotes.$inferSelect;
export type FeedPostCommentVote = typeof feedPostCommentVotes.$inferSelect;

// Export insert types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertCareManager = z.infer<typeof insertCareManagerSchema>;
export type InsertService = z.infer<typeof insertServiceSchema>;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertNotice = z.infer<typeof insertNoticeSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertProductCategory = z.infer<typeof insertProductCategorySchema>;
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type InsertInquiry = z.infer<typeof insertInquirySchema>;
export type InsertUserNotificationSettings = z.infer<
  typeof insertUserNotificationSettingsSchema
>;
export type InsertUserPrivacySettings = z.infer<
  typeof insertUserPrivacySettingsSchema
>;
export type InsertProductReview = z.infer<typeof insertProductReviewSchema>;
export type InsertProductComment = z.infer<typeof insertProductCommentSchema>;
export type InsertCartItem = z.infer<typeof insertCartItemSchema>;
export type InsertFeedPost = z.infer<typeof insertFeedPostSchema>;
export type InsertFeedPostComment = z.infer<typeof insertFeedPostCommentSchema>;
export type InsertFeedPostVote = z.infer<typeof insertFeedPostVoteSchema>;
export type InsertFeedPostCommentVote = z.infer<
  typeof insertFeedPostCommentVoteSchema
>;

// Channel messages table (채널 방명록/메시지)
export const channelMessages = pgTable("channel_messages", {
  id: serial("id").primaryKey(),
  channelUserId: varchar("channel_user_id").notNull(), // 채널 소유자
  senderUserId: varchar("sender_user_id").notNull(), // 메시지 작성자
  message: text("message").notNull(),
  imageUrl: text("image_url"), // 이미지 URL (Cloudinary)
  isPrivate: boolean("is_private").default(false), // 비공개 메시지 여부
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Channel subscriptions table (채널 구독)
export const channelSubscriptions = pgTable("channel_subscriptions", {
  id: serial("id").primaryKey(),
  subscriberId: varchar("subscriber_id").notNull(), // 구독자 ID
  channelUserId: varchar("channel_user_id").notNull(), // 채널 소유자 ID (구독 대상)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Password utility functions
export async function createUserWithHash(
  userData: Omit<InsertUser, "password"> & { password: string },
): Promise<InsertUser> {
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(userData.password, saltRounds);
  return {
    ...userData,
    password: hashedPassword,
  };
}

export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string,
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}
