# Oh Right! 1차 프로토타입 명세서 v0.1

> 이 파일은 2026-11-26 기준 사본입니다. 최신본은 원본 명세서 문서(Claude Docs)를 기준으로 합니다.

## 개요

1차 프로토타입의 합격선은 하나입니다. 보호자 A가 휴대폰에서 투약을 기록하면 보호자 B의 휴대폰 화면에 3초 안에 나타나야 합니다. 배포 형태는 보호자가 직접 쓰는 소비자 앱이며 약국 서비스가 아닙니다(처형 확인). 이 문서는 Claude Code가 이 프로토타입을 바로 구현할 수 있도록 화면, 데이터, 동기화 규칙, 수용 기준을 정합니다.

**범위 (만든다)**

- 케어 그룹 만들기와 초대 링크로 두 번째 관리자 합류, 도우미 초대(결제 없이 구조만)
- 환자 1명 이상, 약 1개 이상 등록
- 홈 화면의 버튼으로 기록, NFC/QR 스티커를 탭해 기록
- 실시간 타임라인, 부모가 입력한 복약 계획 기준 알림(차단 없음), 10초 실행 취소
- 오프라인 기록 후 재연결 시 자동 전송
- 설치 가능한 PWA (홈 화면 추가)

**범위 밖 (만들지 않는다)**

- 복약 알림·푸시 알림, 복약 스케줄 관리
- 약 데이터베이스 연동, 처방 정보, 약사 기능
- 실제 환자 정보 저장 (테스트용 가상 데이터만 사용, HIPAA 대응은 2차 이후)
- 결제, 다국어 (앱 UI는 영어)

