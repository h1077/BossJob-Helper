from copy import deepcopy
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph
from pydantic import ValidationError

from app.core.exceptions import AppException
from app.services.ai.chains import (
    _merge_section_content,
    _normalize_resume_data,
    _parse_json_content,
    _repair_json_content,
    _safe_int,
)
from app.services.ai.llm import get_llm
from app.services.ai.prompts import JD_NODE_PROMPT
from app.services.ai.schemas import JdOptimizeResult
from app.services.ai.token_usage import record_model_output, record_prompt_input


class JdOptimizeState(TypedDict, total=False):
    resume_data: dict[str, Any]
    job_description: str
    job_keywords: dict[str, Any]
    match_analysis: dict[str, Any]
    optimized_resume_data: dict[str, Any]
    suggestions: list[str]
    score: int


def _node_json(task: str, state: JdOptimizeState) -> dict[str, Any]:
    chain = JD_NODE_PROMPT | get_llm()
    variables = {"task": task, "input_json": _json_dumps(state)}
    record_prompt_input(JD_NODE_PROMPT, variables, f"JD 优化节点：{task[:24]}")
    message = chain.invoke(variables)
    content = getattr(message, "content", message)
    record_model_output(content, f"JD 优化节点：{task[:24]}")
    try:
        return _parse_json_content(content)
    except Exception:
        return _repair_json_content(content, task)


def _json_dumps(value: Any) -> str:
    import json

    return json.dumps(value, ensure_ascii=False)


def _list_value(result: dict[str, Any], key: str, fallback: Any) -> list[Any]:
    value = result.get(key)
    if not isinstance(value, list):
        value = result.get(f"optimized_{key}")
    if not isinstance(value, list) and isinstance(result.get("optimized_resume_data"), dict):
        value = result["optimized_resume_data"].get(key)
    if not isinstance(value, list):
        value = result.get("items") or result.get("data")
    return value if isinstance(value, list) else fallback if isinstance(fallback, list) else []


def _dict_value(result: dict[str, Any], key: str, fallback: Any) -> dict[str, Any]:
    value = result.get(key)
    if not isinstance(value, dict):
        value = result.get(f"optimized_{key}")
    if not isinstance(value, dict) and isinstance(result.get("optimized_resume_data"), dict):
        value = result["optimized_resume_data"].get(key)
    if not isinstance(value, dict):
        value = result.get("data")
    return value if isinstance(value, dict) else fallback if isinstance(fallback, dict) else {}


def _string_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value if item is not None]
    if isinstance(value, dict):
        items: list[str] = []
        for key, item in value.items():
            if isinstance(item, list):
                items.extend(str(entry) for entry in item if entry is not None)
            elif item is not None:
                items.append(f"{key}：{item}")
        return items
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def analyze_jd_node(state: JdOptimizeState) -> JdOptimizeState:
    return {
        "job_keywords": _node_json(
            "只分析岗位 JD，返回目标岗位、核心技能、核心职责、加分项、硬性条件；去除招聘套话，不修改简历。",
            state,
        )
    }


def analyze_resume_node(state: JdOptimizeState) -> JdOptimizeState:
    return {
        "match_analysis": _node_json(
            "对照 JD 与当前简历的事实证据，分别返回已匹配、部分匹配、缺失证据和潜在风险；不得把 JD 要求视为候选人能力。",
            state,
        )
    }


def optimize_skills_node(state: JdOptimizeState) -> JdOptimizeState:
    data = deepcopy(state["optimized_resume_data"])
    result = _node_json(
        "只优化 skills 模块并返回完整 skills 数组。保留全部条目、id、数量和顺序；只自然强化已有证据支持的 JD 关键词，无证据关键词不得新增。",
        state,
    )
    data["skills"] = _merge_section_content(
        data.get("skills", []),
        _list_value(result, "skills", data.get("skills", [])),
    )
    return {"optimized_resume_data": data}


