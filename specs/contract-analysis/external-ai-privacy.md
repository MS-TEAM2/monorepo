# 계약서 분석의 외부 AI 개인정보 처리 정보 (SCRUM-200)

계약서 개인정보 처리 동의 문구(S06)에 넣을 사실을 근거와 함께 기록한다. 법률 검토 전 자료이며 동의 문구 자체는 아니다.

- 확인일: 2026-11-27
- 읽은 기준: Notion 기획서 S06·11번(개인정보·LLM)·14번, `specs/contract-analysis/spec.md` R1·R6·R7
- Azure 조회: `az cognitiveservices account list -g rg-jjcs-prod-krc`, `az cognitiveservices account deployment list -n oai-jjcs` (조회만 함)
- 근거를 찾지 못한 값은 **확인 필요**로 남겼다.

## 요약

| 항목 | OCR (Document Intelligence) | 개인정보 탐지 (Language) | 조항 분석 (Azure OpenAI) |
| --- | --- | --- | --- |
| 리소스 | `di-jjcs`, S0 | `lang-jjcs`, F0 | `oai-jjcs`, 배포 `gpt-5.4-mini` (2026-03-17), **GlobalStandard** |
| 업체 | Microsoft (Azure) | Microsoft (Azure) | Microsoft (Azure). OpenAI는 데이터를 받지 않음 [A1] |
| 전송 항목 | **마스킹 전 원본 파일** 전체 | OCR로 읽은 **마스킹 전 글** | **마스킹한 글**과 분석 지시 |
| 처리 위치 | Korea Central [D1] | Korea Central [L1] | **모든 Azure 리전에서 처리될 수 있음.** 저장은 한국 지역 [A2][T1] |
| 이용 목적 | 계약서 글자 인식 | 이름 등 개인정보 위치 찾기(마스킹) | 계약 조건 추출, 위험 특약 위치 찾기 |
| 보유 기간 | 서비스는 24시간 보관. 우리는 분석 직후 삭제 API 호출 [D2] | PII 기능은 기본적으로 저장하지 않음 [L2] | 남용 모니터링 저장 있음. **기간은 문서에 없음, 확인 필요** [A3] |
| 학습 사용 | **문서에 없음, 확인 필요** | **문서에 없음, 확인 필요** | 허락 없이 기반 모델 학습에 쓰지 않음 [A1] |
| 처리 역할 | **문서에 없음, 확인 필요** | **문서에 없음, 확인 필요** | Microsoft DPA가 처리를 규율 [A4]. 수탁자(processor) 표현은 문서에 없음 |

## 서비스별 상세

### 1. OCR — Azure AI Document Intelligence

- **전송 항목:** 사용자가 올린 JPG·PNG·PDF 원본 바이트. 임대인·임차인·중개사의 이름, 주민등록번호, 연락처, 주소, 계좌 등 계약서에 적힌 개인정보가 모두 포함될 수 있다. 근거: `ai/src/ai_core/contract/ocr_azure.py`의 `prebuilt-read:analyze` 호출.
- **처리 위치:** "The incoming data is processed in the same region where the Document Intelligence resource was created." [D1] `di-jjcs`는 koreacentral이다.
- **보유 기간:** "The service stores submitted input data and analyze results for 24 hours after an analysis operation completes." Delete Analyze Result API는 입력과 결과를 영구 삭제한다. [D2] 우리 코드는 `OcrAzureClient.delete()`로 분석 직후 삭제한다(스펙 R7).
- **학습 사용·처리 역할:** 확인한 문서 [D1]에 없다.

### 2. 개인정보 탐지 — Azure AI Language PII detection

