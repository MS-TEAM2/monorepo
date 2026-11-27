# Azure 리소스 생성 절차

AX 담당이 1주차에 한 번 실행한다. **아래 명령은 이 레포를 만들 때 실행해 보지 못했다**(로컬에 `az`가 없었다). 한 줄씩 실행하면서 오류가 나면 `az <명령> --help`로 옵션을 확인한다.

부트캠프에서 제공한 구독은 쓸 수 있는 리전·SKU가 정책으로 제한될 수 있다. 리소스 생성이 정책 오류로 막히면 포털의 "정책 > 할당"에서 허용 범위를 확인하고 `LOCATION`이나 SKU를 바꾼다.

## 0. 변수

```bash
az login
az extension add --name ml --yes
az extension add --name containerapp --yes

export RG=rg-ax                      # 리소스 그룹 하나에 전부 (발표 후 그룹째 삭제)
export LOCATION=koreacentral
export SWA_LOCATION=eastasia         # Static Web Apps 는 지원 리전이 따로 있다
export PREFIX=axteam                 # 전역에서 유일해야 하는 이름의 접두사 (소문자·숫자)
export GH_REPO=<org>/<repo>

az group create -n $RG -l $LOCATION
```

## 1. 프론트엔드 — Static Web Apps (Free)

```bash
az staticwebapp create -n ${PREFIX}-web -g $RG -l $SWA_LOCATION --sku Free
az staticwebapp show -n ${PREFIX}-web -g $RG --query defaultHostname -o tsv
```

GitHub 연동 옵션은 쓰지 않는다. 배포는 `deploy.yml`이 한다.

## 2. 백엔드 — Container Apps (Consumption, scale-to-zero)

```bash
az containerapp env create -n ${PREFIX}-env -g $RG -l $LOCATION

az containerapp create -n ${PREFIX}-api -g $RG --environment ${PREFIX}-env \
  --image mcr.microsoft.com/k8se/quickstart:latest \
  --target-port 8000 --ingress external \
  --min-replicas 0 --max-replicas 1 \
  --cpu 0.5 --memory 1.0Gi \
  --system-assigned

az containerapp show -n ${PREFIX}-api -g $RG --query properties.configuration.ingress.fqdn -o tsv
```

- **개발 중에는 `--min-replicas 0`.** 발표일에만 `az containerapp update -n ${PREFIX}-api -g $RG --min-replicas 1`, 끝나면 다시 0.
- 이미지는 GHCR(public)에서 받으므로 레지스트리 자격 증명이 필요 없다. 첫 배포 후 GitHub의 패키지 설정에서 `backend` 패키지를 Public으로 바꾼다.
- 환경 변수: `az containerapp update -n ${PREFIX}-api -g $RG --set-env-vars 'CORS_ORIGINS=["https://<SWA 호스트>"]'`
- 계약서 분석의 Azure AI 서비스 엔드포인트도 같은 방법으로 넣는다. 비밀 값이 아니다. 인증은 앱의 관리 ID(`AZURE_CLIENT_ID`)로 하므로 키는 넣지 않는다. 관리 ID에는 `Cognitive Services User` 역할이 있어야 한다.

  | 이름 | 값 (팀 리소스) | 쓰는 곳 |
  | --- | --- | --- |
  | `AZURE_DOCINTEL_ENDPOINT` | `https://di-jjcs.cognitiveservices.azure.com/` | OCR (`ai_core.contract.ocr_azure`) |
  | `AZURE_LANGUAGE_ENDPOINT` | `https://lang-jjcs.cognitiveservices.azure.com/` | 개인정보 탐지 (`ai_core.contract.pii_detect`) |

## 3. DB — PostgreSQL Flexible Server (B1MS, 32GB)

```bash
az postgres flexible-server create -n ${PREFIX}-pg -g $RG -l $LOCATION \
  --tier Burstable --sku-name Standard_B1ms \
  --storage-size 32 \
  --admin-user axadmin --admin-password '<강한 비밀번호>' \
  --public-access 0.0.0.0
```

- **저장소는 32GB로.** 요금은 사용량이 아니라 프로비저닝한 용량 기준이다.
- 비밀번호는 바로 Key Vault에 넣고 다른 곳에 남기지 않는다.

