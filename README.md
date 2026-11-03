# Dog Map 🐶

전 세계의 다양한 강아지 품종 정보를 지구본(지도) 위에서 탐색할 수 있는 인터랙티브 웹 애플리케이션입니다.[cite: 1]

## 주요 기능
* **인터랙티브 맵**: 3D 지구본 및 지도를 통해 지역별 강아지 품종을 시각적으로 탐색합니다.[cite: 1]
* **품종 상세 정보**: 수백 종에 달하는 전 세계 강아지들의 상세 정보(JSON)를 제공합니다.[cite: 1]
* **검색 및 필터링**: 원하는 강아지 품종을 쉽게 찾고 분류할 수 있습니다.[cite: 1]

## 기술 스택
* **Frontend**: HTML, CSS, Vanilla JavaScript (컴포넌트 기반 아키텍처)[cite: 1]
* **Deployment/Hosting**: Cloudflare Workers (`wrangler.jsonc`)[cite: 1]

## 프로젝트 구조
* `/public/dog-map/`: 프론트엔드 정적 파일 (HTML, CSS, 웹 컴포넌트 JS) 및 강아지 품종 데이터(JSON)[cite: 1]
* `/src/`: 백엔드/서버리스 구동을 위한 Cloudflare Worker 진입점 스크립트 (`index.js`)[cite: 1]
* `package.json` & `wrangler.jsonc`: 프로젝트 의존성 및 배포 설정 파일[cite: 1]