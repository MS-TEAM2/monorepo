from datetime import datetime

from pydantic import BaseModel, Field


class TokenRequest(BaseModel):
    code: str = Field(description="1회용 로그인 코드. 60초 뒤 만료된다", examples=["one-time-code"])
    code_verifier: str = Field(
        description="로그인 시작 때 보낸 code_challenge의 원본 값", examples=["example-verifier"]
    )


class TokenResponse(BaseModel):
    token: str = Field(description="세션 토큰. 이 응답에서만 준다", examples=["example-token"])
    expires_at: datetime = Field(examples=["2026-12-25T00:00:00Z"])
