-- AI아바타세상 데이터베이스 완전 설정
-- 실행 순서: 이 파일 전체를 데이터베이스에서 실행

-- ============================================
-- 1. 기존 테이블 삭제 (있다면)
-- ============================================
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS favorites CASCADE;
DROP TABLE IF EXISTS product_reviews CASCADE;
DROP TABLE IF EXISTS product_comments CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS product_categories CASCADE;
DROP TABLE IF EXISTS inquiries CASCADE;
DROP TABLE IF EXISTS user_notification_settings CASCADE;
DROP TABLE IF EXISTS user_privacy_settings CASCADE;
DROP TABLE IF EXISTS notices CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS care_managers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================
-- 2. 사용자 테이블 생성
-- ============================================
CREATE TABLE users (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    email TEXT UNIQUE,
    display_name TEXT,
    photo_url TEXT,
    user_type TEXT DEFAULT 'customer',
    grade TEXT DEFAULT 'bronze',
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. 케어매니저 테이블 생성
-- ============================================
CREATE TABLE care_managers (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR REFERENCES users(id),
    name TEXT NOT NULL,
    specialization TEXT,
    experience TEXT,
    rating DECIMAL(3, 2),
    hourly_rate DECIMAL(10, 2),
    location TEXT,
    photo_url TEXT,
    is_approved BOOLEAN DEFAULT false,
    intro_contents JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 4. 서비스 테이블 생성
-- ============================================
CREATE TABLE services (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    base_price DECIMAL(10, 2),
    duration INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. 예약 테이블 생성
-- ============================================
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR REFERENCES users(id),
    care_manager_id INTEGER REFERENCES care_managers(id),
    service_id INTEGER REFERENCES services(id),
    booking_date TIMESTAMP WITH TIME ZONE,
    duration INTEGER,
    status TEXT DEFAULT 'pending',
    total_amount DECIMAL(10, 2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 6. 메시지 테이블 생성
-- ============================================
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    sender_id VARCHAR REFERENCES users(id),
    receiver_id VARCHAR REFERENCES users(id),
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 7. 공지사항 테이블 생성
-- ============================================
CREATE TABLE notices (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 8. 상품 카테고리 테이블 생성 (아바타 전용)
-- ============================================
CREATE TABLE product_categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    parent_id INTEGER REFERENCES product_categories(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    category_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 9. 상품 테이블 생성 (아바타 전용)
-- ============================================
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER,
    category_id INTEGER REFERENCES product_categories(id),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10, 2),
    discount_price DECIMAL(10, 2),
    images JSONB,
    stock INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    rating DECIMAL(3, 2),
    review_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 10. 즐겨찾기 테이블 생성
-- ============================================
CREATE TABLE favorites (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR REFERENCES users(id),
    product_id INTEGER REFERENCES products(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 11. 문의 테이블 생성
-- ============================================
CREATE TABLE inquiries (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR REFERENCES users(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    answer TEXT,
    answered_by VARCHAR,
    answered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 12. 사용자 알림 설정 테이블 생성
-- ============================================
CREATE TABLE user_notification_settings (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR REFERENCES users(id),
    email_notifications BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT true,
    sms_notifications BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 13. 사용자 개인정보 설정 테이블 생성
-- ============================================
CREATE TABLE user_privacy_settings (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR REFERENCES users(id),
    profile_visibility TEXT DEFAULT 'public',
    contact_visibility TEXT DEFAULT 'private',
    activity_visibility TEXT DEFAULT 'friends',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 14. 상품 리뷰 테이블 생성
-- ============================================
CREATE TABLE product_reviews (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR REFERENCES users(id),
    product_id INTEGER REFERENCES products(id),
    rating INTEGER,
    content TEXT,
    is_verified_purchase BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 15. 상품 댓글 테이블 생성
-- ============================================
CREATE TABLE product_comments (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR REFERENCES users(id),
    product_id INTEGER REFERENCES products(id),
    parent_id INTEGER,
    content TEXT NOT NULL,
    is_seller_reply BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 16. 장바구니 테이블 생성
-- ============================================
CREATE TABLE cart_items (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR REFERENCES users(id),
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER DEFAULT 1,
    selected_options JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 17. 아바타 카테고리 데이터 삽입
-- ============================================
INSERT INTO product_categories (id, name, description, category_order) VALUES
(1, '전체', '모든 아바타 캐릭터', 0),
(2, 'VTuber', 'VTuber 스타일 아바타 캐릭터', 1),
(3, '애니메이션', '애니메이션 스타일 아바타', 2),
(4, '리얼리스틱', '사실적인 스타일 아바타', 3),
(5, '판타지', '판타지 테마 아바타 캐릭터', 4),
(6, 'SF/미래', 'SF 및 미래형 아바타', 5),
(7, '동물/펫', '동물 및 펫 형태 아바타', 6),
(8, '커스텀', '맞춤 제작 아바타', 7),
(9, '액세서리', '아바타용 의상 및 액세서리', 8),
(10, '이모션팩', '아바타 감정 표현 팩', 9);

-- ============================================
-- 18. 아바타 상품 데이터 삽입
-- ============================================
INSERT INTO products (id, category_id, name, description, price, discount_price, stock, images, rating, review_count) VALUES
-- VTuber 카테고리
(1, 2, '미라이 - VTuber 아바타', 'AI 기반 상호작용이 가능한 미래형 VTuber 아바타입니다. 실시간 채팅과 감정 표현이 뛰어납니다.', 150000, 120000, 10, 
 '["images/2dmodel/1.png", "images/2dmodel/2.png"]'::jsonb, 4.8, 24),

(2, 2, '사쿠라 - 일본풍 VTuber', '전통적인 일본 스타일의 VTuber 아바타로 우아한 움직임과 다양한 의상을 제공합니다.', 130000, NULL, 15, 
 '["images/2dmodel/3.png"]'::jsonb, 4.6, 18),

(3, 2, '테크노 - 사이버펑크 VTuber', '네온사인과 홀로그램 효과가 있는 사이버펑크 스타일 VTuber 아바타입니다.', 180000, 160000, 8, 
 '["images/2dmodel/4.png"]'::jsonb, 4.9, 31),

-- 애니메이션 카테고리
(4, 3, '루나 - 마법소녀 아바타', '마법소녀 컨셉의 귀여운 애니메이션 스타일 아바타입니다. 마법 이펙트 포함.', 100000, 80000, 20, 
 '["images/2dmodel/5.gif"]'::jsonb, 4.7, 42),

(5, 3, '카이토 - 학원물 주인공', '학원 애니메이션의 남성 주인공 스타일 아바타로 교복과 캐주얼 의상을 제공합니다.', 90000, NULL, 25, 
 '["images/2dmodel/6.png"]'::jsonb, 4.5, 33),

-- 리얼리스틱 카테고리
(6, 4, '아리아 - 리얼 휴먼 아바타', '실제 인간과 구별하기 어려운 고품질 리얼리스틱 여성 아바타입니다.', 250000, 220000, 5, 
 '["images/2dmodel/7.png"]'::jsonb, 4.9, 15),

(7, 4, '맥스 - 비즈니스 아바타', '비즈니스 미팅과 프레젠테이션에 적합한 전문적인 남성 아바타입니다.', 200000, NULL, 12, 
 '["images/2dmodel/1.png"]'::jsonb, 4.6, 21),

-- 판타지 카테고리
(8, 5, '엘프 프린세스 - 아리엘', '우아한 엘프 공주 아바타로 마법 능력과 아름다운 의상을 제공합니다.', 140000, 120000, 18, 
 '["images/2dmodel/2.png"]'::jsonb, 4.8, 27),

(9, 5, '드래곤 나이트 - 드레이크', '용의 힘을 가진 강력한 기사 아바타입니다. 용 변신 기능 포함.', 170000, NULL, 10, 
 '["images/2dmodel/3.png"]'::jsonb, 4.7, 19),

-- SF/미래 카테고리
(10, 6, '사이보그 - 제로', '미래형 사이보그 아바타로 다양한 사이버네틱 강화 기능을 제공합니다.', 190000, 170000, 7, 
 '["images/2dmodel/4.png"]'::jsonb, 4.8, 22),

-- 동물/펫 카테고리
(11, 7, '코기 - 귀여운 강아지', '사랑스러운 코기 강아지 아바타입니다. 다양한 표정과 동작을 지원합니다.', 80000, 70000, 30, 
 '["images/2dmodel/5.gif"]'::jsonb, 4.9, 56),

(12, 7, '냥이 - 고양이 아바타', '우아하고 신비로운 고양이 아바타로 다양한 품종 스킨을 제공합니다.', 75000, NULL, 35, 
 '["images/2dmodel/6.png"]'::jsonb, 4.7, 41),

-- 액세서리 카테고리
(13, 9, '홀로그램 윙즈', '아바타용 홀로그램 날개 액세서리입니다. 다양한 색상과 효과를 제공합니다.', 25000, 20000, 100, 
 '["images/2dmodel/7.png"]'::jsonb, 4.6, 73),

(14, 9, '마법 지팡이 세트', '다양한 마법 지팡이와 마법진 이펙트가 포함된 액세서리 세트입니다.', 35000, NULL, 80, 
 '["images/2dmodel/1.png"]'::jsonb, 4.8, 65),

-- 이모션팩 카테고리
(15, 10, '기본 감정 표현 팩', '기쁨, 슬픔, 화남, 놀람 등 기본적인 감정 표현이 포함된 팩입니다.', 15000, 12000, 200, 
 '["images/2dmodel/2.png"]'::jsonb, 4.5, 89),

(16, 10, '프리미엄 감정 팩', '섬세한 감정 변화와 특수 표정이 포함된 고급 감정 표현 팩입니다.', 30000, 25000, 150, 
 '["images/2dmodel/3.png"]'::jsonb, 4.9, 112);

-- ============================================
-- 19. 시퀀스 값 업데이트 (PostgreSQL)
-- ============================================
SELECT setval('product_categories_id_seq', (SELECT MAX(id) FROM product_categories));
SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));
SELECT setval('care_managers_id_seq', 1, false);
SELECT setval('services_id_seq', 1, false);
SELECT setval('bookings_id_seq', 1, false);
SELECT setval('messages_id_seq', 1, false);
SELECT setval('notices_id_seq', 1, false);
SELECT setval('favorites_id_seq', 1, false);
SELECT setval('inquiries_id_seq', 1, false);
SELECT setval('user_notification_settings_id_seq', 1, false);
SELECT setval('user_privacy_settings_id_seq', 1, false);
SELECT setval('product_reviews_id_seq', 1, false);
SELECT setval('product_comments_id_seq', 1, false);
SELECT setval('cart_items_id_seq', 1, false);

-- ============================================
-- 20. 샘플 공지사항 데이터 삽입
-- ============================================
INSERT INTO notices (title, content) VALUES
('AI아바타세상에 오신 것을 환영합니다!', '다양한 아바타 캐릭터와 함께하는 새로운 세상이 열렸습니다. VTuber부터 판타지 캐릭터까지 원하는 아바타를 만나보세요!'),
('신규 VTuber 아바타 출시', '최신 AI 기술을 적용한 VTuber 아바타 "미라이", "사쿠라", "테크노"가 새롭게 출시되었습니다. 지금 특가로 만나보세요!'),
('커스텀 아바타 제작 서비스 오픈', '나만의 특별한 아바타를 원하시나요? 전문 디자이너가 맞춤 제작해드리는 커스텀 아바타 서비스가 오픈되었습니다.');

-- ============================================
-- 완료 메시지
-- ============================================
-- 설정 완료! 이제 AI아바타세상 데이터베이스가 준비되었습니다.
-- 총 10개 카테고리, 16개 아바타 상품이 추가되었습니다. 