## 4. 데이터·비밀 — Blob Storage, Key Vault

```bash
az storage account create -n ${PREFIX}data -g $RG -l $LOCATION --sku Standard_LRS
az storage container create --account-name ${PREFIX}data -n raw --auth-mode login
az storage container create --account-name ${PREFIX}data -n datasets --auth-mode login

az keyvault create -n ${PREFIX}-kv -g $RG -l $LOCATION --enable-rbac-authorization true
```

Container Apps의 관리 ID에 Key Vault 읽기 권한을 준다.

```bash
APP_PRINCIPAL=$(az containerapp show -n ${PREFIX}-api -g $RG --query identity.principalId -o tsv)
KV_ID=$(az keyvault show -n ${PREFIX}-kv -g $RG --query id -o tsv)
az role assignment create --assignee $APP_PRINCIPAL --role "Key Vault Secrets User" --scope $KV_ID
```

비밀 값은 Key Vault 참조로 Container Apps에 연결한다(`az containerapp secret set ... keyvaultref:<비밀 URL>,identityref:system`).

## 5. 학습 — Azure ML (최소 노드 0)

```bash
az ml workspace create -n ${PREFIX}-ml -g $RG -l $LOCATION
az ml compute create -n cpu-cluster --type AmlCompute --size Standard_DS2_v2 \
  --min-instances 0 --max-instances 1 --idle-time-before-scale-down 300 \
  -g $RG -w ${PREFIX}-ml
```

- 클러스터 이름 `cpu-cluster`는 `ai/azureml/train-job.yml`과 맞춰야 한다.
- **Managed Online Endpoint는 만들지 않는다**(24시간 과금). 모델은 백엔드 이미지에 넣는다.
- 노트북용 컴퓨트 인스턴스를 만들었다면 자동 종료 스케줄을 반드시 건다.

## 6. GitHub Actions OIDC

```bash
APP_ID=$(az ad app create --display-name ${PREFIX}-github --query appId -o tsv)
az ad sp create --id $APP_ID
SUB_ID=$(az account show --query id -o tsv)
az role assignment create --assignee $APP_ID --role Contributor \
  --scope /subscriptions/$SUB_ID/resourceGroups/$RG

# main 배포용 자격 증명. PR 미리보기는 쓰지 않으므로 PR용 자격 증명은 만들지 않는다.
az ad app federated-credential create --id $APP_ID --parameters '{
  "name": "github-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:'$GH_REPO':ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"]
}'

echo "AZURE_CLIENT_ID=$APP_ID"
echo "AZURE_TENANT_ID=$(az account show --query tenantId -o tsv)"
echo "AZURE_SUBSCRIPTION_ID=$SUB_ID"
```

테넌트에서 앱 등록 권한이 없으면 `az ad app create`가 실패한다. 그 경우 부트캠프 운영 측에 앱 등록 또는 서비스 주체 발급을 요청한다.

## 7. GitHub 레포 Variables

Settings → Secrets and variables → Actions → **Variables** (비밀이 아니므로 Variables에 둔다).

| 이름 | 값 |
| --- | --- |
| `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID` | 6번 출력 |
| `AZURE_RESOURCE_GROUP` | `rg-ax` |
| `AZURE_SWA_NAME` | `<PREFIX>-web` |
| `AZURE_CONTAINER_APP` | `<PREFIX>-api` |
| `API_BASE_URL` | `https://<Container Apps FQDN>` |
| `AML_WORKSPACE` | `<PREFIX>-ml` |
| `AML_MODEL_NAME` | 등록할 모델 이름. 비워 두면 배포 때 샘플 모델을 학습해 넣는다 |

`AZURE_CLIENT_ID`를 넣기 전까지 `deploy.yml`은 모든 잡을 건너뛴다.

## 8. 비용 장치

- [ ] 포털 Cost Management → 예산: 부트캠프 제공 한도의 50%·80%에서 이메일 알림
- [ ] 학습 클러스터 최소 노드 0 확인
- [ ] Container Apps 최소 레플리카 0 확인
- [ ] PostgreSQL 저장소 32GB 이하 확인
- [ ] 발표 후: `az group delete -n $RG`
