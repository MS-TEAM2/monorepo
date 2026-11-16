# mobile 규칙

Expo(SDK 58) + React Native 웹뷰 앱. **화면은 `frontend/`(Next.js)가 그리고, 이 앱은 배포된 웹을 띄우는 껍데기다.**
화면·기능을 바꾸는 작업은 대부분 `frontend/`에서 한다. 이 폴더는 웹으로 할 수 없는 네이티브 기능만 담당한다.

## 구조

| 경로                          | 내용                                                          |
| ----------------------------- | ------------------------------------------------------------- |
| `src/App.tsx`                 | 안전 영역(노치·홈 바) + 상태 바 + 웹뷰                        |
| `src/components/WebShell.tsx` | 웹뷰. 뒤로 가기, 외부 링크, 브리지 메시지, 오류 화면 처리     |
| `src/lib/bridge-handler.ts`   | 웹이 요청할 수 있는 네이티브 기능 (공유, 외부 열기 등)        |
| `src/lib/url-policy.ts`       | 웹뷰 안에서 열 주소와 밖에서 열 주소 판단 (순수 함수, vitest) |
| `src/config.ts`               | 띄울 웹 주소 (`EXPO_PUBLIC_WEB_URL`, 없으면 개발 서버)        |
| `app.json` / `eas.json`       | 앱 설정 / EAS 빌드 프로필                                     |

## 규칙

- **화면을 React Native로 만들지 않는다.** 새 화면은 웹에 만든다. 예외는 웹을 불러오지 못할 때의 오류 화면처럼 웹 없이 떠야 하는 것뿐이다.
- **네이티브 기능 추가 순서**: `packages/bridge`의 `BridgeRequests`에 요청 타입 추가 → `src/lib/bridge-handler.ts`에 처리기 추가 → 웹에서 `callApp()`으로 호출. 세 곳을 같은 PR에서 고친다.
- 웹에서 온 메시지는 신뢰하지 않는다. `parseWebToAppMessage`로 검증하고, 외부로 여는 주소는 허용 목록(`https`, `tel`, `mailto`, `sms`)만 연다.
- **앱은 웹보다 늦게 배포된다**(스토어 심사). 브리지 요청을 없애거나 형식을 바꾸지 말고 새 요청을 추가한다. 호환이 깨지는 변경이면 `BRIDGE_VERSION`을 올리고 웹이 구버전 앱을 처리하게 한다.
- `ios/`, `android/` 폴더는 만들거나 직접 고치지 않는다(빌드 때 생성됨). 네이티브 설정은 `app.json`과 config plugin으로 한다.
- 패키지는 `pnpm exec expo install <패키지>`로 추가한다(`pnpm add` 금지). SDK에 맞는 버전을 골라 준다.
- Expo Go에는 기본 내장 네이티브 모듈만 있다. 다른 네이티브 라이브러리를 추가하면 개발 빌드(`expo-dev-client`)가 필요하므로 AX 담당과 먼저 상의한다.
- 순수 로직은 React Native에 의존하지 않게 `src/lib`에 두고 `tests/`에서 vitest로 테스트한다.
- 검사: `pnpm --filter mobile lint`, `typecheck`, `test`(루트 `pnpm check`에 포함), 의존성을 바꿨다면 `pnpm --filter mobile run doctor`도 돌린다.

## Expo는 자주 바뀐다 — 기억에 의존하지 않는다

Expo는 SDK마다 API가 바뀐다. Expo, EAS, React Native API를 쓰는 코드를 작성하기 전에:

1. `package.json`의 `expo` 주 버전을 확인한다.
2. 그 버전의 문서를 본다: `https://docs.expo.dev/versions/v<주버전>.0.0/`
3. 그 밖의 내용은 https://docs.expo.dev/llms.txt 에서 해당 문서를 찾아 읽는다.

## 명령어

레포 루트에서 실행한다.

```bash
pnpm dev                                  # 웹 개발 서버 (앱이 이걸 띄운다)
pnpm dev:mobile                           # Expo 개발 서버 → 휴대폰 Expo Go 로 QR 스캔
pnpm --filter mobile exec expo install <패키지>
pnpm --filter mobile run doctor           # 의존성·설정 점검
```

빌드·출시는 EAS(`eas build`, `eas submit`)로 한다. GitHub Actions의 `mobile-build` 워크플로를 수동 실행하거나, `pnpm dlx eas-cli@latest <명령>`을 `mobile/`에서 실행한다.