**표기 규칙**: **\[추측\]** 은 확인받지 않은 가정입니다. 답이 바뀌면 해당 항목만 고치면 되도록 "열린 질문" 절에 같은 번호로 모아 두었습니다. 백엔드 선택과 NFC/QR 방식은 각각 [실시간 동기화 백엔드 선택안 비교](https://claude.ai/code/project/chan_01SaSwnZrsYBFdLByq9TLhpC?thread=cmsg_01SaSwnZrsYBFdLByq9TLhpCSFmpyYUEAweTxY4G7JEp6z), [NFC·QR 스티커 탭 기록 방식 조사](https://claude.ai/code/project/chan_01SaSwnZrsYBFdLByq9TLhpC?thread=cmsg_01SaSwnZrsYBFdLByq9TLhpCLTgVocQAxK4YXWE1VAxYKL) 스레드의 결론(2026-11-25)을 반영했습니다.

## 사용자와 시나리오

핵심 사용자는 아픈 아이를 번갈아 돌보는 보호자 2명입니다(처형 확인, 2026-11-26). 항생제와 해열제처럼 간격이 다른 약을 함께 먹이고, 새벽에 잠이 덜 깬 상태로 앱을 씁니다. 그래서 화면은 큰 글씨와 버튼 하나로, 생각할 것을 최소화합니다.

보호자 2명이 엄마와 아빠라고 가정하지 않습니다. 미국에는 편부모, 이혼 후 두 집에서 공동양육하는 가정, 부모와 조부모가 함께 돌보는 가정이 많기 때문입니다. 그래서 역할은 관계가 아니라 권한으로 정의합니다. 관리자(manager)는 관계와 상관없이 최대 2명, 도우미(helper, 예: 할머니·시터)는 투약을 기록하고 볼 수 있지만 취소·편집은 못 합니다. 화면에 보이는 이름은 각자 직접 입력하며 Mom/Dad 같은 고정 라벨은 없습니다. 이 문서의 예시에서 나오는 Mom, Dad는 사용자가 입력한 이름의 예일 뿐이고, "부모가 입력한 계획"의 부모는 관리자를 뜻합니다. 고령 부모 돌봄은 나중에 검토하며, 이 모델을 그대로 쓸 수 있습니다.

프로토타입을 검증하는 대표 시나리오 3개입니다. 예시 이름은 화면과 테스트 데이터에도 그대로 쓸 수 있습니다.

1. **스티커 탭 기록**: 밤 9시, Dad가 냉장고 약병에 붙은 스티커에 휴대폰을 대고 Mia에게 해열제를 줍니다. 거실에 있던 Mom의 화면에 3초 안에 "Children's Tylenol · Dad · just now"가 뜨십니다.
2. **중복 방지**: 새벽 3시, 잠에서 깬 Mom이 해열제 스티커를 탭합니다. 확인 화면에 "Dad logged this at 2:10 AM (50 min ago). Your plan: every 6 hours."라는 알림이 보이고, Mom은 기록하지 않고 화면을 닫습니다.
3. **오프라인**: 지하 주차장에서 Dad가 버튼으로 기록합니다. Dad 화면에는 곧바로 "전송 대기" 표시로 보이고, 신호가 잡히면 자동 전송되어 Mom 화면에 나타납니다.

## 화면 흐름

진입은 첫 실행, 초대 링크, 스티커 탭 세 가지이고, 홈 버튼과 스티커는 모두 같은 확인 화면을 거쳐 탭 한 번으로 기록됩니다. 새벽에 헷갈리지 않도록 홈에서도 확인 화면을 거치게 했습니다 \[추측\]. 앱 UI는 영어, 시각은 기기 현지 시간 12시간제(예: 9:02 PM)로 표시합니다.

> (화면 흐름 다이어그램은 원본 명세서 문서에서 볼 수 있습니다.)

기록이 부모가 입력한 계획에서 벗어나면 확인 화면 안에 노란 알림이 뜨지만, 버튼은 그대로이고 추가 탭도 없습니다.

| # | 화면 | 경로 | 보이는 것 | 동작 |
| --- | --- | --- | --- | --- |
| 1 | Welcome | `/` (그룹 없음) | 앱 소개 한 줄, 면책 고지 전문, "I understand" 체크, 이름 입력 | "Create a care group" → 3 |
| 2 | Join | `/join/<invite_code>` | 그룹 이름, 면책 고지 동의, 이름 입력 | "Join" → 4 |
| 3 | Setup | `/setup` | 아이 이름, 약 이름, 용량+단위, "Every \_\_ hours", "Up to \_\_ times a day"(둘 다 선택), 메모. 빈 칸으로 시작 | 저장 → 4. 추가는 설정에서 |
| 4 | Home | `/home` | 아이별 약 카드(마지막 투약: 누가·몇 분 전, 계획상 다음 시각), 오늘 타임라인(최신이 위), 연결 상태 | 카드의 "Log a dose" → 5 |
| 5 | Confirm | `/t/<sticker_id>` 또는 시트 | 약 이름·용량(미리 채움), 마지막 투약, 해당 시 soft 알림 | "Mark as given", "Change dose", "Not now" → 4 |
| 6 | Recorded | 토스트 | "Recorded · Undo", 10초 | Undo |
| 7 | Settings | `/settings` | 관리자 초대 링크(최대 2명), 도우미 초대(유료 표시, 프로토타입은 스위치로 열림), 멤버와 역할, 아이·약·계획 편집(관리자만), 스티커 목록, 면책 고지 전문 | 스티커 추가 → QR 표시·인쇄, NFC용 URL 복사, Debug 패널 |

타임라인 항목 형식은 "9:02 PM · Children's Tylenol 5 mL · Dad · NFC"입니다. 취소된 항목은 취소선과 "Undone by Mom", 전송 전 항목은 "Sending" 또는 "Waiting to send"를 붙입니다.

## 데이터 모델

모든 데이터는 케어 그룹(care group) 하나에 속하고, 같은 그룹 멤버만 읽고 쓸 수 있습니다. 투약 기록(dose\_events)은 추가만 하는 로그로, 수정·삭제 대신 상태만 바꿉니다. 그래서 두 보호자가 동시에 기록해도 충돌이 생기지 않습니다.

**caregivers (보호자)**

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | string | 인증 계정 ID |
| display\_name | string | 화면에 보이는 이름, 예: "Dad" (1\~20자) |
| disclaimer\_version | string | 동의한 면책 고지 버전, 예: "2026-11-26" |
| disclaimer\_accepted\_at | timestamp | 동의 시각. 고지가 바뀌면 다시 동의 |
| created\_at | timestamp | 서버 시각 |

**care\_groups (케어 그룹)**

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | string |  |
| name | string | 예: "Mia's care team" |
| manager\_invite\_code | string | 관리자 초대용. 추측 불가능한 랜덤 8자 이상, 재발급 가능. 관리자가 2명이 되면 더 이상 쓸 수 없음 |
| helper\_invite\_code | string \| null | 도우미 초대용. helper\_invites\_enabled가 true일 때만 발급 |
| helper\_invites\_enabled | boolean | 유료 기능 스위치. 프로토타입에서는 결제 없이 설정에서 켜고 끔 |
| created\_by | caregiver id |  |
| created\_at | timestamp |  |

**memberships (그룹 멤버)**

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| group\_id | care\_group id |  |
| caregiver\_id | caregiver id |  |
| role | manager \| helper | manager는 그룹당 최대 2명, 아이와의 관계는 묻지 않음(편부모+조부모, 두 집의 공동양육자 등). helper는 유료로 초대한 도우미(할머니·시터 등) |
| joined\_at | timestamp |  |

**patients (환자)**

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | string |  |
| group\_id | care\_group id |  |
| display\_name | string | 예: "Mia". 실명·생년월일은 받지 않음 |
| created\_at | timestamp |  |

**medications (약)**

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | string |  |
| group\_id | care\_group id |  |
| patient\_id | patient id | 약은 환자 한 명에게 속함 |
| name | string | 예: "Amoxicillin", "Children's Tylenol" |
| dose\_amount | number | 부모 입력, 예: 250. 확인 화면에 미리 채움 |
| dose\_unit | mg \| mL \| tablet \| drop | 부모 선택 |
| interval\_hours | number \| null | 부모 입력 "몇 시간마다". 비우면 간격 알림 없음 |
| max\_doses\_per\_day | integer \| null | 부모 입력 "하루 최대 몇 번". 비우면 횟수 알림 없음 |
| plan\_note | string | 자유 메모, 예: "with food, 10 days". 앱은 해석하지 않음 |
| archived | boolean | 숨김 처리, 기록은 남김 |

앱은 용량·간격·횟수의 기본값이나 권장값을 제안하지 않습니다. 입력 칸은 빈 칸으로 시작하고, "의사·약사·약 라벨에 적힌 대로 입력하세요"라는 안내만 둡니다.

**stickers (스티커)**

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | string | URL에 들어가는 랜덤 슬러그, 10자 이상 (추측 불가) |
| group\_id | care\_group id |  |
| medication\_id | medication id | 스티커 1장 = 약 1개 |
| label | string | 예: "Fridge" |
| created\_at | timestamp |  |

**dose\_events (투약 기록)**

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | 기기에서 생성. 재전송해도 한 번만 저장(멱등성 키) |
| group\_id, patient\_id, medication\_id | id | 조회·권한용 비정규화 |
| caregiver\_id | caregiver id | 기록한 사람 |
| dose\_amount, dose\_unit | number, string | 실제로 준 용량. 기본은 계획값을 복사, 바꾼 경우 그 값 |
| given\_at | timestamp | 기기에서 기록 버튼을 누른 시각. 화면 표시·정렬 기준 |
| received\_at | timestamp | 서버가 받은 시각. 지연 측정·감사용 |
| source | button \| nfc \| qr | 진입 경로 |
| sticker\_id | sticker id \| null | 스티커로 기록한 경우 |
| status | given \| undone | 취소는 상태 변경, 삭제 없음 |
| undone\_at, undone\_by | timestamp, caregiver id | 취소한 시각과 사람 |
| notices\_shown | 배열: too\_soon \| over\_daily \| dose\_differs \| also\_logged | 기록 전에 보여 준 알림. 알림을 보고도 기록했다는 사실을 남김 |

권한 규칙 (처형 확인, 2026-11-26):

| 할 수 있는 일 | manager | helper |
| --- | --- | --- |
| 아이·약·계획·기록 보기 | 예 | 예 |
| 투약 기록 남기기(버튼·스티커) | 예 | 예 (처형 확인) |
| 기록 취소(내 기록·다른 사람 기록) | 예. undone\_by가 남고 타임라인에 "Undone by \[이름\]" 표시 | 아니오. 자기 기록의 10초 Undo도 없음 **\[추측\]** |
| 아이·약·계획·스티커 추가·편집 | 예 | 아니오 |
| 초대 링크 발급, 도우미 내보내기 | 예 | 아니오 |
| 다른 관리자 내보내기 | 아니오 (처형 확인, Q14) | 아니오 |
| 그룹에서 스스로 나가기 | 예 | 예 |

기록 "수정"은 따로 두지 않고, 취소 후 새로 기록하는 방식으로 해서 흔적을 남깁니다. 모든 규칙은 화면에서 버튼을 숨기는 것에 더해 서버 보안 규칙으로도 막습니다. dose\_events는 본인 caregiver\_id로만 만들 수 있습니다.

## NFC/QR 스티커 동작

NFC와 QR은 같은 URL 하나를 담고, 앱은 그 URL로 열렸을 때만 반응합니다. iPhone 브라우저는 Web NFC를 지원하지 않으므로 앱 안에서 NFC를 읽는 코드는 만들지 않습니다. 스티커에는 URL만 기록하고, 열기는 휴대폰 운영체제에 맡깁니다.

- **URL 형식**: `https://<서비스 도메인>/t/<sticker_id>` (예: `/t/k3f9x2m8qa`). 약 이름·환자 이름은 URL에 넣지 않습니다.
- **스티커 사양**: NTAG213, 지름 25\~30mm. NDEF URI 레코드 1개로 URL을 기록하고, 같은 스티커 앞면에 그 URL의 QR을 인쇄합니다. 한 장으로 NFC와 QR이 모두 됩니다.
- **NFC와 QR 구분**: NFC에 기록하는 URL에는 `?via=nfc`, 인쇄하는 QR에는 `?via=qr`을 붙여 source를 구분합니다. 없으면 qr로 기록합니다.
- **기기별 열림**: iPhone은 스티커에 대면 알림이 뜨고, 알림을 누르면 Safari로 열립니다(2단계). Android는 설치된 PWA로 바로 열릴 수 있으나 실기기 확인이 필요합니다 **\[추측 Q10\]**.
- **열린 뒤 동작 (확정)**: `/t/<sticker_id>`는 "기록 확인" 화면을 띄웁니다. 약 이름과 용량(예: "Amoxicillin · 250 mg")이 부모가 입력한 계획대로 미리 채워져 있고, 큰 "Mark as given" 버튼 하나를 누르면 기록됩니다. 탭만으로 자동 기록되지는 않습니다. 용량은 "Change dose"를 눌러야만 바꿀 수 있고, 계획과 다르면 알림이 뜹니다(아래 "알림 문구와 면책 고지").
- **로그인 안 된 기기**: 초대받지 않은 사람이 열면 "이 스티커는 케어 그룹 멤버만 쓸 수 있습니다"만 보여주고 약·환자 정보는 노출하지 않습니다.
- **iPhone 로그인 유지**: iPhone에서는 스티커가 늘 Safari로 열리고, Safari와 설치된 앱은 로그인 저장소가 따로일 수 있습니다. 그래서 Safari에서도 로그인 상태가 유지되어야 하며, 처음 한 번은 Safari에서 초대 링크로 합류하는 단계가 필요할 수 있습니다. 구현 초기에 실기기로 확인합니다 **\[추측 Q3\]**.
- **제작 방식**: 프로토타입은 "NFC Tools" 같은 무료 앱으로 소량을 직접 기록합니다. 대량 제작은 서비스 도메인이 확정된 뒤에 합니다(URL이 바뀌면 스티커를 다시 만들어야 함) **\[Q9\]**.

## 동기화 요구사항

기록한 휴대폰에는 0.3초 안에, 상대 휴대폰에는 3초 안에 보여야 합니다. 폴링이 아니라 서버가 변경을 밀어 주는 실시간 구독으로 구현합니다.

| ID | 요구사항 | 기준 |
| --- | --- | --- |
| S1 | 상대 기기 반영 지연 | 두 기기 모두 앱이 열려 있고 Wi-Fi 또는 LTE일 때, "Mark as given" 탭부터 상대 화면 표시까지 20회 중 19회 이상 3초 이내 |
| S2 | 내 기기 즉시 반영 | 서버 응답을 기다리지 않고 0.3초 안에 타임라인에 표시(낙관적 반영). 서버 확정 전에는 "Sending" 표시 |
| S3 | 오프라인 기록 | 연결이 없어도 기록 가능. 기기에 저장하고 "Waiting to send" 표시. 연결되면 자동 전송, 앱을 닫았다 열어도 남아 있음 |
| S4 | 중복 저장 방지 | 같은 dose\_events.id는 몇 번 보내도 1건만 저장 |
| S5 | 복귀 시 따라잡기 | 앱이 백그라운드에서 돌아오거나 네트워크가 복구되면 3초 안에 최신 상태로 맞춤. 놓친 기록이 없어야 함 |
| S6 | 동시 기록 | 두 사람이 같은 약을 거의 동시에 기록하면 둘 다 저장하고, 두 화면 모두 "Mom also logged this 1 min ago" 알림을 보임. 한 건을 무시하거나 덮어쓰지 않음 |
| S7 | 취소 전파 | Undo는 status를 undone으로 바꾸고, 상대 화면에서도 3초 안에 취소선으로 표시 |
| S8 | 연결 상태 표시 | 헤더에 Online / Offline / Reconnecting 표시. 오프라인이면 "상대 기록이 아직 안 보일 수 있음" 안내 |
| S9 | 시간 표시 | "N min ago"는 given\_at 기준. 기기 시계가 서버와 2분 이상 다르면 서버 시각 차이로 보정 |
| S10 | 지연 측정 | 설정에 숨긴 "Debug" 패널: 최근 수신 기록 20건의 given\_at → 내 화면 도착 시각 차이(초)와 p95 |

범위 밖: 앱이 완전히 닫혀 있을 때의 푸시 알림은 만들지 않습니다. 3초 목표는 상대 앱이 화면에 열려 있거나 다시 열릴 때 기준입니다.

**기술 스택** (백엔드 비교 결론 반영)

- 프런트: React + TypeScript + Vite, vite-plugin-pwa(서비스 워커, 설치 매니페스트)
- 백엔드: Cloud Firestore(Firebase). 실시간 리스너가 S1을, 웹 SDK의 오프라인 저장·재전송이 S2·S3을, 보안 규칙이 그룹 권한을 채웁니다. Google Cloud BAA가 추가 비용 없이 포함되어 2차의 HIPAA 대응 경로도 있습니다. 단, 1차는 가상 데이터만 씁니다. 2순위는 Supabase입니다.
- 데이터 접근은 `recordDose`, `undoDose`, `subscribeGroup` 같은 저장소 계층 뒤에 두어, 백엔드가 바뀌어도 화면 코드는 그대로 두게 합니다.
- 인증: Firebase 익명 로그인 + 표시 이름. 초대 링크를 열면 그룹에 합류 **\[추측 Q7\]**.
- 배포: Firebase Hosting(HTTPS). 프로토타입은 기본 도메인으로 시작하고, 스티커 대량 제작 전에 서비스 도메인을 확정합니다 **\[Q9\]**.

## 알림 문구와 면책 고지 (제안)

앱은 "안전한지"를 판단하지 않고, 부모가 입력한 계획과 기록을 비교한 사실만 보여 줍니다. 이 원칙은 처형분이 걱정한 법적 부담을 줄이기 위한 것이지만, 문구와 고지는 출시 전에 미국 변호사 검토를 받아야 합니다 **\[Q11\]**. 아래는 법률 자문이 아닌 초안입니다.

**문구 원칙**

- 앱의 기준이 아니라 부모의 계획을 주어로 씁니다: "Your plan says…"
- 사실(누가, 언제, 얼마나)만 적고 판단·지시는 하지 않습니다. "unsafe", "overdose", "do not give", "wait until" 같은 말은 쓰지 않습니다.
- 빨간색·경고음·차단 없이 노란 배경의 알림 한 줄로 표시합니다. 기록 버튼은 늘 누를 수 있습니다.
- 알림 아래에 "Not sure? Ask your doctor or pharmacist."를 작게 붙입니다.
- 계획이 비어 있으면 알림을 띄우지 않고, 카드에 "No schedule set"만 보입니다.

**알림 문구 초안**

| 종류 (notices\_shown) | 언제 | 문구 |
| --- | --- | --- |
| too\_soon | 마지막 기록부터 interval\_hours가 지나지 않음 | "Heads up: Dad logged Amoxicillin 250 mg at 2:10 AM (3 h 50 min ago). Your plan: every 8 hours." |
| over\_daily | 이번이 하루 max\_doses\_per\_day를 넘는 회차 | "This would be dose 4 today. Your plan: up to 3 a day." |
| dose\_differs | 확인 화면에서 용량을 계획과 다르게 바꿈 | "You entered 10 mL. Your plan: 5 mL." |
| also\_logged | 다른 보호자가 같은 약을 5분 안에 기록 | "Mom also logged this 1 min ago." |

"하루"는 기기 현지 시간 자정 기준입니다 **\[추측\]**. also\_logged의 5분은 앱의 복약 기준이 아니라 "동시에 두 번 누른 것"을 잡는 기술적 기준입니다.

**면책 고지 초안** (Welcome·Join에서 체크 후 진행, 설정에서 다시 보기)

> Oh Right! is a shared log that helps caregivers see what medicine was given, when, and by whom. It does not give medical advice, check doses, or tell you whether a medicine is safe to give. Any reminder in the app only compares your entries with the schedule you typed in. Always follow the instructions from your child's doctor or pharmacist and the medicine label. In an emergency, call 911. For possible poisoning or overdose, call Poison Control at 1-800-222-1222.
>
> ☐ I understand Oh Right! is a log, not medical advice.

**계획 입력 화면 안내**: "Enter the dose and schedule exactly as your doctor, pharmacist, or the label tells you. Oh Right! doesn't suggest doses."

추가 보호 장치: 앱에는 약 데이터베이스·나이별 용량·기본 간격을 넣지 않고, 알림을 보고도 기록한 사실은 notices\_shown으로 남깁니다.

## 수용 기준

아래 항목을 iPhone 1대(Safari, iOS 최신)와 Android 1대(Chrome 최신)로 모두 통과하면 1차 프로토타입 완료입니다. 테스트할 때마다 체크합니다.

**핵심: 3초 동기화**

- [ ] AC1. 두 기기가 같은 그룹에서 홈 화면을 열고 있을 때, A에서 버튼으로 기록하면 B 타임라인에 3초 안에 약 이름·기록자·시각이 나타난다. 20회 중 19회 이상, 양방향(A→B, B→A) 모두
- [ ] AC2. NFC 스티커 탭 → 확인 화면 → "Mark as given" 후 상대 화면에 3초 안에 보이고, source가 nfc로 저장된다. iPhone과 Android 각각
- [ ] AC3. QR 스티커 스캔으로도 AC2와 같이 동작하고 source는 qr이다
- [ ] AC4. 기록한 기기에는 버튼을 누른 뒤 0.3초 안에 타임라인에 나타난다

**안전·정확성**

- [ ] AC5. 부모가 입력한 interval\_hours보다 일찍, 또는 max\_doses\_per\_day를 넘겨 기록하려 하면 확인 화면에 해당 soft 알림이 보인다. "Mark as given" 한 번으로 그대로 기록되며, notices\_shown에 남는다
- [ ] AC6. 계획을 비워 둔 약에는 간격·횟수 알림이 절대 뜨지 않는다. 앱에는 용량·간격의 기본값이나 권장값이 어디에도 없다
- [ ] AC7. 확인 화면에서 용량을 계획과 다르게 바꾸면 "dose\_differs" 알림이 보이고, 기록에는 바꾼 용량이 저장된다
- [ ] AC8. 두 기기가 5초 안에 같은 약을 기록하면 2건 모두 저장되고 두 화면 모두 also\_logged 알림을 보인다
- [ ] AC8a. 기록 직후 10초 동안 Undo가 보이고, 누르면 양쪽 화면에서 3초 안에 취소선 처리된다. 타임라인의 기록을 길게 눌러 나중에 취소할 수도 있다
- [ ] AC8b. 통신이 느려 같은 기록이 여러 번 전송돼도 타임라인에는 1건만 보인다
- [ ] AC8c. 면책 고지에 동의하지 않으면 그룹을 만들거나 합류할 수 없고, 동의 버전과 시각이 저장된다

* [ ] AC8d. 관리자 2명이 채워진 그룹의 관리자 초대 링크로는 더 합류할 수 없다
* [ ] AC8e. helper는 버튼·스티커로 투약을 기록할 수 있고 관리자 화면에 3초 안에 보인다. 취소·편집 버튼은 보이지 않고, API를 직접 호출해도 거부된다
* [ ] AC8f. 한 관리자가 다른 사람의 기록을 취소하면 모든 멤버 타임라인에 "Undone by \[이름\]"이 표시된다
* [ ] AC8g. helper\_invites\_enabled가 false면 도우미 초대 링크를 만들 수 없고, 설정에 "Premium" 표시만 보인다
* [ ] AC8h. 관리자가 다른 관리자를 내보낼 방법은 없고, 누구나 스스로 나갈 수 있으며 나간 사람의 기록은 이름과 함께 남는다

**오프라인·복구**

- [ ] AC9. A를 비행기 모드로 두고 기록하면 A에 "Waiting to send"로 보이고, 비행기 모드를 끄면 앱을 조작하지 않아도 전송되어 B에 나타난다. 그 사이 앱을 완전히 닫았다 열어도 기록이 사라지지 않는다
- [ ] AC10. B를 1분 이상 백그라운드에 둔 사이 A가 3건을 기록하면, B를 다시 열었을 때 3초 안에 3건이 모두 보인다

**가입·권한**

- [ ] AC11. A가 그룹을 만들고 초대 링크를 문자로 보내면, B는 링크를 열고 이름만 입력해 1분 안에 같은 환자·약을 본다
- [ ] AC12. 그룹 밖의 기기가 스티커 URL을 열거나 API를 직접 호출해도 환자·약·기록을 읽거나 쓸 수 없다
- [ ] AC13. 홈 화면에 추가(설치)한 앱과 브라우저 탭 어느 쪽으로 스티커가 열려도 다시 로그인하지 않고 기록할 수 있다. 안 되면 Q3으로 돌려 방식을 정한다

**코드 인수 조건 (Claude Code용)**

- [ ] AC14. 동기화·중복 경고·멱등성 로직에 단위 테스트가 있고, 두 브라우저 컨텍스트로 AC1·AC6·AC7을 재현하는 Playwright 테스트가 있다
- [ ] AC15. README에 로컬 실행, 배포, 스티커 URL 기록 방법이 있다

## 열린 질문

구현을 막는 질문은 없습니다. Q1, Q2, Q4, Q5, Q6, Q8, Q12, Q14는 결정되었고, 나머지는 임시 답으로 만들되 답이 바뀌면 해당 항목만 고칩니다.

| # | 질문 | 답 | 누가 정하나 |
| --- | --- | --- | --- |
| Q1 | 대상 환자는? | **결정**: 아픈 아이의 보호자. 고령 부모는 추후 | 결정됨 (처형) |
| Q2 | 스티커 탭 후 바로 기록, 또는 확인 버튼? | **결정**: 확인 버튼 1회, 약 이름·용량 미리 채움 | 결정됨 (처형) |
| Q3 | iPhone에서 Safari로 열릴 때도 로그인이 유지되나? | Safari에서 처음 한 번 초대 링크로 합류 | 구현 중 실기기 확인 |
| Q4 | 알림 기준 간격은? | **결정**: 앱 기본값 없음. 관리자가 용량·간격·하루 횟수를 입력하고, 벗어날 때만 soft 알림 | 결정됨 (처형) |
| Q5 | 다른 보호자의 기록을 취소할 수 있나? | **결정**: 관리자만 취소 가능(흔적 남김). 도우미는 불가 | 결정됨 (처형) |
| Q6 | 백엔드는? | **결정**: Cloud Firestore (2순위 Supabase) | 결정됨 |
| Q7 | 로그인 방식은? | 익명 로그인 + 초대 링크. 기기를 바꾸면 기록 접근을 잃음(프로토타입에서는 허용) | Suhlution |
| Q8 | 보호자 수 제한은? | **결정**: 관리자 최대 2명(관계 무관, 이름은 직접 입력). 그 외는 도우미로 유료 초대(프로토타입은 구조만, 결제 없음) | 결정됨 (처형) |
| Q9 | 서비스 도메인은? | 후보: heyohright.com 또는 hellohright.com (ohright.com은 선점됨). 프로토타입은 Firebase Hosting 기본 도메인, 스티커 대량 제작 전 확정 | 처형 |
| Q10 | Android에서 스티커가 설치된 PWA로 바로 열리나? | 열린다고 가정. 안 되면 Chrome 탭에서 기록 | 구현 중 실기기 확인 |
| Q11 | 알림 문구와 면책 고지가 법적으로 충분한가? | 프로토타입은 초안 그대로. 처형 남편분 지인 변호사에게 자문 예정(Q14의 양육권 요청 대응 포함 권장) | 처형 + 변호사 |
| Q12 | 도우미가 새 투약 기록을 남길 수 있나? | **결정**: 기록 가능, 취소·편집 불가 | 결정됨 (처형) |
| Q13 | 도우미 초대 가격과 결제 방식은? | 1차 범위 밖. 구조(스위치)만 둠 | 처형 |
| Q14 | 관리자 해제와 분쟁 처리는? | **첫 버전 결정**: 스스로 나가기만. 이후 방식은 변호사 자문 후 | 결정됨 (처형) |

**Q14. 관리자 해제와 분쟁 처리** (첫 버전 결정, 처형 확인): 이혼·별거 등으로 한 관리자가 다른 관리자를 빼려 하는 경우는 나중에 정합니다. 첫 버전에서는 누구도 다른 관리자를 내보낼 수 없고, 스스로 나갈 수만 있습니다. 나간 사람의 기록은 이름과 함께 남습니다. 나중에 정할 것: 내보내기 권한(만든 사람, 두 명 합의, 또는 지원팀 개입), 내보낸 뒤 이전 기록 열람 가능 여부, 양육권 관련 요청에 대응하는 방침. 마지막 항목은 Q11의 변호사 검토에 포함하는 것을 권합니다.
