# 온기 (On-gi) — 함께 보는 따뜻한 시간

친구와 함께 유튜브 영상을 **실시간으로 동기화**하며 보는 워치파티 서비스.
Vercel(서버리스) 아키텍처에서 **Hetzner VPS 기반의 지속 연결 소켓 서버**로 원상복구했습니다.

## 아키텍처

```
on-gi/
├── client/   # Vite + React(TS) + Zustand + TailwindCSS  (index.html 진입점)
└── server/   # Node.js + Fastify + Socket.io + Redis      (24h 지속 연결)
```

- **실시간 통신:** Socket.io (WebSocket, 폴백 폴링)
- **상태 저장:** Redis (방 상태 · 유저 · 채팅 히스토리 · 세션 복구)
- **동기화 모델:** 방장(Host) 중심 — 방장의 play/pause/seek + 3초 하트비트를 시청자에게 브로드캐스트

## 로컬 실행

전제: Node 18+, Redis (로컬 `redis://localhost:6379` 또는 Upstash).

```bash
# 1) 서버
cd server
cp .env.example .env      # REDIS_URL, CORS_ORIGIN 확인
npm install
npm run dev               # http://localhost:3001

# 2) 클라이언트 (새 터미널)
cd client
cp .env.example .env      # VITE_SOCKET_URL=http://localhost:3001
npm install
npm run dev               # http://localhost:5173
```

## 해결된 10대 이슈

| # | 이슈 | 해결 |
|---|------|------|
| 1 | 채팅 스크롤 버그 | `overflow-y-auto` + `useRef`/`useEffect` 자동 하단 스크롤 (`ChatPanel`) |
| 2 | 이전 채팅 내역 증발 | Redis List에 방별 최근 50개 저장 → join/rejoin 시 히스토리 replay |
| 3 | 늦은 참여자 영상 동기화 실패 | 서버가 방장에게 현재 시간 요청 → `sync:force`로 `seekTo`+자동재생 |
| 4 | 동영상 컨테이너 스크롤 줄 | 영상 컬럼 부모에 `overflow-hidden` |
| 5 | 새로고침 튕김 & 분신술 | sessionStorage `userId`+`roomId`, 서버 5초 grace, 동일 userId 재접속 복구 |
| 6 | 라이트/다크 모드 | Tailwind `darkMode:'class'`, 앰버 포인트 + 웜그레이 배경, Zustand 토글 |
| 7 | 방 코드 시인성 | 상단에 크게 표시, 클릭 시 초대 링크 복사 + '복사됨!' 툴팁 |
| 8 | 초대 링크 자동 진입 | `?room=CODE` 감지 → 로비에서 코드 자동 입력 (딥링킹) |
| 9 | 방장 유튜브 컨트롤러 실종 | `isHost` → `controls:1`, 시청자 → `controls:0, disablekb:1` |
| 10 | 구글 애드센스 | `client/index.html` `<head>`에 스니펫 삽입 (`ca-pub-8340527043375240`) |

## 배포 (Hetzner VPS 요약)

1. Redis 설치: `apt install redis-server` (또는 관리형 Redis URL 사용)
2. `server`: `npm run build && NODE_ENV=production node dist/index.js` — pm2/systemd로 상주
3. `client`: `npm run build` → `client/dist`를 Nginx/Caddy 정적 서빙
4. Nginx에서 `/socket.io/`를 서버(3001)로 프록시하고 WebSocket 업그레이드 헤더 전달
5. `server/.env`의 `CORS_ORIGIN`을 실제 도메인으로 설정
