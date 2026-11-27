# 체크리스트 항목 파일

창업 가이드의 필수사항 체크리스트(M8) 항목은 `items.json`에 둔다. 형식은 `types.ts`, 검사는 `validate.ts`가 정한다.
스펙: `specs/opening-checklist/spec.md`

## 항목 값

| 값                          | 필수     | 내용                                                                       |
| --------------------------- | -------- | -------------------------------------------------------------------------- |
| `id`                        | 예       | 영문 소문자·숫자·하이픈. 완료 표시 저장 키라서 한 번 정하면 바꾸지 않는다  |
| `phase`                     | 예       | `계약 전` · `영업신고 전` · `개업 전후`                                    |
| `title`, `description`      | 예       | 제목과 설명                                                                |
| `tag`                       | 예       | 구분. `법적 의무` · `조건부` · `권장`                                      |
| `reportTypes`               | 예       | 적용 신고 종류. `일반음식점` · `휴게음식점` · `제과점` 중 1개 이상         |
| `condition.text`            | 예       | 적용 조건. 모두 해당하면 `모든 영업자`                                     |
| `condition.keys`            | 조건부만 | `franchise` · `staff` · `big` · `lpg` · `delivery` · `alcohol`             |
| `source.name`, `source.url` | 예       | 공식 출처(법령·고시·기관 안내). 주소는 https                               |
| `checkedAt`                 | 예       | 출처를 확인한 날. `YYYY-MM-DD`                                             |
| `verified`                  | 예       | 공식 원문과 대조했으면 `true`. `false`인 항목은 화면에 공개하지 않는다(R4) |
| `jurisdictionCheck`         | 아니오   | 면적·층·지역에 따라 달라 관할 기관 확인을 안내할 때 `true`(R6)             |
| `link`                      | 아니오   | 담당 기관 바로가기 `{ "label", "url" }`                                    |
| `action`                    | 아니오   | 화면 안 이동. `map`(상권 탐색) · `contract`(계약서 검토)                   |

## 지금 들어 있는 항목

화면 시안의 예시를 옮긴 것이다. 출처는 담당 기관 사이트이고 모두 `verified: false`다.

- **예시의 `checkedAt`은 형식 검사를 통과시키려고 넣은 임시값이다.** 누군가 원문을 확인한 날이 아니다.
- 화면 시안에 있던 면적 기준, 신고 기한 같은 수치는 원문으로 확인하지 않아 빼 두었다.
- 법령 원문 대조와 출처·확인일 채우기는 SCRUM-164에서 한다. 원문을 확인하면 그날 날짜로 `checkedAt`을 바꾸고 `verified`를 `true`로 한다.

## 확인

`pnpm --filter frontend test` — 값이 빠지거나 틀리면 `checklist.test.ts`가 실패한다.
