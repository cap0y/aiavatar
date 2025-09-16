-- 새로운 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) DEFAULT 'customer';
ALTER TABLE users ADD COLUMN IF NOT EXISTS grade VARCHAR(20) DEFAULT 'bronze';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 모든 기존 사용자를 'customer'로 설정
UPDATE users SET user_type = 'customer' WHERE user_type IS NULL;

-- 테스트용 관리자 계정 설정 (선택사항)
UPDATE users SET user_type = 'admin', is_approved = true 
WHERE email = 'admin@example.com';

-- 테스트용 케어매니저 계정 설정 (선택사항)
UPDATE users SET user_type = 'careManager', is_approved = true 
WHERE email LIKE '%care%' OR email LIKE '%manager%'; 