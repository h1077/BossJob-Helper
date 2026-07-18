from langchain_openai import ChatOpenAI

from app.services.ai_config_service import get_active_ai_config


def get_llm(timeout: int | None = None) -> ChatOpenAI:
    config = get_active_ai_config()
    request_timeout = max(int(config.timeout or 0), int(timeout or 0)) if timeout else config.timeout
    return ChatOpenAI(
        api_key=config.api_key,
        base_url=config.base_url,
        model=config.model,
        temperature=config.temperature,
        timeout=request_timeout,
        max_tokens=config.max_tokens,
    )
