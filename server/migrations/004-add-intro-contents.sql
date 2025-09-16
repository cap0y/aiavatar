ALTER TABLE care_managers
ADD COLUMN intro_contents JSONB;
 
COMMENT ON COLUMN care_managers.intro_contents IS '케어 매니저 소개글 콘텐츠 (이미지, 링크, 유튜브 영상 등)'; 