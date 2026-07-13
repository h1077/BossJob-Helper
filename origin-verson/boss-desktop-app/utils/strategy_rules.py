"""
岗位-简历匹配策略引擎

定义不同公司类型的默认策略规则，并提供 apply_strategy() 用于
根据策略裁剪/重排结构化简历数据。
"""

# 默认策略规则（与 StrategyRule 模型 seed 数据保持一致）
DEFAULT_RULES = {
    '私企': {
        'show_political_status': False,
        'student_work_handling': 'remove',
        'tone': '主导',
        'skill_order': ['programming', 'ai', 'tools', 'hardware', 'english', 'other'],
        'description': '私企注重硬技能和项目成果，去掉政治面貌和学生工作，动词用"主导/负责/设计/优化"，突出量化指标。',
    },
    '国企': {
        'show_political_status': True,
        'student_work_handling': 'keep',
        'tone': '参与',
        'skill_order': ['programming', 'hardware', 'ai', 'english', 'tools', 'other'],
        'description': '国企注重全面发展和稳定性，保留政治面貌和学生工作，动词用"参与/承担/完成"，突出综合能力。',
    },
    '外企': {
        'show_political_status': False,
        'student_work_handling': 'compact',
        'tone': '主导',
        'skill_order': ['english', 'programming', 'ai', 'tools', 'hardware', 'other'],
        'description': '外企注重英语能力和技术深度，去掉政治面貌，学生工作精简，动词用"Led/Managed/Achieved"，突出国际视野。',
    },
    '事业单位': {
        'show_political_status': True,
        'student_work_handling': 'keep',
        'tone': '参与',
        'skill_order': ['english', 'ai', 'programming', 'tools', 'hardware', 'other'],
        'description': '事业单位注重论文和学术能力，保留政治面貌和学生工作，动词用"参与/研究/发表"，突出学术产出。',
    },
    '科研院所': {
        'show_political_status': True,
        'student_work_handling': 'keep',
        'tone': '参与',
        'skill_order': ['ai', 'english', 'programming', 'tools', 'hardware', 'other'],
        'description': '科研院所注重研究能力和学术产出，保留政治面貌和学生工作，动词用"研究/探索/发表"，突出创新能力。',
    },
}

# 技能 key 中文映射
SKILL_LABELS = {
    'english': '英语', 'programming': '编程', 'ai': 'AI与数据分析',
    'tools': '工具', 'hardware': '硬件', 'other': '其他',
}

# 语调风格映射
TONE_MAP = {
    '主导': {'verbs': ['主导', '负责', '设计', '优化', '交付', '推动', '实现'],
             'style': '结果导向，突出个人贡献和量化成果'},
    '参与': {'verbs': ['参与', '承担', '完成', '配合', '协助', '支持', '学习'],
             'style': '团队协作导向，突出参与深度和综合贡献'},
}