def optimize_projects_node(state: JdOptimizeState) -> JdOptimizeState:
    data = deepcopy(state["optimized_resume_data"])
    result = _node_json(
        "只优化 projects 模块并返回完整 projects 数组。保留全部条目、id、数量和顺序；基于原文澄清场景、本人动作、技术选择和已有结果，不得新增技术或数字。",
        state,
    )
    data["projects"] = _merge_section_content(
        data.get("projects", []),
        _list_value(result, "projects", data.get("projects", [])),
    )
    return {"optimized_resume_data": data}


def optimize_work_node(state: JdOptimizeState) -> JdOptimizeState:
    data = deepcopy(state["optimized_resume_data"])
    result = _node_json(
        "只优化 work 模块并返回完整 work 数组。保留全部条目、id、数量和顺序；基于原文强化职责边界、本人贡献和已有结果，不得新增职责或数字。",
        state,
    )
    data["work"] = _merge_section_content(
        data.get("work", []),
        _list_value(result, "work", data.get("work", [])),
    )
    return {"optimized_resume_data": data}


def optimize_summary_node(state: JdOptimizeState) -> JdOptimizeState:
    data = deepcopy(state["optimized_resume_data"])
    result = _node_json(
        "只基于简历已有事实和 JD 相关性优化个人简介，返回 summary 对象。控制在 2-4 句，不得把 JD 缺失项写成候选人能力。",
        state,
    )
    data["summary"] = _merge_section_content(
        data.get("summary", {}),
        _dict_value(result, "summary", data.get("summary", {})),
    )
    return {"optimized_resume_data": data}


def score_resume_node(state: JdOptimizeState) -> JdOptimizeState:
    result = _node_json(
        "根据优化后简历对 JD 的可核验证据匹配度评分，返回 0-100 整数 score 和 suggestions。建议只描述真实修改或以‘待核实：’标记无证据缺口。",
        state,
    )
    return {"score": _safe_int(result.get("score", 0), 0), "suggestions": _string_list(result.get("suggestions", []))}


def build_result_node(state: JdOptimizeState) -> JdOptimizeState:
    return state


def build_jd_optimize_graph():
    graph = StateGraph(JdOptimizeState)
    graph.add_node("analyze_jd_node", analyze_jd_node)
    graph.add_node("analyze_resume_node", analyze_resume_node)
    graph.add_node("optimize_skills_node", optimize_skills_node)
    graph.add_node("optimize_projects_node", optimize_projects_node)
    graph.add_node("optimize_work_node", optimize_work_node)
    graph.add_node("optimize_summary_node", optimize_summary_node)
    graph.add_node("score_resume_node", score_resume_node)
    graph.add_node("build_result_node", build_result_node)
    graph.add_edge(START, "analyze_jd_node")
    graph.add_edge("analyze_jd_node", "analyze_resume_node")
    graph.add_edge("analyze_resume_node", "optimize_skills_node")
    graph.add_edge("optimize_skills_node", "optimize_projects_node")
    graph.add_edge("optimize_projects_node", "optimize_work_node")
    graph.add_edge("optimize_work_node", "optimize_summary_node")
    graph.add_edge("optimize_summary_node", "score_resume_node")
    graph.add_edge("score_resume_node", "build_result_node")
    graph.add_edge("build_result_node", END)
    return graph.compile()


def optimize_by_jd_graph(resume_data: dict[str, Any], job_description: str) -> JdOptimizeResult:
    normalized_resume_data = _normalize_resume_data(deepcopy(resume_data), {})
    state: JdOptimizeState = {
        "resume_data": normalized_resume_data,
        "optimized_resume_data": deepcopy(normalized_resume_data),
        "job_description": job_description,
        "suggestions": [],
        "score": 0,
    }
    result = build_jd_optimize_graph().invoke(state)
    result["job_keywords"] = result.get("job_keywords") if isinstance(result.get("job_keywords"), dict) else {}
    result["match_analysis"] = result.get("match_analysis") if isinstance(result.get("match_analysis"), dict) else {}
    result["optimized_resume_data"] = _normalize_resume_data(result.get("optimized_resume_data", {}), {})
    result["score"] = _safe_int(result.get("score", 0), 0)
    result["suggestions"] = _string_list(result.get("suggestions", []))
    try:
        return JdOptimizeResult.model_validate(result)
    except ValidationError as exc:
        raise AppException(f"JD 优化结果校验失败：{exc}") from exc
