-- 상품 카테고리 테이블
CREATE TABLE IF NOT EXISTS product_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  parent_id INTEGER REFERENCES product_categories(id) ON DELETE SET NULL,
  image_url VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  category_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 상품 테이블
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  category_id INTEGER REFERENCES product_categories(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(12, 2) NOT NULL,
  discount_price DECIMAL(12, 2),
  stock INTEGER NOT NULL DEFAULT 0,
  images JSONB,
  tags JSONB,
  status VARCHAR(20) DEFAULT 'active',
  rating DECIMAL(3, 2),
  review_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 장바구니 테이블
CREATE TABLE IF NOT EXISTS cart_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  selected_options JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 주소 테이블
CREATE TABLE IF NOT EXISTS addresses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  zipcode VARCHAR(10) NOT NULL,
  address1 VARCHAR(255) NOT NULL,
  address2 VARCHAR(255),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 주문 테이블
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  total_amount DECIMAL(12, 2) NOT NULL,
  shipping_address_id INTEGER REFERENCES addresses(id) ON DELETE SET NULL,
  payment_method VARCHAR(50) NOT NULL,
  payment_status VARCHAR(20) DEFAULT 'pending',
  order_status VARCHAR(20) DEFAULT 'pending',
  tracking_number VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 주문 상품 테이블
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  price DECIMAL(12, 2) NOT NULL,
  total_price DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 배송 알림 테이블
CREATE TABLE IF NOT EXISTS shipping_notifications (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status VARCHAR(10) DEFAULT 'unread',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);

CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);

CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_is_default ON addresses(is_default);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

CREATE INDEX IF NOT EXISTS idx_shipping_notifications_order_id ON shipping_notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_shipping_notifications_status ON shipping_notifications(status);

-- 샘플 데이터 삽입
INSERT INTO product_categories (name, description, is_active, category_order) VALUES
('가공식품', '가공된 식품류', TRUE, 1),
('건강식품', '건강 관련 식품', TRUE, 2),
('농산물', '신선한 농산물', TRUE, 3),
('수산물', '신선한 수산물', TRUE, 4),
('생활용품', '일상생활용품', TRUE, 5),
('전자제품', '전자기기 및 부품', TRUE, 6),
('패션', '의류 및 패션용품', TRUE, 7),
('디지털상품', '디지털 콘텐츠', TRUE, 8),
('주류', '주류 및 음료', TRUE, 9),
('카페/베이커리', '카페 및 베이커리 제품', TRUE, 10)
ON CONFLICT (name) DO NOTHING;

-- 샘플 상품 데이터 삽입 (seller_id는 실제 존재하는 user id를 사용해야 함)
INSERT INTO products (seller_id, category_id, title, description, price, discount_price, stock, images, tags, status, rating, review_count) VALUES
(1, 1, '프리미엄 김치', '전통 방식으로 만든 프리미엄 김치입니다.', 15000.00, 12000.00, 50, '["https://images.unsplash.com/photo-1516684669134-de6f7c473a2a?w=300"]'::jsonb, '["김치", "발효식품", "한식"]'::jsonb, 'active', 4.5, 23),
(1, 3, '유기농 배추', '무농약으로 재배한 신선한 유기농 배추입니다.', 8000.00, NULL, 30, '["https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=300"]'::jsonb, '["유기농", "배추", "농산물"]'::jsonb, 'active', 4.3, 15),
(1, 4, '자연산 고등어', '신선한 자연산 고등어입니다.', 12000.00, 10000.00, 20, '["https://images.unsplash.com/photo-1544943845-ad535c4eb135?w=300"]'::jsonb, '["고등어", "자연산", "수산물"]'::jsonb, 'active', 4.7, 8); 