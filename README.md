# Oh Right!

두 보호자가 NFC/QR 스티커 탭이나 버튼으로 투약을 기록하면 3초 안에 서로의 휴대폰 화면에 보이는 PWA(설치형 웹앱) 프로토타입입니다. 백엔드는 Firebase Cloud Firestore를 사용합니다.

- 명세서: [docs/spec.md](docs/spec.md)
- 상태: 1차 프로토타입 구현 완료, 실기기 테스트 전

## 주의

Firebase는 무료 Spark 요금제로만 사용합니다. 결제 카드 등록, Blaze 요금제 전환, Cloud Functions 등 유료 전제 기능은 쓰지 않습니다. 이 앱은 Firestore, 익명 로그인, Hosting만 씁니다. 실제 환자 정보는 넣지 말고 가상 데이터로만 테스트합니다.

## 구조

| 위치 | 내용 |
| --- | --- |
| `src/domain/` | 순수 로직: soft 알림(too_soon, over_daily, dose_differs, also_logged), 시간 표시, ID |
| `src/data/repo.ts` | 저장소 계층: `recordDose`, `undoDose`, `subscribeGroup`, 초대·합류·나가기 등. 화면은 이것만 호출 |
| `src/ui/` | 화면: Welcome, Join, Setup, Home, Confirm, Settings(초대, 도우미 스위치, 스티커 QR, Debug 패널) |
| `firestore.rules` | 권한 규칙. 관리자 최대 2명, 도우미는 기록만, 기록 삭제 금지, 취소는 관리자만 |
| `tests/rules/` | 보안 규칙 테스트 (에뮬레이터) |
| `e2e/` | 휴대폰 2대를 흉내 낸 Playwright 테스트 (에뮬레이터) |

## 로컬 실행 (개발자용)

Node 22와 Java 17 이상이 필요합니다.

```bash
npm install
npm run emulators      # 터미널 1: 로컬 Firestore·Auth 에뮬레이터 (실제 프로젝트와 무관)
npm run dev:emu        # 터미널 2: http://localhost:5173 (에뮬레이터에 연결)
npm run dev            # 또는 실제 heyohright 프로젝트에 연결
```

테스트:

```bash
npm test               # 단위 테스트 (알림·시간·중복 방지)
npm run test:rules     # 보안 규칙 테스트
npm run test:e2e       # 두 브라우저로 3초 동기화·오프라인·도우미 등 재현
```

## 배포 (Firebase Hosting → https://heyohright.web.app)

`main`에 머지되면 GitHub Actions가 테스트 후 앱과 보안 규칙을 자동 배포합니다. 처음 한 번만 아래 설정이 필요합니다.

1. Firebase 콘솔(https://console.firebase.google.com) → heyohright → 왼쪽 메뉴 **빌드 → Hosting** → **시작하기**를 누르고, 나오는 단계는 모두 **다음**/**콘솔로 이동**으로 넘깁니다(명령어는 실행하지 않아도 됩니다).
2. 톱니바퀴 **프로젝트 설정 → 서비스 계정** 탭 → **새 비공개 키 생성** → **키 생성**. JSON 파일이 내려받아집니다. 이 파일은 비밀번호와 같으니 다른 곳에 올리지 마세요.
3. GitHub 저장소 → **Settings → Secrets and variables → Actions → New repository secret**. Name에 `FIREBASE_SERVICE_ACCOUNT`, Secret에 2번 파일을 메모장으로 열어 내용 전체를 붙여넣고 **Add secret**.
4. 저장소 **Actions** 탭 → **Test and deploy** → **Run workflow**. 초록 체크가 뜨면 https://heyohright.web.app 에서 열립니다.

수동 배포(개발자): `npx firebase login && npm run build && npx firebase deploy --only hosting,firestore:rules`

## 스티커 만들기

1. 앱 **Settings → Stickers**에서 약을 고르고 **Add sticker**.
2. **QR link**의 QR 이미지를 스티커 앞면에 인쇄합니다(**Print** 버튼). 주소 끝이 `?via=qr`입니다.
3. **NFC link**(`?via=nfc`)를 복사해 무료 앱 "NFC Tools"로 NTAG213 스티커에 기록합니다: Write → Add a record → URL/URI → 붙여넣기 → Write → 스티커에 휴대폰 대기.
4. 스티커 주소에는 약·아이 이름이 들어가지 않고, 그룹 멤버가 아니면 아무 정보도 보이지 않습니다.

주의: 지금 주소는 임시 도메인(heyohright.web.app)입니다. 정식 도메인을 정하면 스티커를 다시 만들어야 하므로 대량 제작은 도메인 확정 뒤에 합니다(명세서 Q9).

## 알려진 한계 (실기기 확인 필요)

- **iPhone (Q3)**: 스티커는 Safari로 열리는데, 홈 화면에 설치한 앱과 Safari는 로그인이 따로입니다. 익명 로그인이라 둘 다에서 합류하면 관리자 자리를 2개 차지할 수 있습니다. 실기기 확인 전까지 iPhone은 **Safari에서만** 쓰는 것을 권합니다(홈 화면 추가 대신 즐겨찾기). 해결책 후보: 이메일 링크 로그인(Spark 무료).
- **Android (Q10)**: 설치한 앱으로 스티커가 바로 열리는지 확인 필요.
- 기기를 바꾸거나 브라우저 데이터를 지우면 그룹 접근을 잃습니다(익명 로그인, Q7). 다시 초대받아야 하며, 관리자였다면 남은 관리자가 먼저 자리를 비워야 합니다.
- Debug 패널의 지연 기록은 화면을 새로 고치면 초기화됩니다.
