"""通用 AI 调用工具"""
import requests

def call_ai(system_prompt: str, user_prompt: str, temperature: float = 0.3, max_tokens: int = 800) -> str:
    """使用默认AI配置调用LLM，返回原始响应文本"""
    from models import AIConfig
    from utils.crypto import decrypt_key

    config = AIConfig.query.filter_by(is_default=True, is_active=True).first()
    if not config:
        config = AIConfig.query.filter_by(is_active=True).first()
    if not config or not config.api_key:
        raise RuntimeError('未配置AI API Key')

    api_key = decrypt_key(config.api_key) if config.api_key else ''
    if not api_key:
        raise RuntimeError('AI API Key解密失败')

    endpoint = config.api_url.rstrip('/')
    if not endpoint.endswith('/chat/completions'):
        endpoint += '/chat/completions'

    messages = [
        {'role': 'system', 'content': system_prompt},
        {'role': 'user', 'content': user_prompt}
    ]

    resp = requests.post(
        endpoint,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}'
        },
        json={
            'model': config.model or 'deepseek-chat',
            'messages': messages,
            'temperature': temperature,
            'max_tokens': max_tokens
        },
        timeout=60
    )
    resp.raise_for_status()
    data = resp.json()
    return (data.get('choices', [{}])[0].get('message', {}).get('content', '')) or ''