def apply_strategy(structured_data, strategy):
    """
    根据策略裁剪/重排结构化简历数据。

    参数:
        structured_data: dict — 简历结构化数据
        strategy: dict — 包含 company_type, highlighted_projects, highlighted_internships,
                         highlighted_skills, strategy_notes

    返回:
        dict — 定制后的结构化数据（深拷贝，不修改原数据）
    """
    import copy
    sd = copy.deepcopy(structured_data) if structured_data else {}

    company_type = strategy.get('company_type', '私企') if isinstance(strategy, dict) else '私企'
    rules = DEFAULT_RULES.get(company_type, DEFAULT_RULES['私企'])

    # 1. 政治面貌
    if not rules['show_political_status']:
        sd.pop('political_status', None)

    # 2. 学生工作
    if rules['student_work_handling'] == 'remove':
        sd.pop('student_work', None)
    elif rules['student_work_handling'] == 'compact':
        sw = sd.get('student_work', [])
        if isinstance(sw, list) and len(sw) > 1:
            sd['student_work'] = sw[:1]  # 只保留一条

    # 3. 项目优先级重排
    highlighted = strategy.get('highlighted_projects', []) if isinstance(strategy, dict) else []
    if highlighted and isinstance(highlighted, list):
        projects = sd.get('projects', [])
        if isinstance(projects, list) and projects:
            # 按 highlighted 索引和优先级重排
            priority_map = {}
            for item in highlighted:
                if isinstance(item, (list, tuple)) and len(item) >= 2:
                    priority_map[item[0]] = item[1]
                elif isinstance(item, dict):
                    priority_map[item.get('index', item.get('id', 0))] = item.get('priority', 0)
                else:
                    priority_map[item] = 99

            ordered = sorted(
                enumerate(projects),
                key=lambda x: priority_map.get(x[0], 99)
            )
            sd['projects'] = [projects[i] for i, _ in ordered]

    # 4. 实习优先级重排
    highlighted_int = strategy.get('highlighted_internships', []) if isinstance(strategy, dict) else []
    if highlighted_int and isinstance(highlighted_int, list):
        internships = sd.get('internships', [])
        if isinstance(internships, list) and internships:
            priority_map = {}
            for item in highlighted_int:
                if isinstance(item, (list, tuple)) and len(item) >= 2:
                    priority_map[item[0]] = item[1]
                elif isinstance(item, dict):
                    priority_map[item.get('index', item.get('id', 0))] = item.get('priority', 0)
                else:
                    priority_map[item] = 99
            ordered = sorted(
                enumerate(internships),
                key=lambda x: priority_map.get(x[0], 99)
            )
            sd['internships'] = [internships[i] for i, _ in ordered]

    # 5. 技能排序（重排 skills dict 的 key 顺序）
    skill_order = rules.get('skill_order', [])
    skills = sd.get('skills', {})
    if isinstance(skills, dict) and skill_order:
        ordered_skills = {}
        for key in skill_order:
            if key in skills:
                ordered_skills[key] = skills[key]
        for key in skills:
            if key not in ordered_skills:
                ordered_skills[key] = skills[key]
        sd['skills'] = ordered_skills

    # 6. 语调风格标记（供 AI prompt 使用）
    tone_config = TONE_MAP.get(rules.get('tone', '主导'), TONE_MAP['主导'])
    sd['_strategy_meta'] = {
        'company_type': company_type,
        'tone': rules.get('tone', '主导'),
        'tone_description': tone_config['style'],
        'suggested_verbs': tone_config['verbs'],
        'student_work_handling': rules['student_work_handling'],
        'show_political_status': rules['show_political_status'],
    }

    return sd


def build_strategy_prompt(strategy_data, rules):
    """为 AI rewrite 构建策略注入文本"""
    if not strategy_data:
        return ''

    company_type = strategy_data.get('companyType', '私企')
    rules_data = rules or DEFAULT_RULES.get(company_type, DEFAULT_RULES['私企'])

    parts = [f'## 简历定制策略（{company_type}）']

    if not rules_data.get('show_political_status'):
        parts.append('- 隐藏政治面貌信息')
    else:
        parts.append('- 保留政治面貌信息')

    sw = rules_data.get('student_work_handling', 'keep')
    if sw == 'remove':
        parts.append('- 删除学生工作经历')
    elif sw == 'compact':
        parts.append('- 精简学生工作经历（最多1条）')
    else:
        parts.append('- 保留学生工作经历')

    parts.append(f'- 语调风格：{rules_data.get("tone", "主导")} ({rules_data.get("description", "")})')

    highlighted = strategy_data.get('highlightedSkills', [])
    if highlighted:
        skill_names = [SKILL_LABELS.get(s[0] if isinstance(s, list) else s, s) for s in highlighted]
        parts.append(f'- 技能侧重：{" > ".join(skill_names)}')

    notes = strategy_data.get('strategyNotes', '')
    if notes:
        parts.append(f'- 额外策略：{notes}')

    return '\n'.join(parts)
