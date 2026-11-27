"""테스트용 가짜 LLM 클라이언트. 운영에서 쓰지 않는다.

정해 둔 응답을 돌려주고 받은 지시·글을 기록한다. 이 클래스로 통과한 테스트는 실제 LLM 의 추출 품질을
확인한 것이 아니다. 품질은 SCRUM-141 평가로 잰다.
"""

from collections.abc import Callable


class FakeLlmClient:
    def __init__(
        self, answer: str | Callable[[str, str], str] = '{"terms": {}}', *, error: bool = False
    ):
        self.answer = answer
        self.error = error
        self.calls: list[tuple[str, str]] = []

    async def complete(self, system: str, user: str) -> str:
        self.calls.append((system, user))
        if self.error:
            raise ConnectionError("가짜 LLM 실패")
        return self.answer(system, user) if callable(self.answer) else self.answer
