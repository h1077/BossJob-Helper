"""
Agent API — 供 AI Agent (Claude/GPT/Cursor) 调用的 REST 端点
所有响应 stdout 友好，统一 JSON 信封：{"ok": true/false, "data": ..., "error": null/"..."}
"""
import json
import os
from datetime import datetime
from flask import Blueprint, request, jsonify

agent_bp = Blueprint('agent', __name__, url_prefix='/api/agent')

# 指令队列（内存，重启清空）
_command_queue = []


def _ok(data):
    return jsonify({"ok": True, "data": data, "error": None})


def _err(msg, code=400):
    return jsonify({"ok": False, "data": None, "error": msg}), code


@agent_bp.route('/status', methods=['GET'])
def agent_status():
    """获取当前状态"""
    from boss_state import get_daily_stats
    stats = get_daily_stats()
    return _ok({
        "server": "running",
        "today_applied": stats.get("greets_sent", 0),
        "today_replied": stats.get("hr_replies", 0),
        "today_interviews": stats.get("interview_invites", 0),
        "pending_commands": len(_command_queue),
        "timestamp": datetime.now().isoformat(),
    })


@agent_bp.route('/stats', methods=['GET'])
def agent_stats():
    """获取投递漏斗数据"""
    from boss_state import get_daily_stats, list_applications
    stats = get_daily_stats()
    jobs = list_applications()
    status_counts = {"interested": 0, "applied": 0, "interviewing": 0, "rejected": 0}
    for j in jobs:
        s = j.get("status", "interested")
        if s in status_counts:
            status_counts[s] += 1
    return _ok({
        "today": {
            "applied": stats.get("greets_sent", 0),
            "replied": stats.get("hr_replies", 0),
            "interviews": stats.get("interview_invites", 0),
        },
        "funnel": status_counts,
        "total_jobs": len(jobs),
    })


@agent_bp.route('/jobs', methods=['GET'])
def agent_jobs():
    """获取岗位列表"""
    from boss_state import list_applications
    status_filter = request.args.get('status', '')
    limit = min(int(request.args.get('limit', 50)), 200)
    jobs = list_applications()
    if status_filter:
        jobs = [j for j in jobs if j.get('status') == status_filter]
    return _ok({
        "jobs": jobs[:limit],
        "total": len(jobs),
        "limit": limit,
    })


@agent_bp.route('/command', methods=['GET'])
def agent_get_command():
    """JS 脚本轮询：获取待执行指令"""
    if _command_queue:
        cmd = _command_queue.pop(0)
        return _ok({"pending": True, "command": cmd})
    return _ok({"pending": False, "command": None})


@agent_bp.route('/command', methods=['POST'])
def agent_post_command():
    """Agent 发送指令"""
    data = request.get_json(silent=True) or {}
    action = data.get('action', '')
    if action not in ('start_apply', 'stop_apply', 'search', 'refresh'):
        return _err(f"未知指令: {action}")
    cmd = {
        "action": action,
        "params": data.get('params', {}),
        "issued_at": datetime.now().isoformat(),
        "id": str(len(_command_queue) + 1),
    }
    _command_queue.append(cmd)
    return _ok({"queued": True, "command": cmd})


@agent_bp.route('/command/ack', methods=['POST'])
def agent_ack_command():
    """JS 脚本确认指令执行完毕"""
    data = request.get_json(silent=True) or {}
    cmd_id = data.get('id', '')
    return _ok({"acked": True, "id": cmd_id})


@agent_bp.route('/analyze', methods=['POST'])
def agent_analyze():
    """Agent 请求 AI 分析岗位"""
    data = request.get_json(silent=True) or {}
    jd_text = data.get('jd_text', '')
    position_name = data.get('position_name', '')
    company_name = data.get('company_name', '')
    resume_text = data.get('resume_text', '')

    if not jd_text and not position_name:
        return _err("缺少岗位信息")

    try:
        from boss_replier import llm_chat_deepseek
        resume_block = f"\n候选人简历：\n{resume_text[:1500]}" if resume_text else ""
        prompt = f"""你是资深职业顾问。分析以下岗位。

公司：{company_name or '未知'}
岗位：{position_name or '未知'}
JD：{jd_text[:2000]}{resume_block}

按以下格式输出（每行一个维度，|分隔）：
匹配度|0-100的数字
匹配技能|JD要求的关键技能
技能差距|候选人可能欠缺的
决策建议|值得投/谨慎/放弃，理由
风险点|需要注意的风险
建议提问|面试时可问HR的问题

只输出上述6行。"""

        reply = llm_chat_deepseek([
            {"role": "system", "content": "你是资深职业顾问，只输出指定格式。"},
            {"role": "user", "content": prompt},
        ])
        return _ok({"analysis": reply.strip()})
    except Exception as e:
        return _err(f"AI 分析失败: {str(e)}", 500)
