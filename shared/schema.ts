import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, json, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import bcrypt from "bcryptjs";

// User types and grades
export type UserType = 'customer' | 'careManager' | 'admin';
export type UserGrade = 'bronze' | 'silver' | 'gold' | 'platinum';

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").unique(),
  displayName: text("display_name"),
  photoURL: text("photo_url"),
  userType: text("user_type").default('customer'),
  grade: text("grade").default('bronze'),
  isApproved: boolean("is_approved").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const careManagers = pgTable("care_managers", {
  id: integer("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  name: text("name").notNull(),
  specialization: text("specialization"),
  experience: text("experience"),
  rating: decimal("rating", { precision: 3, scale: 2 }),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  location: text("location"),
  photoURL: text("photo_url"),
  isApproved: boolean("is_approved").default(false),
  introContents: json("intro_contents"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const services = pgTable("services", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }),
  duration: integer("duration"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bookings = pgTable("bookings", {
  id: integer("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  careManagerId: integer("care_manager_id").references(() => careManagers.id),
  serviceId: integer("service_id").references(() => services.id),
  bookingDate: timestamp("booking_date"),
  duration: integer("duration"),
  status: text("status").default('pending'),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: integer("id").primaryKey(),
  senderId: integer("sender_id"),
  receiverId: integer("receiver_id"),
  content: text("content").notNull(),
  messageType: text("message_type").default('text'),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notices = pgTable("notices", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const productCategories = pgTable("product_categories", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  parentId: integer("parent_id"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const products = pgTable("products", {
  id: integer("id").primaryKey(),
  sellerId: integer("seller_id"),
  categoryId: integer("category_id").references(() => productCategories.id),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }),
  images: json("images"),
  stock: integer("stock").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const favorites = pgTable("favorites", {
  id: integer("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  productId: integer("product_id").references(() => products.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const inquiries = pgTable("inquiries", {
  id: integer("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  status: text("status").default('pending'),
  answer: text("answer"),
  answeredBy: varchar("answered_by"),
  answeredAt: timestamp("answered_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userNotificationSettings = pgTable("user_notification_settings", {
  id: integer("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  emailNotifications: boolean("email_notifications").default(true),
  pushNotifications: boolean("push_notifications").default(true),
  smsNotifications: boolean("sms_notifications").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userPrivacySettings = pgTable("user_privacy_settings", {
  id: integer("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  profileVisibility: text("profile_visibility").default('public'),
  contactVisibility: text("contact_visibility").default('private'),
  activityVisibility: text("activity_visibility").default('friends'),
  createdAt: timestamp("created_at").defaultNow(),
});

export const productReviews = pgTable("product_reviews", {
  id: integer("id").primaryKey(),
  userId: integer("user_id"),
  productId: integer("product_id").references(() => products.id),
  rating: integer("rating"),
  content: text("content"),
  isVerifiedPurchase: boolean("is_verified_purchase").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const productComments = pgTable("product_comments", {
  id: integer("id").primaryKey(),
  userId: integer("user_id"),
  productId: integer("product_id").references(() => products.id),
  parentId: integer("parent_id"),
  content: text("content").notNull(),
  isSellerReply: boolean("is_seller_reply").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cartItems = pgTable("cart_items", {
  id: integer("id").primaryKey(),
  userId: integer("user_id"),
  productId: integer("product_id").references(() => products.id),
  quantity: integer("quantity").default(1),
  selectedOptions: json("selected_options"),
  createdAt: timestamp("created_at").defaultNow(),
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

export const insertCareManagerSchema = createInsertSchema(careManagers).omit({ id: true, createdAt: true });
export const insertServiceSchema = createInsertSchema(services).omit({ id: true, createdAt: true });
export const insertBookingSchema = createInsertSchema(bookings).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertNoticeSchema = createInsertSchema(notices).omit({ id: true, createdAt: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true });
export const insertProductCategorySchema = createInsertSchema(productCategories).omit({ id: true, createdAt: true });
export const insertFavoriteSchema = createInsertSchema(favorites).omit({ id: true, createdAt: true });
export const insertInquirySchema = createInsertSchema(inquiries).omit({ id: true, createdAt: true });
export const insertUserNotificationSettingsSchema = createInsertSchema(userNotificationSettings).omit({ id: true, createdAt: true });
export const insertUserPrivacySettingsSchema = createInsertSchema(userPrivacySettings).omit({ id: true, createdAt: true });
export const insertProductReviewSchema = createInsertSchema(productReviews).omit({ id: true, createdAt: true });
export const insertProductCommentSchema = createInsertSchema(productComments).omit({ id: true, createdAt: true });
export const insertCartItemSchema = createInsertSchema(cartItems).omit({ id: true, createdAt: true });

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
export type UserNotificationSettings = typeof userNotificationSettings.$inferSelect;
export type UserPrivacySettings = typeof userPrivacySettings.$inferSelect;
export type ProductReview = typeof productReviews.$inferSelect;
export type ProductComment = typeof productComments.$inferSelect;
export type CartItem = typeof cartItems.$inferSelect;

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
export type InsertUserNotificationSettings = z.infer<typeof insertUserNotificationSettingsSchema>;
export type InsertUserPrivacySettings = z.infer<typeof insertUserPrivacySettingsSchema>;
export type InsertProductReview = z.infer<typeof insertProductReviewSchema>;
export type InsertProductComment = z.infer<typeof insertProductCommentSchema>;
export type InsertCartItem = z.infer<typeof insertCartItemSchema>;

// Password utility functions
export async function createUserWithHash(userData: Omit<InsertUser, 'password'> & { password: string }): Promise<InsertUser> {
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(userData.password, saltRounds);
  return {
    ...userData,
    password: hashedPassword,
  };
}

export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}
