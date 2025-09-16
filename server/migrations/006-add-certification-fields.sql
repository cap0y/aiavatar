-- 인증 관련 필드 추가
ALTER TABLE users
ADD COLUMN is_certified BOOLEAN DEFAULT FALSE,
ADD COLUMN certification_date TIMESTAMP,
ADD COLUMN certification_payment_id TEXT;

-- 컬럼 설명 추가
COMMENT ON COLUMN users.is_certified IS '사용자 인증 여부';
COMMENT ON COLUMN users.certification_date IS '인증 획득 날짜';
COMMENT ON COLUMN users.certification_payment_id IS '인증 결제 ID';

-- 기존 데이터 중 ID가 4인 사용자(decom2@gmail.com)는 인증된 것으로 설정 (테스트용)
UPDATE users SET is_certified = TRUE, certification_date = NOW() WHERE id = 4; 