- **전송 항목:** OCR 결과 글. 5,120자 단위로 나눠 보내며, 마스킹 **전** 글이다. 근거: `ai/src/ai_core/contract/pii_detect.py`의 `PiiEntityRecognition` 요청.
- **처리 위치:** "Language doesn't store or process customer data outside the region where the customer deploys the service instance." [L1] `lang-jjcs`는 koreacentral이다.
- **보유 기간:** 일반적으로는 최대 48시간 저장할 수 있다. 다만 `LoggingOptOut`이 "true by default for the PII and health feature endpoints"이다. [L2] 우리 코드는 이 값을 따로 지정하지 않으므로 기본값(저장 안 함)을 따른다.
- **학습 사용·처리 역할:** 확인한 문서 [L1]에 없다.

### 3. 조항 분석 — Azure OpenAI (Foundry Models)

- **전송 항목:** 마스킹을 통과한 글만 보낸다. 형식은 `p{쪽}:l{줄}: {글}`이고, 시스템 지시(추출·위험 특약 기준)가 함께 간다. 마스킹에 실패하면 보내지 않는다(R6). 근거: `ai_core/contract/extract.py`의 `build_prompt`와 `risk.py`(SCRUM-138·139 브랜치). **실제 Azure OpenAI 연결 코드는 아직 없다**(`LlmClient` 프로토콜만 있음).
- **업체:** "are NOT available to OpenAI or other providers of Models sold by Azure." [A1]
- **처리 위치:** 배포 유형이 GlobalStandard다. 이 유형은 "May be processed in any Azure region." [T1] 저장 데이터는 "remains in the designated Azure geography."(한국) [T1][A2] **즉, 마스킹한 글이 국외에서 처리될 수 있다.**
- **보유 기간:** 남용 모니터링 데이터 저장소는 리소스가 있는 지역(한국)에 있다. [A3] 확인한 문서에는 저장 **기간**이 없다. Modified abuse monitoring을 신청하면 저장하지 않는다. 단, 2026-11-01 이후 공개된 모델에는 이 신청을 없앨 예정이라고 한다. [A3] 우리 배포 모델 버전은 2026-03-17이다.
- **학습 사용:** "are NOT used to train any generative AI foundation models without your permission or instruction." [A1]
- **처리 역할:** "Microsoft Products and Services Data Protection Addendum"이 처리를 규율한다. [A4]

## 동의 문구·결정에 넘길 사항

1. **국외 처리:** GlobalStandard를 유지하면 동의 문구에 "마스킹한 글이 국외 Azure 리전에서 처리될 수 있음"을 적어야 한다. 국외 처리를 피하려면 배포를 Standard(한국)나 DataZone으로 바꿔야 한다. 배포 변경은 AX 담당 승인 대상이다.
2. **원본의 외부 전송:** OCR과 개인정보 탐지는 마스킹 전 원본과 글을 받는다. 처리 위치는 한국이다. 기획서 11번이 요구하는 대로 동의 화면에 밝힌다.
3. **남용 모니터링 보관 기간:** 공식 수치를 확인하지 못했다. Modified abuse monitoring 신청 여부와 함께 정한다.
4. **Document Intelligence·Language의 학습 사용과 처리 역할:** 서비스 문서에는 없다. Microsoft Product Terms의 DPA 원문으로 확인한다.
5. **제3자 개인정보 처리 근거**(계약서 속 임대인 등): 이 문서 범위 밖이다. 법률 검토 항목으로 남는다.

## 근거

- [A1]–[A4] Azure OpenAI 데이터·개인정보·보안: https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/openai/data-privacy (페이지 갱신일 2026-06-05)
- [T1] 배포 유형: https://learn.microsoft.com/en-us/azure/ai-foundry/foundry-models/concepts/deployment-types (2026-08-12)
- [D1][D2] Document Intelligence 데이터·개인정보·보안: https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/document-intelligence/data-privacy-security (2026-10-19)
- [L1][L2] Language 데이터·개인정보: https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/language-service/data-privacy (2026-08-17)
- 리소스 지역·SKU·배포 유형: 2026-11-27 `az` 조회 결과
