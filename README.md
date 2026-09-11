# WHENG 생활설비

수원·화성·용인·오산을 중심으로 운영하는 WHENG 생활설비 고객용 사이트 + 관리자 운영 시스템입니다.

## 현재 구성
- 고객용 메인 홈페이지
- 서비스/가격표
- 빠른 견적 접수
- 견적 사진 업로드
- 시공사례
- 개인정보 수집 동의
- 관리자 로그인
- 견적 상태 관리
- 서비스/가격 관리
- 시공사례 관리
- Supabase Auth / Postgres / Storage / RLS

## Supabase
WHENG 전용 Supabase 프로젝트가 연결되어 있습니다.

- 고객 브라우저에는 Publishable Key만 사용
- 견적 사진: 비공개 Storage
- 시공사례 사진: 공개 Storage
- 관리자 권한: `wheng_admins` + RLS
- 최초 관리자 생성: `wheng-bootstrap-admin` Edge Function

> Secret key / service-role key는 브라우저 코드나 저장소에 저장하지 않습니다.

## 주요 파일
- `index.html`: 고객용 메인
- `styles.css`: 고객용 스타일
- `app.js`: 고객용 동작
- `config.js`: 공개 사이트 설정
- `data.js`: Supabase 데이터 계층
- `admin.html`: 관리자 화면
- `admin.js`: 관리자 동작
- `admin.css`: 관리자 스타일
- `privacy.html`: 개인정보 안내
- `supabase_schema.sql`: 운영 DB/RLS 스키마
- `supabase/functions/wheng-bootstrap-admin/index.ts`: 최초 관리자 생성 Edge Function 원본

## 배포
정적 사이트로 배포할 수 있습니다. Render에서는 저장소 루트를 publish path로 사용하면 됩니다.

배포 전 `config.js`의 전화번호와 카카오 상담 주소를 실제 운영값으로 변경하세요.
