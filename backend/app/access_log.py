"""접근 로그. 방식·경로·상태·처리 시간만 남긴다(API 명세 10장).

uvicorn 기본 접근 로그는 쿼리까지 남겨 A27의 인가 코드와 정확한 좌표가 기록되므로 끈다.
"""

import logging
import time
from urllib.parse import quote

from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger("app.access")


def configure_access_log() -> None:
    logging.getLogger("uvicorn.access").disabled = True
    # uvicorn은 앱 로거에 핸들러를 달지 않아, 직접 달지 않으면 INFO 기록이 출력되지 않는다.
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
        logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False


class AccessLogMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        started = time.perf_counter()
        # 응답을 시작하지 못하고 끝나면 500이다.
        status = 500

        async def send_and_remember(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, send_and_remember)
        finally:
            # 경로의 줄바꿈 같은 문자로 로그 줄을 꾸며내지 못하게 인코딩한다.
            logger.info(
                "%s %s %d %.1fms",
                scope["method"],
                quote(scope["path"]),
                status,
                (time.perf_counter() - started) * 1000,
            )
