from __future__ import annotations

from copy import deepcopy
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.models.resume import Resume, ResumeStarter, ResumeStarterIndustryTemplate
from app.schemas.resume import ResumeCreate, default_template_config
from app.services.resume_service import create_resume


STARTER_LEVELS: list[dict[str, str]] = [
    {"id": "fresh", "label": "应届 / 实习", "short_label": "应届", "status": "应届生"},
    {"id": "junior", "label": "1-3 年经验", "short_label": "1-3 年", "status": "在职求职"},
    {"id": "mid", "label": "3-5 年经验", "short_label": "3-5 年", "status": "在职求职"},
    {"id": "senior", "label": "5 年以上", "short_label": "5 年+", "status": "资深从业者"},
]

INDUSTRY_DEFAULT_TEMPLATES: dict[str, str] = {
    "internet": "tech",
    "data-ai": "blue_timeline",
    "finance": "executive_panel",
    "education": "classic",
    "healthcare": "modern_clean",
    "manufacturing": "compact_matrix",
    "sales": "executive_panel",
    "design-media": "portfolio_cards",
    "hr-admin": "modern_clean",
    "marketing": "editorial_serif",
    "ecommerce-retail": "modern_clean",
    "operations-service": "modern_clean",
    "logistics-supply": "compact_matrix",
    "construction-realestate": "compact_matrix",
    "legal-compliance": "elegant_line",
    "energy-environment": "compact_matrix",
    "hospitality-tourism": "modern_clean",
    "food-agriculture": "classic",
}

DEFAULT_FIELD_CONFIG: dict[str, dict[str, Any]] = {
    "phone": {"label": "电话", "icon": "Phone", "row": 1, "order": 1},
    "email": {"label": "邮箱", "icon": "Mail", "row": 1, "order": 2},
    "status": {"label": "当前状态", "icon": "Info", "row": 1, "order": 3},
    "location": {"label": "地点", "icon": "MapPin", "row": 1, "order": 4},
    "highest_degree": {"label": "最高学历", "icon": "GraduationCap", "row": 2, "order": 1},
    "website": {"label": "个人网站", "icon": "Globe", "row": 2, "order": 2},
    "github": {"label": "代码仓库", "icon": "Github", "row": 2, "order": 3},
    "expected_salary": {"label": "期望薪资", "icon": "Briefcase", "row": 2, "order": 4},
}


def _starter_field_config() -> dict[str, dict[str, Any]]:
    config = deepcopy(DEFAULT_FIELD_CONFIG)
    order = ["phone", "email", "status", "location", "expected_salary", "highest_degree", "website", "github"]
    for index, key in enumerate(order, start=1):
        if key in config:
            config[key]["row"] = 1
            config[key]["order"] = index
    return config


BUILTIN_STARTERS: list[dict[str, Any]] = [
    {
        "industry_id": "internet",
        "industry_name": "互联网 / 科技",
        "industry_description": "强调项目落地、技术栈、产品指标和跨团队协作。",
        "roles": [
            {
                "starter_id": "internet-frontend-engineer",
                "role_title": "前端开发工程师",
                "role_subtitle": "Web / 小程序 / 中后台",
                "keywords": ["Vue3", "TypeScript", "性能优化", "组件化", "工程化", "用户体验"],
                "focus": ["突出技术栈和业务复杂度", "写清性能、稳定性、效率指标", "展示组件沉淀和协作能力"],
                "content": {
                    "summary": "具备前端工程化和业务页面交付经验，熟悉 Vue3、TypeScript 与组件化开发，关注页面性能、交互体验和可维护性。",
                    "skills": [
                        {"name": "前端开发", "keywords": ["Vue3", "TypeScript", "Pinia", "Vite"], "description": "熟悉现代前端开发流程，能够独立完成页面搭建、状态管理、接口联调和交互细节优化。"},
                        {"name": "工程化能力", "keywords": ["组件库", "性能优化", "代码规范", "构建优化"], "description": "具备组件抽象、构建配置、首屏优化和可维护性治理经验。"},
                    ],
                    "work": {"position": "前端开发工程师", "description": "负责业务系统前端开发，与产品、设计、后端协作完成需求评审、页面实现、接口联调和上线验证。", "highlights": ["重构核心页面组件，统一交互规范和数据状态处理方式，减少重复代码并提升迭代效率。", "优化列表渲染、资源加载和接口请求策略，使关键页面加载体验和操作流畅度明显提升。"]},
                    "project": {"name": "企业级业务管理平台", "role": "前端负责人", "tech_stack": "Vue3 / TypeScript / Pinia / Vite / Tailwind CSS", "description": "面向业务团队的中后台系统，覆盖数据看板、流程审批、权限管理和批量操作场景。", "highlights": ["设计可复用表单、表格和筛选组件，支持多业务模块快速搭建页面。", "与后端约定接口格式和错误处理规则，提升复杂流程下的用户反馈一致性。"]},
                },
            },
            {
                "starter_id": "internet-product-manager",
                "role_title": "产品经理",
                "role_subtitle": "B 端 / C 端 / 增长",
                "keywords": ["需求分析", "PRD", "用户调研", "数据分析", "A/B 测试", "项目推进"],
                "focus": ["写清负责的产品模块", "用数据说明业务结果", "突出推进、沟通和取舍能力"],
                "content": {
                    "summary": "具备从用户调研、需求拆解到产品上线和数据复盘的完整经验，能够协调设计、研发、运营推进产品目标落地。",
                    "skills": [
                        {"name": "产品规划", "keywords": ["需求池", "PRD", "原型设计", "竞品分析"], "description": "能够基于业务目标和用户反馈拆解需求，输出清晰的产品方案和优先级判断。"},
                        {"name": "数据与增长", "keywords": ["漏斗分析", "用户分层", "转化率", "留存"], "description": "熟悉常见产品指标分析方法，能通过数据定位问题并推动体验优化。"},
                    ],
                    "work": {"position": "产品经理", "description": "负责核心产品模块的需求分析、方案设计、项目推进和上线复盘，协调多角色完成版本迭代。", "highlights": ["梳理用户关键路径并优化核心流程，推动转化、留存或使用效率等指标改善。", "建立需求评审和上线复盘机制，提高跨团队协作透明度和版本交付质量。"]},
                    "project": {"name": "用户增长与转化优化项目", "role": "产品负责人", "tech_stack": "原型设计 / 数据看板 / A/B 测试", "description": "围绕用户注册、激活和关键行为转化进行流程优化与实验验证。", "highlights": ["基于用户访谈和埋点数据定位流失节点，输出优化方案并推动上线。", "设计分层运营和实验指标，持续跟踪数据表现并沉淀可复用方法。"]},
                },
            },
        ],
    },
    {
        "industry_id": "finance",
        "industry_name": "金融 / 财务",
        "industry_description": "强调严谨、合规、数据分析、风险意识和业务理解。",
        "roles": [
            {
                "starter_id": "finance-financial-analyst",
                "role_title": "财务分析师",
                "role_subtitle": "预算 / 经营分析 / 报表",
                "keywords": ["预算管理", "财务模型", "经营分析", "Excel", "Power BI", "成本控制"],
                "focus": ["突出报表、预算、模型能力", "写清支持的业务决策", "体现准确性和风险意识"],
                "content": {
                    "summary": "具备财务分析、预算跟踪和经营数据解读能力，能够通过报表和模型支持业务决策。",
                    "skills": [
                        {"name": "财务分析", "keywords": ["预算", "Forecast", "成本分析", "现金流"], "description": "熟悉预算编制、费用分析和经营指标追踪，能够输出结构化分析结论。"},
                        {"name": "数据工具", "keywords": ["Excel", "Power BI", "SQL", "财务模型"], "description": "能够使用数据工具整理多来源数据，搭建可复用报表和分析模板。"},
                    ],
                    "work": {"position": "财务分析师", "description": "负责月度经营分析、预算执行跟踪和业务部门财务支持，协助管理层识别成本与收入变化。", "highlights": ["搭建费用分析模板，提升预算偏差定位效率，并推动异常费用跟进闭环。", "输出月度经营分析报告，解释收入、成本和利润变化原因，支持业务决策。"]},
                    "project": {"name": "年度预算与经营分析体系优化", "role": "核心成员", "tech_stack": "Excel / Power BI / 财务模型", "description": "围绕预算编制、执行监控和经营复盘建立统一分析口径。", "highlights": ["统一部门预算科目和数据口径，减少手工核对成本。", "沉淀可复用分析看板，支持管理层快速查看关键经营指标。"]},
                },
            },
            {
                "starter_id": "finance-risk-control",
                "role_title": "风控专员",
                "role_subtitle": "信贷 / 合规 / 反欺诈",
                "keywords": ["风险识别", "合规审查", "贷前审核", "反欺诈", "数据核验", "流程规范"],
                "focus": ["强调准确率和合规意识", "写清审核场景和规则", "体现问题发现与流程优化"],
                "content": {
                    "summary": "具备风险识别、资料审核和合规流程执行经验，能够在效率与风险之间保持稳定判断。",
                    "skills": [
                        {"name": "风险审核", "keywords": ["贷前审核", "资质核验", "反欺诈", "风险分级"], "description": "熟悉资料完整性、真实性和风险点核验，能够按规则完成判断并记录依据。"},
                        {"name": "流程与合规", "keywords": ["合规要求", "SOP", "异常跟进", "内控"], "description": "理解金融业务合规要求，能够推动审核流程标准化和风险闭环。"},
                    ],
                    "work": {"position": "风控专员", "description": "负责客户资料审核、风险点识别、异常案件跟进和合规记录维护。", "highlights": ["根据风控规则识别高风险线索，及时反馈异常并协助完善审核标准。", "整理常见问题案例，优化审核清单，提高团队处理一致性。"]},
                    "project": {"name": "客户准入审核流程优化", "role": "流程优化成员", "tech_stack": "SOP / 风险标签 / 数据核验", "description": "针对客户准入审核流程中的重复核验和异常记录问题进行优化。", "highlights": ["梳理审核节点和高频异常类型，形成标准化检查清单。", "协助建立风险标签记录方式，提升后续复盘和追踪效率。"]},
                },
            },
        ],
    },
    {
        "industry_id": "education",
        "industry_name": "教育 / 培训",
        "industry_description": "突出课程设计、教学成果、学生反馈和组织沟通。",
        "roles": [
            {
                "starter_id": "education-teacher",
                "role_title": "学科教师",
                "role_subtitle": "中小学 / 教培 / 素质教育",
                "keywords": ["课程设计", "课堂管理", "学情分析", "家校沟通", "教学反馈", "教研"],
                "focus": ["写清教授对象和课程", "体现教学成果与反馈", "突出沟通和班级管理能力"],
                "content": {
                    "summary": "具备课程设计、课堂组织和学情跟踪能力，能够根据学生基础调整教学策略并推动学习效果提升。",
                    "skills": [
                        {"name": "教学设计", "keywords": ["教案", "课程规划", "分层教学", "课堂互动"], "description": "能够围绕教学目标设计课程内容，并根据学生反馈调整节奏和方法。"},
                        {"name": "学情管理", "keywords": ["测评", "错题分析", "家校沟通", "学习计划"], "description": "熟悉学生学习状态跟踪，能形成针对性的辅导和沟通方案。"},
                    ],
                    "work": {"position": "学科教师", "description": "负责课程授课、课后反馈、学情分析和家校沟通，参与教研和课程内容迭代。", "highlights": ["根据测评结果对学生进行分层辅导，提升课堂吸收和作业完成质量。", "沉淀教学案例和练习材料，支持同科目教师复用和教研讨论。"]},
                    "project": {"name": "阶段性学习提升计划", "role": "课程执行负责人", "tech_stack": "课程大纲 / 学情测评 / 家校反馈", "description": "面向不同基础学生制定阶段学习目标、练习任务和反馈机制。", "highlights": ["拆解知识薄弱点并匹配专项练习，帮助学生形成稳定复习节奏。", "定期同步学习进展和问题，提升家校沟通效率和信任度。"]},
                },
            },
            {
                "starter_id": "education-curriculum-ops",
                "role_title": "课程运营",
                "role_subtitle": "在线教育 / 社群 / 转化",
                "keywords": ["课程排期", "社群运营", "用户转化", "活动策划", "数据复盘", "续费"],
                "focus": ["突出运营指标", "写清用户分层和活动机制", "体现课程服务意识"],
                "content": {
                    "summary": "具备课程运营、用户沟通和数据复盘经验，能够围绕转化、完课和续费目标设计运营动作。",
                    "skills": [
                        {"name": "课程运营", "keywords": ["排课", "完课率", "续费", "用户分层"], "description": "熟悉课程交付链路，能够跟进开课、学习提醒、反馈收集和续费转化。"},
                        {"name": "社群与活动", "keywords": ["社群维护", "活动策划", "话术", "数据复盘"], "description": "能够设计社群互动和活动节奏，提升用户参与度和满意度。"},
                    ],
                    "work": {"position": "课程运营", "description": "负责课程排期、学员服务、社群维护和运营数据复盘，协助提升完课与续费表现。", "highlights": ["搭建开课提醒、学习反馈和作业跟进流程，提高用户参与和课程完成质量。", "按用户阶段设计社群触达内容，促进试听转化和老用户续费。"]},
                    "project": {"name": "在线课程完课率提升项目", "role": "运营执行", "tech_stack": "社群运营 / 数据表 / 用户触达", "description": "针对课程中后段活跃下降问题，设计提醒、激励和反馈机制。", "highlights": ["拆分用户学习阶段并制定触达节奏，降低课程中途流失。", "通过问卷和社群反馈收集问题，推动课程服务流程优化。"]},
                },
            },
        ],
    },
    {
        "industry_id": "healthcare",
        "industry_name": "医疗 / 健康",
        "industry_description": "强调专业规范、服务意识、流程执行和风险防控。",
        "roles": [
            {
                "starter_id": "healthcare-nurse",
                "role_title": "护士",
                "role_subtitle": "临床 / 门诊 / 健康管理",
                "keywords": ["护理操作", "病区管理", "患者沟通", "医嘱执行", "院感", "急救配合"],
                "focus": ["写清科室和护理场景", "体现规范、安全和沟通", "避免夸大医疗结果"],
                "content": {
                    "summary": "具备规范护理操作、患者沟通和医嘱执行经验，重视护理安全、服务质量和团队协作。",
                    "skills": [
                        {"name": "临床护理", "keywords": ["生命体征", "静脉输液", "护理记录", "医嘱执行"], "description": "熟悉基础护理操作和护理记录规范，能够按流程完成患者照护。"},
                        {"name": "患者服务", "keywords": ["沟通", "健康宣教", "院感", "应急配合"], "description": "具备良好的患者沟通意识，能够配合医生完成诊疗和应急处理。"},
                    ],
                    "work": {"position": "护士", "description": "负责患者日常护理、医嘱执行、护理记录、健康宣教和病区协作。", "highlights": ["严格执行护理查对和院感要求，保障护理操作规范性和安全性。", "主动关注患者反馈并进行健康宣教，提升患者理解和配合度。"]},
                    "project": {"name": "病区护理流程规范化项目", "role": "参与成员", "tech_stack": "护理记录 / 查对制度 / 健康宣教", "description": "围绕病区护理记录、宣教材料和交接流程进行规范化整理。", "highlights": ["整理高频护理问题和宣教要点，提升新患者入院沟通效率。", "协助优化交接记录格式，减少信息遗漏和重复沟通。"]},
                },
            }
        ],
    },
    {
        "industry_id": "manufacturing",
        "industry_name": "制造 / 工程",
        "industry_description": "突出现场经验、流程改善、质量意识和成本效率。",
        "roles": [
            {
                "starter_id": "manufacturing-mechanical-engineer",
                "role_title": "机械工程师",
                "role_subtitle": "设备 / 工艺 / 结构",
                "keywords": ["机械设计", "设备维护", "工艺优化", "SolidWorks", "质量改善", "成本控制"],
                "focus": ["写清设备、工艺或结构场景", "体现改善结果", "突出图纸、测试和现场协作"],
                "content": {
                    "summary": "具备机械设计、设备问题分析和现场改善经验，能够结合生产需求推进结构优化和工艺改进。",
                    "skills": [
                        {"name": "机械设计", "keywords": ["SolidWorks", "AutoCAD", "结构设计", "图纸"], "description": "熟悉机械结构设计、图纸输出和基础材料工艺，能够配合生产完成方案落地。"},
                        {"name": "现场改善", "keywords": ["设备调试", "异常分析", "工艺优化", "质量改善"], "description": "具备现场问题排查和跨部门协作经验，关注效率、质量和成本。"},
                    ],
                    "work": {"position": "机械工程师", "description": "负责设备结构设计、图纸维护、现场问题分析和工艺改善支持。", "highlights": ["配合生产现场定位设备异常原因，提出结构或工艺调整方案并跟进验证。", "整理图纸和零部件清单，提升设计变更和供应协同效率。"]},
                    "project": {"name": "生产线设备改良项目", "role": "机械设计成员", "tech_stack": "SolidWorks / AutoCAD / 现场测试", "description": "针对生产线设备稳定性和维护效率问题进行结构优化。", "highlights": ["参与关键部件结构优化和样件验证，降低维护难度。", "跟进加工、装配和现场测试过程，确保改良方案可落地。"]},
                },
            }
        ],
    },
    {
        "industry_id": "sales",
        "industry_name": "销售 / 商务",
        "industry_description": "强调客户开发、成交转化、关系维护和业绩结果。",
        "roles": [
            {
                "starter_id": "sales-consultant",
                "role_title": "销售顾问",
                "role_subtitle": "ToB / ToC / 大客户",
                "keywords": ["客户开发", "销售转化", "需求挖掘", "商务谈判", "CRM", "客户维护"],
                "focus": ["尽量写成交额、转化率、客户数", "突出客户类型和销售周期", "体现跟进和谈判能力"],
                "content": {
                    "summary": "具备客户开发、需求沟通和成交推进经验，能够围绕客户目标提供方案并维护长期关系。",
                    "skills": [
                        {"name": "销售推进", "keywords": ["线索跟进", "需求挖掘", "方案讲解", "商务谈判"], "description": "能够从线索筛选、需求沟通到报价跟进推进完整销售流程。"},
                        {"name": "客户管理", "keywords": ["CRM", "复购", "客情维护", "数据复盘"], "description": "熟悉客户分层管理和跟进记录，重视长期信任和复购机会。"},
                    ],
                    "work": {"position": "销售顾问", "description": "负责潜在客户开发、需求沟通、方案介绍、合同推进和客户维护。", "highlights": ["通过电话、社群和转介绍拓展客户线索，建立稳定跟进节奏。", "根据客户痛点调整介绍重点，提高沟通效率和成交机会。"]},
                    "project": {"name": "重点客户成交转化项目", "role": "客户负责人", "tech_stack": "CRM / 客户画像 / 商务方案", "description": "针对高意向客户建立分层跟进策略和成交推进方案。", "highlights": ["梳理客户决策链和关注点，制定差异化沟通计划。", "沉淀常见异议处理话术，提高后续团队跟进效率。"]},
                },
            }
        ],
    },
    {
        "industry_id": "design-media",
        "industry_name": "设计 / 新媒体",
        "industry_description": "突出作品质量、审美一致性、内容策略和转化表现。",
        "roles": [
            {
                "starter_id": "design-media-ui-designer",
                "role_title": "UI 设计师",
                "role_subtitle": "产品界面 / 视觉规范",
                "keywords": ["Figma", "设计规范", "交互设计", "视觉体系", "原型", "用户体验"],
                "focus": ["一定要放作品集链接", "写清设计范围和落地结果", "体现规范意识和协作效率"],
                "content": {
                    "summary": "具备产品界面设计、视觉规范搭建和交互细节打磨经验，能够与产品和研发协作推动设计落地。",
                    "skills": [
                        {"name": "界面设计", "keywords": ["Figma", "Sketch", "原型", "视觉设计"], "description": "能够完成产品界面、组件状态和关键流程设计，关注一致性和可用性。"},
                        {"name": "设计协作", "keywords": ["设计规范", "交互说明", "切图标注", "走查"], "description": "熟悉与产品、研发协作流程，能够输出清晰交付物并跟进还原效果。"},
                    ],
                    "work": {"position": "UI 设计师", "description": "负责产品界面设计、视觉规范维护、交互细节优化和上线走查。", "highlights": ["建立核心组件和页面规范，提升多模块设计一致性和研发复用效率。", "基于用户反馈优化关键流程页面，改善信息层级和操作体验。"]},
                    "project": {"name": "产品设计系统搭建", "role": "视觉设计负责人", "tech_stack": "Figma / Design System / 原型交互", "description": "围绕产品多端页面建立组件、色彩、字体和状态规范。", "highlights": ["沉淀按钮、表单、弹窗和导航等基础组件，减少重复设计成本。", "与研发同步组件命名和交互状态，提高设计还原一致性。"]},
                },
            }
        ],
    },
    {
        "industry_id": "hr-admin",
        "industry_name": "人力 / 行政",
        "industry_description": "强调流程、沟通、组织支持、数据台账和服务体验。",
        "roles": [
            {
                "starter_id": "hr-admin-hr-specialist",
                "role_title": "人力资源专员",
                "role_subtitle": "招聘 / 员工关系 / 培训",
                "keywords": ["招聘", "面试邀约", "员工关系", "入离职", "培训组织", "HRIS"],
                "focus": ["写清招聘岗位和数量", "体现流程和沟通能力", "突出数据台账准确性"],
                "content": {
                    "summary": "具备招聘执行、员工服务和人事流程管理经验，能够支持组织用人需求和员工全周期管理。",
                    "skills": [
                        {"name": "招聘执行", "keywords": ["简历筛选", "面试邀约", "渠道维护", "候选人沟通"], "description": "熟悉招聘流程，能够根据岗位需求筛选候选人并维护面试体验。"},
                        {"name": "人事运营", "keywords": ["入离职", "员工档案", "考勤", "培训组织"], "description": "能够维护人事台账和流程材料，保障员工服务规范有序。"},
                    ],
                    "work": {"position": "人力资源专员", "description": "负责招聘执行、员工入离职、档案维护、培训组织和人事数据更新。", "highlights": ["维护招聘渠道和候选人沟通节奏，提升面试安排效率和候选人体验。", "梳理入离职材料和流程清单，减少跨部门沟通遗漏。"]},
                    "project": {"name": "招聘流程与候选人体验优化", "role": "执行负责人", "tech_stack": "招聘渠道 / 面试流程 / 数据台账", "description": "针对面试安排、候选人反馈和招聘数据记录进行流程优化。", "highlights": ["统一候选人状态记录和反馈模板，提升招聘数据可追踪性。", "优化面试邀约与提醒节点，降低临时取消和信息遗漏。"]},
                },
            }
        ],
    },
]


def _modules(*items: tuple[str, str]) -> list[dict[str, str]]:
    return [{"key": key, "title": title} for key, title in items]


STANDARD_MODULES = _modules(
    ("summary", "个人简介"),
    ("skills", "专业技能"),
    ("work", "工作经历"),
    ("projects", "项目经历"),
)

ROLE_MODULE_OVERRIDES: dict[str, list[dict[str, str]]] = {
    "internet-frontend-engineer": _modules(("summary", "个人简介"), ("skills", "专业技能"), ("projects", "项目经历"), ("work", "工作经历"), ("custom_open_source", "开源贡献"), ("custom_tech_blog", "技术博客")),
    "internet-product-manager": _modules(("summary", "个人简介"), ("skills", "产品能力"), ("work", "产品经历"), ("projects", "产品项目"), ("custom_case_studies", "案例展示")),
    "finance-financial-analyst": _modules(("summary", "个人简介"), ("skills", "分析能力"), ("work", "工作经历"), ("projects", "分析项目"), ("custom_certifications", "证书/认证")),
    "finance-risk-control": _modules(("summary", "个人简介"), ("skills", "风控能力"), ("work", "审核经历"), ("projects", "风控项目"), ("custom_certifications", "证书/认证")),
    "education-teacher": _modules(("summary", "个人简介"), ("skills", "教学能力"), ("work", "教学经历"), ("projects", "教研项目"), ("custom_certifications", "教师资格/证书")),
    "education-curriculum-ops": _modules(("summary", "个人简介"), ("skills", "运营能力"), ("work", "运营经历"), ("projects", "运营项目"), ("custom_case_studies", "运营案例")),
    "healthcare-nurse": _modules(("summary", "个人简介"), ("skills", "护理能力"), ("work", "护理经历"), ("custom_certifications", "资格证书"), ("education", "教育经历")),
    "manufacturing-mechanical-engineer": _modules(("summary", "个人简介"), ("skills", "工程技能"), ("work", "工程经历"), ("projects", "改善项目"), ("custom_certifications", "证书/资质")),
    "sales-consultant": _modules(("summary", "个人简介"), ("skills", "销售能力"), ("work", "销售经历"), ("projects", "客户项目"), ("custom_case_studies", "成交案例")),
    "design-media-ui-designer": _modules(("summary", "个人简介"), ("skills", "设计能力"), ("custom_portfolio", "作品集"), ("projects", "设计项目"), ("work", "工作经历")),
    "hr-admin-hr-specialist": _modules(("summary", "个人简介"), ("skills", "人力能力"), ("work", "人事实务"), ("projects", "流程项目"), ("custom_certifications", "证书/培训")),
}

INDUSTRY_MODULE_DEFAULTS: dict[str, list[dict[str, str]]] = {
    "internet": _modules(("summary", "个人简介"), ("skills", "专业技能"), ("projects", "项目经历"), ("work", "工作经历"), ("custom_open_source", "开源/作品")),
    "data-ai": _modules(("summary", "个人简介"), ("skills", "技术能力"), ("projects", "模型/数据项目"), ("work", "工作经历"), ("custom_publications", "论文/专利")),
    "finance": _modules(("summary", "个人简介"), ("skills", "专业能力"), ("work", "工作经历"), ("projects", "分析项目"), ("custom_certifications", "证书/认证")),
    "education": _modules(("summary", "个人简介"), ("skills", "教学/运营能力"), ("work", "相关经历"), ("projects", "教研/运营项目"), ("custom_certifications", "证书/培训")),
    "healthcare": _modules(("summary", "个人简介"), ("skills", "专业技能"), ("work", "临床/服务经历"), ("custom_certifications", "资格证书"), ("education", "教育经历")),
    "manufacturing": _modules(("summary", "个人简介"), ("skills", "工程技能"), ("work", "现场经历"), ("projects", "改善项目"), ("custom_certifications", "资质证书")),
    "sales": _modules(("summary", "个人简介"), ("skills", "商务能力"), ("work", "销售经历"), ("projects", "客户项目"), ("custom_case_studies", "成交案例")),
    "design-media": _modules(("summary", "个人简介"), ("skills", "专业能力"), ("custom_portfolio", "作品集"), ("projects", "项目/作品"), ("work", "工作经历")),
    "hr-admin": _modules(("summary", "个人简介"), ("skills", "专业能力"), ("work", "工作经历"), ("projects", "流程项目"), ("custom_certifications", "证书/培训")),
    "marketing": _modules(("summary", "个人简介"), ("skills", "营销能力"), ("work", "营销经历"), ("projects", "营销项目"), ("custom_case_studies", "营销案例")),
    "ecommerce-retail": _modules(("summary", "个人简介"), ("skills", "运营能力"), ("work", "运营/门店经历"), ("projects", "增长项目"), ("custom_case_studies", "运营案例")),
    "operations-service": _modules(("summary", "个人简介"), ("skills", "服务运营能力"), ("work", "运营/服务经历"), ("projects", "流程优化项目"), ("custom_case_studies", "服务案例")),
    "logistics-supply": _modules(("summary", "个人简介"), ("skills", "供应链能力"), ("work", "供应链经历"), ("projects", "降本增效项目"), ("custom_certifications", "资质证书")),
    "construction-realestate": _modules(("summary", "个人简介"), ("skills", "工程/置业能力"), ("work", "项目经历"), ("projects", "工程/客户项目"), ("custom_certifications", "证书/资质")),
    "legal-compliance": _modules(("summary", "个人简介"), ("skills", "法务合规能力"), ("work", "法务经历"), ("projects", "合规项目"), ("custom_certifications", "资格证书")),
    "energy-environment": _modules(("summary", "个人简介"), ("skills", "专业技能"), ("work", "现场经历"), ("projects", "环保/能源项目"), ("custom_certifications", "资质证书")),
    "hospitality-tourism": _modules(("summary", "个人简介"), ("skills", "服务能力"), ("work", "服务经历"), ("projects", "服务提升项目"), ("custom_languages", "语言能力")),
    "food-agriculture": _modules(("summary", "个人简介"), ("skills", "专业技能"), ("work", "生产/质检经历"), ("projects", "质量项目"), ("custom_certifications", "证书/资质")),
}

CUSTOM_SECTION_LIBRARY: dict[str, dict[str, Any]] = {
    "custom_certifications": {
        "preset_type": "certifications",
        "title": "证书/认证",
        "items": [{"name": "请填写与岗位相关的证书", "issuer": "", "date": "", "credential_id": "", "url": "", "description": "例如职业资格证、行业认证、专项培训证书或上岗资质。"}],
    },
    "custom_languages": {
        "preset_type": "languages",
        "title": "语言能力",
        "items": [{"name": "英语", "level": "请填写水平", "score": "", "description": "可补充口语沟通、书面表达、接待服务或跨境业务场景。"}],
    },
    "custom_training": {
        "preset_type": "training",
        "title": "培训经历",
        "items": [{"name": "请填写专项培训名称", "institution": "", "start_date": "", "end_date": "", "description": "可补充课程内容、训练成果和与目标岗位的关联。"}],
    },
    "custom_open_source": {
        "preset_type": "open_source",
        "title": "开源贡献",
        "items": [{"name": "请填写开源/个人项目", "role": "贡献者", "url": "", "tech_stack": "", "description": "可补充项目背景、本人贡献和代码/文档沉淀。", "highlights": ["梳理问题背景并提交可复用实现或文档。", "通过 Issue、PR 或示例项目体现持续学习和工程习惯。"]}],
    },
    "custom_tech_blog": {
        "preset_type": "tech_blog",
        "title": "技术博客",
        "items": [{"title": "请填写技术文章/专栏", "platform": "", "date": "", "url": "", "description": "可补充文章主题、技术深度、阅读反馈或团队分享场景。"}],
    },
    "custom_publications": {
        "preset_type": "publications",
        "title": "论文/专利",
        "items": [{"title": "请填写论文/专利/研究成果", "publisher": "", "date": "", "role": "", "url": "", "description": "可补充研究方向、本人贡献和成果应用场景。"}],
    },
    "custom_portfolio": {
        "preset_type": "portfolio",
        "title": "作品集",
        "items": [{"name": "请填写代表作品", "role": "负责人", "url": "", "tech_stack": "", "description": "可补充作品目标、设计/创作方法和最终呈现。", "highlights": ["展示信息层级、视觉一致性或内容策略。", "说明作品如何服务业务目标、用户体验或传播效果。"]}],
    },
    "custom_case_studies": {
        "preset_type": "case_studies",
        "title": "案例展示",
        "items": [{"name": "请填写代表案例", "role": "负责人", "url": "", "description": "可补充背景、目标、方案、执行过程和复盘结论。", "highlights": ["拆解问题并制定可执行方案。", "沉淀方法、话术、流程或数据复盘模板。"]}],
    },
}


def _compact_role(
    starter_id: str,
    title: str,
    subtitle: str,
    keywords: list[str],
    summary: str,
    modules: list[dict[str, str]] | None = None,
    focus: list[str] | None = None,
) -> dict[str, Any]:
    core = keywords[:4]
    return {
        "starter_id": starter_id,
        "role_title": title,
        "role_subtitle": subtitle,
        "keywords": keywords,
        "focus": focus or ["突出目标场景和负责范围", "用数据或事实说明结果", "体现流程沉淀和协作能力"],
        "content": {
            "modules": modules or [],
            "summary": summary,
            "skills": [
                {"name": "岗位核心能力", "keywords": core, "description": f"熟悉{title}常见工作场景，能够围绕目标拆解任务、推进执行并复盘结果。"},
                {"name": "业务理解", "keywords": keywords[4:8] or core, "description": "能够理解行业规则、用户或客户需求，并将业务目标转化为可执行动作。"},
                {"name": "协作与交付", "keywords": ["跨团队沟通", "进度管理", "问题跟进", "复盘沉淀"], "description": "能够与上下游角色保持清晰沟通，推动事项按优先级完成并沉淀可复用流程。"},
            ],
            "work": {
                "position": title,
                "description": f"负责{subtitle}相关工作，围绕业务目标完成日常执行、过程跟进、问题定位和结果复盘。",
                "highlights": [
                    f"梳理{title}关键流程和高频问题，形成检查清单或执行模板，提升日常处理效率。",
                    "与产品、运营、销售、交付或职能团队协作，推动需求、资源和时间节点对齐。",
                    "定期复盘核心指标或服务反馈，定位影响结果的关键因素并提出优化动作。",
                ],
            },
            "project": {
                "name": f"{title}专项提升项目",
                "role": "核心成员",
                "tech_stack": "流程梳理 / 数据复盘 / 协同推进",
                "description": f"围绕{title}工作中的效率、质量或转化问题进行专项优化。",
                "highlights": [
                    "明确项目目标、范围和衡量口径，拆解可落地的执行计划。",
                    "跟进关键节点和异常问题，推动相关方及时反馈并完成闭环。",
                    "沉淀复盘结论和可复用模板，为后续同类项目提供参考。",
                ],
            },
        },
    }


ADDITIONAL_STARTERS: list[dict[str, Any]] = [
    {
        "industry_id": "internet",
        "industry_name": "互联网 / 科技",
        "industry_description": "强调项目落地、技术栈、产品指标和跨团队协作。",
        "roles": [
            _compact_role("internet-backend-engineer", "后端开发工程师", "Java / Python / Go / 微服务", ["Java", "Spring Boot", "Python", "数据库设计", "接口设计", "性能优化", "微服务"], "具备后端服务开发、数据库建模和接口设计经验，能够围绕业务稳定性、性能和可维护性推进系统建设。", INDUSTRY_MODULE_DEFAULTS["internet"]),
            _compact_role("internet-test-engineer", "测试工程师", "功能 / 自动化 / 质量保障", ["测试用例", "接口测试", "自动化测试", "缺陷管理", "质量流程", "回归测试"], "具备测试分析、用例设计和缺陷跟进经验，能够从需求阶段介入并保障版本交付质量。", _modules(("summary", "个人简介"), ("skills", "测试能力"), ("work", "测试经历"), ("projects", "质量项目"), ("custom_certifications", "证书/培训"))),
            _compact_role("internet-devops-engineer", "运维开发工程师", "云服务 / CI/CD / 稳定性", ["Linux", "Docker", "Kubernetes", "CI/CD", "监控告警", "自动化运维"], "具备系统运维、自动化部署和稳定性保障经验，能够提升服务发布效率和故障响应能力。", _modules(("summary", "个人简介"), ("skills", "运维能力"), ("work", "运维经历"), ("projects", "稳定性项目"), ("custom_certifications", "证书/认证"))),
        ],
    },
    {
        "industry_id": "finance",
        "industry_name": "金融 / 财务",
        "industry_description": "强调严谨、合规、数据分析、风险意识和业务理解。",
        "roles": [
            _compact_role("finance-accountant", "会计", "总账 / 应收应付 / 税务", ["账务处理", "凭证审核", "纳税申报", "费用报销", "财务系统", "月结"], "熟悉会计核算、凭证处理和月度结账流程，具备严谨的数据意识和财务合规意识。", INDUSTRY_MODULE_DEFAULTS["finance"]),
            _compact_role("finance-audit-assistant", "审计助理", "财务审计 / 底稿 / 盘点", ["审计底稿", "函证", "盘点", "凭证抽查", "风险识别", "Excel"], "具备审计资料整理、底稿编制和现场协助经验，能够按审计程序完成核验与记录。", INDUSTRY_MODULE_DEFAULTS["finance"]),
        ],
    },
    {
        "industry_id": "education",
        "industry_name": "教育 / 培训",
        "industry_description": "突出课程设计、教学成果、学生反馈和组织沟通。",
        "roles": [
            _compact_role("education-teaching-assistant", "助教", "班课 / 作业 / 学员服务", ["作业批改", "学员答疑", "班级管理", "学习反馈", "课程支持", "家校沟通"], "具备学员服务、作业反馈和班级协助经验，能够支持主讲老师提升课程交付质量。", INDUSTRY_MODULE_DEFAULTS["education"]),
            _compact_role("education-consultant", "课程顾问", "试听 / 转化 / 续费", ["试听邀约", "需求沟通", "课程介绍", "转化跟进", "续费维护", "CRM"], "具备学员咨询、需求沟通和课程转化经验，能够围绕用户目标推荐合适课程方案。", _modules(("summary", "个人简介"), ("skills", "咨询转化能力"), ("work", "咨询经历"), ("projects", "转化项目"), ("custom_case_studies", "成交案例"))),
        ],
    },
    {
        "industry_id": "healthcare",
        "industry_name": "医疗 / 健康",
        "industry_description": "强调专业规范、服务意识、流程执行和风险防控。",
        "roles": [
            _compact_role("healthcare-pharmacist", "药剂师", "药房 / 审方 / 用药指导", ["处方审核", "药品调配", "用药指导", "药品管理", "GSP", "患者沟通"], "具备药品调配、处方审核和患者用药指导经验，重视药事服务规范和用药安全。", INDUSTRY_MODULE_DEFAULTS["healthcare"]),
            _compact_role("healthcare-medical-representative", "医药代表", "院线 / 学术 / 客户维护", ["客户拜访", "学术推广", "产品知识", "CRM", "渠道维护", "合规沟通"], "具备医药产品推广、客户维护和学术沟通经验，能够在合规前提下推进客户关系和市场覆盖。", _modules(("summary", "个人简介"), ("skills", "医药商务能力"), ("work", "推广经历"), ("projects", "客户项目"), ("custom_certifications", "证书/培训"))),
            _compact_role("healthcare-clinic-operations", "诊所运营", "门诊 / 服务 / 流程", ["预约管理", "患者服务", "门诊流程", "回访", "数据台账", "服务体验"], "具备门诊服务、预约管理和运营流程跟进经验，能够提升患者体验和现场服务效率。", _modules(("summary", "个人简介"), ("skills", "医疗运营能力"), ("work", "运营经历"), ("projects", "服务优化项目"), ("custom_case_studies", "服务案例"))),
        ],
    },
    {
        "industry_id": "manufacturing",
        "industry_name": "制造 / 工程",
        "industry_description": "突出现场经验、流程改善、质量意识和成本效率。",
        "roles": [
            _compact_role("manufacturing-quality-engineer", "质量工程师", "来料 / 制程 / 客诉", ["质量检验", "8D", "SPC", "来料检验", "制程改善", "客诉分析"], "具备质量检验、异常分析和制程改善经验，能够推动质量问题闭环和标准化管理。", INDUSTRY_MODULE_DEFAULTS["manufacturing"]),
            _compact_role("manufacturing-process-engineer", "工艺工程师", "工艺文件 / 产线改善", ["工艺优化", "SOP", "产线平衡", "良率提升", "设备调试", "现场改善"], "具备工艺文件编制、现场问题分析和产线优化经验，关注良率、效率和生产稳定性。", INDUSTRY_MODULE_DEFAULTS["manufacturing"]),
        ],
    },
    {
        "industry_id": "sales",
        "industry_name": "销售 / 商务",
        "industry_description": "强调客户开发、成交转化、关系维护和业绩结果。",
        "roles": [
            _compact_role("sales-account-manager", "客户经理", "KA / 企业客户 / 续约", ["客户维护", "需求挖掘", "续约", "商务谈判", "方案演示", "CRM"], "具备客户关系维护、需求沟通和商务推进经验，能够围绕客户价值推动续约和增购机会。", INDUSTRY_MODULE_DEFAULTS["sales"]),
            _compact_role("sales-bd-manager", "商务拓展", "渠道 / 合作 / 资源置换", ["渠道开发", "合作谈判", "资源整合", "BD", "合作方案", "项目推进"], "具备商务合作开发、资源整合和合作方案推进经验，能够建立外部合作并推动落地。", INDUSTRY_MODULE_DEFAULTS["sales"]),
        ],
    },
    {
        "industry_id": "design-media",
        "industry_name": "设计 / 新媒体",
        "industry_description": "突出作品质量、审美一致性、内容策略和转化表现。",
        "roles": [
            _compact_role("design-media-visual-designer", "视觉设计师", "品牌 / 活动 / 电商视觉", ["视觉设计", "品牌规范", "海报", "活动页", "电商物料", "Figma"], "具备品牌视觉、活动物料和页面设计经验，能够根据传播目标输出统一且可落地的视觉方案。", _modules(("summary", "个人简介"), ("skills", "视觉能力"), ("custom_portfolio", "作品集"), ("projects", "设计项目"), ("work", "工作经历"))),
            _compact_role("design-media-new-media-ops", "新媒体运营", "公众号 / 小红书 / 短视频", ["账号运营", "内容策划", "选题", "数据复盘", "社群互动", "短视频"], "具备新媒体账号运营、内容策划和数据复盘经验，能够围绕用户兴趣持续提升内容表现。", _modules(("summary", "个人简介"), ("skills", "内容运营能力"), ("custom_portfolio", "作品集"), ("projects", "内容项目"), ("custom_case_studies", "运营案例"))),
        ],
    },
    {
        "industry_id": "hr-admin",
        "industry_name": "人力 / 行政",
        "industry_description": "强调流程、沟通、组织支持、数据台账和服务体验。",
        "roles": [
            _compact_role("hr-admin-recruiter", "招聘专员", "社招 / 校招 / 猎聘", ["简历筛选", "面试邀约", "渠道维护", "候选人沟通", "招聘数据", "Offer 跟进"], "具备招聘执行、候选人沟通和渠道维护经验，能够支持业务部门用人需求和招聘数据管理。", INDUSTRY_MODULE_DEFAULTS["hr-admin"]),
            _compact_role("hr-admin-admin-specialist", "行政专员", "办公 / 资产 / 供应商", ["办公行政", "资产管理", "供应商沟通", "会议支持", "费用报销", "制度执行"], "具备行政事务、资产台账和供应商协同经验，能够保障办公秩序和组织支持效率。", INDUSTRY_MODULE_DEFAULTS["hr-admin"]),
        ],
    },
    {
        "industry_id": "data-ai",
        "industry_name": "数据 / AI",
        "industry_description": "强调数据处理、模型能力、业务指标和实验复盘。",
        "roles": [
            _compact_role("data-ai-data-analyst", "数据分析师", "BI / 增长 / 经营分析", ["SQL", "Python", "指标体系", "数据看板", "A/B 测试", "业务分析", "可视化"], "具备数据提取、指标拆解和业务分析能力，能够通过看板、专题分析和实验复盘支持业务决策。", INDUSTRY_MODULE_DEFAULTS["data-ai"]),
            _compact_role("data-ai-algorithm-engineer", "算法工程师", "机器学习 / 推荐 / NLP", ["Python", "机器学习", "特征工程", "模型评估", "深度学习", "NLP", "推荐系统"], "具备机器学习建模、特征处理和模型评估经验，能够结合业务场景推进算法方案验证与落地。", INDUSTRY_MODULE_DEFAULTS["data-ai"]),
            _compact_role("data-ai-ai-product-manager", "AI 产品经理", "大模型 / Agent / 数据产品", ["需求分析", "Prompt", "RAG", "模型评测", "产品规划", "数据闭环", "项目推进"], "理解大模型应用场景和产品化路径，能够拆解用户需求、设计 AI 工作流并推动研发落地。", _modules(("summary", "个人简介"), ("skills", "AI 产品能力"), ("work", "产品经历"), ("projects", "AI 项目"), ("custom_case_studies", "产品案例"))),
        ],
    },
    {
        "industry_id": "marketing",
        "industry_name": "市场 / 品牌",
        "industry_description": "强调用户洞察、内容传播、活动策划和转化结果。",
        "roles": [
            _compact_role("marketing-specialist", "市场专员", "活动 / 渠道 / 投放", ["活动策划", "渠道合作", "投放执行", "用户洞察", "数据复盘", "物料统筹"], "具备市场活动、渠道执行和数据复盘经验，能够围绕获客、曝光和转化目标推进市场动作。", INDUSTRY_MODULE_DEFAULTS["marketing"]),
            _compact_role("marketing-brand-planner", "品牌策划", "品牌定位 / 内容创意", ["品牌定位", "创意策划", "整合传播", "文案", "竞品分析", "内容策略"], "具备品牌策略、内容创意和传播规划能力，能够将业务卖点转化为清晰的品牌表达。", _modules(("summary", "个人简介"), ("skills", "策划能力"), ("custom_portfolio", "作品集"), ("projects", "品牌项目"), ("work", "工作经历"))),
            _compact_role("marketing-content-creator", "内容策划", "新媒体 / 短视频 / 社群", ["选题策划", "脚本撰写", "账号运营", "短视频", "数据复盘", "热点跟进"], "具备内容选题、脚本输出和账号运营经验，能够围绕用户兴趣和转化目标持续产出内容。", _modules(("summary", "个人简介"), ("skills", "内容能力"), ("custom_portfolio", "作品集"), ("projects", "内容项目"), ("custom_case_studies", "爆款案例"))),
        ],
    },
    {
        "industry_id": "ecommerce-retail",
        "industry_name": "电商 / 零售",
        "industry_description": "强调商品、流量、转化、履约和用户体验。",
        "roles": [
            _compact_role("ecommerce-operations", "电商运营", "平台 / 店铺 / 活动", ["店铺运营", "商品管理", "活动报名", "转化率", "流量分析", "客服协同"], "熟悉电商店铺日常运营、商品维护和活动节奏，能够通过数据复盘优化流量与转化。", INDUSTRY_MODULE_DEFAULTS["ecommerce-retail"]),
            _compact_role("ecommerce-live-ops", "直播运营", "主播 / 场控 / 货盘", ["直播排期", "货盘规划", "场控", "转化复盘", "脚本", "用户互动"], "具备直播间运营、货品排期和数据复盘经验，能够协同主播、投放和供应链提升成交表现。", INDUSTRY_MODULE_DEFAULTS["ecommerce-retail"]),
            _compact_role("retail-store-manager", "门店店长", "门店经营 / 团队管理", ["门店管理", "销售目标", "库存盘点", "人员排班", "陈列", "顾客服务"], "具备门店经营、团队管理和顾客服务经验，能够围绕销售目标、库存周转和服务体验推进门店运营。", INDUSTRY_MODULE_DEFAULTS["ecommerce-retail"]),
        ],
    },
    {
        "industry_id": "operations-service",
        "industry_name": "运营 / 客服",
        "industry_description": "强调用户分层、流程标准、服务质量和问题闭环。",
        "roles": [
            _compact_role("operations-user-ops", "用户运营", "增长 / 留存 / 活跃", ["用户分层", "生命周期", "活动运营", "留存", "数据分析", "触达策略"], "具备用户分层、触达策略和活动运营经验，能够围绕拉新、活跃、留存和转化推进运营动作。", INDUSTRY_MODULE_DEFAULTS["operations-service"]),
            _compact_role("operations-community-ops", "社群运营", "私域 / 会员 / 内容", ["社群维护", "内容日历", "用户互动", "转化话术", "活动策划", "复盘"], "具备社群运营、内容触达和用户维护经验，能够提升社群活跃、信任和转化。", INDUSTRY_MODULE_DEFAULTS["operations-service"]),
            _compact_role("service-customer-support", "客服主管", "售前 / 售后 / 质检", ["客服质检", "SOP", "投诉处理", "满意度", "团队培训", "工单系统"], "具备客服团队管理、服务流程优化和投诉闭环经验，能够提升响应效率和客户满意度。", INDUSTRY_MODULE_DEFAULTS["operations-service"]),
        ],
    },
    {
        "industry_id": "logistics-supply",
        "industry_name": "物流 / 供应链",
        "industry_description": "强调计划、采购、仓配、履约效率和成本控制。",
        "roles": [
            _compact_role("supply-chain-specialist", "供应链专员", "计划 / 交付 / 协同", ["需求计划", "库存周转", "供应商协同", "交付跟进", "异常处理", "数据报表"], "具备供应链计划、交付跟进和异常协调经验，能够平衡库存、成本和履约效率。", INDUSTRY_MODULE_DEFAULTS["logistics-supply"]),
            _compact_role("procurement-specialist", "采购专员", "供应商 / 成本 / 合同", ["供应商管理", "询比价", "采购订单", "合同跟进", "成本控制", "交期管理"], "熟悉采购流程、供应商沟通和订单跟进，能够围绕成本、质量和交期推进采购事项。", INDUSTRY_MODULE_DEFAULTS["logistics-supply"]),
            _compact_role("warehouse-logistics-supervisor", "仓储物流主管", "仓配 / 现场 / 盘点", ["仓库管理", "出入库", "盘点", "配送协调", "现场管理", "安全规范"], "具备仓储现场管理、出入库流程和配送协同经验，关注效率、准确率和安全规范。", INDUSTRY_MODULE_DEFAULTS["logistics-supply"]),
        ],
    },
    {
        "industry_id": "construction-realestate",
        "industry_name": "地产 / 建筑",
        "industry_description": "强调项目现场、客户转化、资料规范和跨方协同。",
        "roles": [
            _compact_role("construction-civil-engineer", "土建工程师", "施工 / 现场 / 质量", ["施工管理", "图纸会审", "质量验收", "进度跟进", "安全管理", "现场协调"], "具备施工现场协调、质量进度跟进和图纸问题处理经验，能够推动工程节点有序落地。", INDUSTRY_MODULE_DEFAULTS["construction-realestate"]),
            _compact_role("realestate-sales-consultant", "置业顾问", "客户接待 / 成交转化", ["客户接待", "需求挖掘", "案场销售", "带看", "谈判", "签约跟进"], "具备客户接待、需求沟通和成交推进经验，能够围绕客户关注点提供置业方案。", INDUSTRY_MODULE_DEFAULTS["construction-realestate"]),
            _compact_role("construction-document-controller", "工程资料员", "资料 / 报审 / 归档", ["资料归档", "报审流程", "台账管理", "工程签证", "合同资料", "规范标准"], "熟悉工程资料收集、报审、归档和台账维护，能够保障项目资料完整准确。", INDUSTRY_MODULE_DEFAULTS["construction-realestate"]),
        ],
    },
    {
        "industry_id": "legal-compliance",
        "industry_name": "法务 / 合规",
        "industry_description": "强调合同审查、风险识别、制度建设和证据意识。",
        "roles": [
            _compact_role("legal-specialist", "法务专员", "合同 / 诉讼 / 公司法务", ["合同审查", "法律检索", "风险提示", "诉讼协助", "制度建设", "证据整理"], "具备合同审查、法律检索和风险提示能力，能够支持业务合规开展并维护法律文档。", INDUSTRY_MODULE_DEFAULTS["legal-compliance"]),
            _compact_role("compliance-specialist", "合规专员", "内控 / 审查 / 制度", ["合规审查", "内控流程", "制度宣导", "风险排查", "整改跟进", "审计配合"], "具备合规审查、制度执行和整改跟进经验，能够推动风险点识别和流程规范化。", INDUSTRY_MODULE_DEFAULTS["legal-compliance"]),
            _compact_role("ip-specialist", "知识产权专员", "商标 / 专利 / 版权", ["专利检索", "商标流程", "版权登记", "案件跟进", "档案管理", "风险监测"], "熟悉知识产权申请、维护和流程跟进，能够支持企业创新成果保护和风险监测。", INDUSTRY_MODULE_DEFAULTS["legal-compliance"]),
        ],
    },
    {
        "industry_id": "energy-environment",
        "industry_name": "能源 / 环保",
        "industry_description": "强调现场安全、设备运行、环保合规和数据记录。",
        "roles": [
            _compact_role("energy-operations-engineer", "新能源运维工程师", "光伏 / 风电 / 储能", ["设备巡检", "故障排查", "安全规范", "数据监控", "预防性维护", "并网"], "具备新能源设备巡检、故障排查和运行数据记录经验，重视安全规范和发电效率。", INDUSTRY_MODULE_DEFAULTS["energy-environment"]),
            _compact_role("environmental-engineer", "环境工程师", "水处理 / 环评 / 监测", ["环境监测", "水处理", "环评资料", "达标排放", "现场采样", "报告编写"], "具备环保项目执行、数据监测和资料整理经验，能够围绕合规要求推进现场和报告工作。", INDUSTRY_MODULE_DEFAULTS["energy-environment"]),
            _compact_role("ehs-specialist", "EHS 专员", "安全 / 环境 / 健康", ["安全检查", "隐患整改", "培训宣导", "应急预案", "合规台账", "现场巡查"], "具备 EHS 检查、隐患整改和培训宣导经验，能够推动现场安全和合规管理。", INDUSTRY_MODULE_DEFAULTS["energy-environment"]),
        ],
    },
    {
        "industry_id": "hospitality-tourism",
        "industry_name": "酒店 / 旅游",
        "industry_description": "强调服务意识、现场应变、客户体验和多语言沟通。",
        "roles": [
            _compact_role("hotel-front-desk", "酒店前台", "接待 / 预订 / 客诉", ["前台接待", "预订系统", "客诉处理", "入住退房", "会员服务", "英语沟通"], "具备酒店前台接待、预订处理和客户沟通经验，重视服务体验和现场应变。", INDUSTRY_MODULE_DEFAULTS["hospitality-tourism"]),
            _compact_role("tourism-consultant", "旅游顾问", "线路 / 销售 / 定制", ["线路设计", "客户咨询", "签证资料", "行程报价", "成交跟进", "售后服务"], "具备旅游产品咨询、线路规划和客户跟进经验，能够根据需求设计合适方案。", INDUSTRY_MODULE_DEFAULTS["hospitality-tourism"]),
            _compact_role("event-coordinator", "会务执行", "活动 / 接待 / 现场", ["会务统筹", "供应商协调", "现场执行", "物料管理", "流程彩排", "应急处理"], "具备活动执行、现场统筹和供应商协同经验，能够保障活动流程顺畅落地。", INDUSTRY_MODULE_DEFAULTS["hospitality-tourism"]),
        ],
    },
    {
        "industry_id": "food-agriculture",
        "industry_name": "食品 / 农业",
        "industry_description": "强调生产规范、质量控制、检测记录和安全意识。",
        "roles": [
            _compact_role("food-quality-inspector", "食品质检员", "检验 / 记录 / 体系", ["抽样检验", "微生物检测", "HACCP", "质量记录", "不合格处理", "现场卫生"], "具备食品质量检验、记录维护和异常反馈经验，重视食品安全和流程规范。", INDUSTRY_MODULE_DEFAULTS["food-agriculture"]),
            _compact_role("agriculture-technician", "农业技术员", "种植 / 养殖 / 技术服务", ["田间管理", "病虫害防治", "技术指导", "数据记录", "农资使用", "产量提升"], "具备农业生产技术支持、现场记录和种养殖问题处理经验，能够服务生产管理和技术推广。", INDUSTRY_MODULE_DEFAULTS["food-agriculture"]),
            _compact_role("production-planner-food", "生产计划员", "排产 / 物料 / 协调", ["生产排程", "物料跟进", "产能协调", "订单交付", "库存管理", "异常处理"], "熟悉生产排程、物料协调和交付跟进，能够平衡订单需求、产能和库存。", INDUSTRY_MODULE_DEFAULTS["food-agriculture"]),
        ],
    },
]


def _extend_builtin_starters() -> None:
    existing = {item["industry_id"]: item for item in BUILTIN_STARTERS}
    for industry in ADDITIONAL_STARTERS:
        current = existing.get(industry["industry_id"])
        if not current:
            BUILTIN_STARTERS.append(industry)
            existing[industry["industry_id"]] = industry
            continue
        known_roles = {role["starter_id"] for role in current["roles"]}
        current["roles"].extend([role for role in industry["roles"] if role["starter_id"] not in known_roles])


_extend_builtin_starters()


def builtin_industry_options() -> list[dict[str, Any]]:
    options: list[dict[str, Any]] = []
    for index, industry in enumerate(BUILTIN_STARTERS, start=1):
        options.append(
            {
                "industry_id": industry["industry_id"],
                "industry_name": industry["industry_name"],
                "industry_description": industry.get("industry_description") or "",
                "role_count": len(industry.get("roles") or []),
                "sort_order": index,
                "recommended_template_id": INDUSTRY_DEFAULT_TEMPLATES.get(industry["industry_id"], "tech"),
            }
        )
    return options


def _sync_builtin_industry_template_configs(db: Session) -> list[ResumeStarterIndustryTemplate]:
    existing = db.scalars(select(ResumeStarterIndustryTemplate)).all()
    by_industry = {row.industry_id: row for row in existing}
    changed = False
    for item in builtin_industry_options():
        row = by_industry.get(item["industry_id"])
        if row:
            updates = {
                "industry_name": item["industry_name"],
                "industry_description": item["industry_description"],
                "sort_order": item["sort_order"],
            }
            for key, value in updates.items():
                if getattr(row, key) != value:
                    setattr(row, key, value)
                    changed = True
            continue
        row = ResumeStarterIndustryTemplate(
            industry_id=item["industry_id"],
            industry_name=item["industry_name"],
            industry_description=item["industry_description"],
            default_template_id=item["recommended_template_id"],
            note="系统推荐默认模板",
            sort_order=item["sort_order"],
            is_active=1,
        )
        db.add(row)
        by_industry[item["industry_id"]] = row
        changed = True
    if changed:
        db.commit()
    return db.scalars(select(ResumeStarterIndustryTemplate).order_by(ResumeStarterIndustryTemplate.sort_order.asc(), ResumeStarterIndustryTemplate.id.asc())).all()


def get_industry_template_config(db: Session, industry_id: str) -> ResumeStarterIndustryTemplate | None:
    _sync_builtin_industry_template_configs(db)
    return db.scalar(
        select(ResumeStarterIndustryTemplate).where(
            ResumeStarterIndustryTemplate.industry_id == industry_id,
            ResumeStarterIndustryTemplate.is_active == 1,
        )
    )


def industry_default_template_id(db: Session, industry_id: str) -> str:
    row = get_industry_template_config(db, industry_id)
    return (row.default_template_id if row and row.default_template_id else "tech") or "tech"


def list_industry_template_configs(db: Session, templates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = _sync_builtin_industry_template_configs(db)
    by_industry = {row.industry_id: row for row in rows}
    templates_by_id = {item["template_id"]: item for item in templates}
    result: list[dict[str, Any]] = []
    for item in builtin_industry_options():
        row = by_industry.get(item["industry_id"])
        active = bool(row and row.is_active)
        template_id = row.default_template_id if active and row else ""
        template = templates_by_id.get(template_id)
        result.append(
            {
                "id": row.id if row else None,
                "industry_id": item["industry_id"],
                "industry_name": item["industry_name"],
                "industry_description": item["industry_description"],
                "role_count": item["role_count"],
                "default_template_id": template_id,
                "template_name": template["name"] if template else "",
                "template_category": template["category"] if template else "",
                "recommended_template_id": item["recommended_template_id"],
                "is_active": active,
                "note": row.note if row else "",
                "sort_order": item["sort_order"],
                "update_time": row.update_time if row else None,
            }
        )
    return result


def save_industry_template_config(db: Session, industry_id: str, template_id: str, note: str = "") -> dict[str, Any]:
    option = next((item for item in builtin_industry_options() if item["industry_id"] == industry_id), None)
    if not option:
        raise AppException("行业不存在")
    row = db.scalar(select(ResumeStarterIndustryTemplate).where(ResumeStarterIndustryTemplate.industry_id == industry_id))
    if not row:
        row = ResumeStarterIndustryTemplate(
            industry_id=industry_id,
            industry_name=option["industry_name"],
            industry_description=option["industry_description"],
            sort_order=option["sort_order"],
        )
        db.add(row)
    row.industry_name = option["industry_name"]
    row.industry_description = option["industry_description"]
    row.default_template_id = template_id
    row.note = (note or "").strip()[:255]
    row.sort_order = option["sort_order"]
    row.is_active = 1
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "industry_id": row.industry_id,
        "industry_name": row.industry_name,
        "industry_description": row.industry_description,
        "role_count": option["role_count"],
        "default_template_id": row.default_template_id,
        "recommended_template_id": option["recommended_template_id"],
        "is_active": bool(row.is_active),
        "note": row.note,
        "sort_order": row.sort_order,
        "update_time": row.update_time,
    }


def delete_industry_template_config(db: Session, industry_id: str) -> None:
    row = db.scalar(select(ResumeStarterIndustryTemplate).where(ResumeStarterIndustryTemplate.industry_id == industry_id))
    if not row:
        return
    row.is_active = 0
    db.commit()


def _admin_starter_payload(row: ResumeStarter, templates_by_id: dict[str, dict[str, Any]]) -> dict[str, Any]:
    template_id = row.default_template_id or "tech"
    template = templates_by_id.get(template_id)
    return {
        "id": row.id,
        "starter_id": row.starter_id,
        "industry_id": row.industry_id,
        "industry_name": row.industry_name,
        "industry_description": row.industry_description or "",
        "role_title": row.role_title,
        "role_subtitle": row.role_subtitle or "",
        "default_template_id": template_id,
        "template_name": template["name"] if template else template_id,
        "template_category": template["category"] if template else "",
        "keywords": row.keywords or [],
        "focus": row.focus or [],
        "content": row.content or {},
        "sort_order": row.sort_order,
        "is_visible": bool(row.is_visible),
        "create_time": row.create_time,
        "update_time": row.update_time,
    }


def admin_resume_starter_industries(db: Session) -> list[dict[str, Any]]:
    _sync_builtin_resume_starters(db)
    rows = db.scalars(select(ResumeStarter).order_by(ResumeStarter.sort_order.asc(), ResumeStarter.id.asc())).all()
    by_id: dict[str, dict[str, Any]] = {}
    for item in builtin_industry_options():
        by_id[item["industry_id"]] = {
            "id": item["industry_id"],
            "name": item["industry_name"],
            "description": item["industry_description"],
        }
    for row in rows:
        if row.industry_id not in by_id:
            by_id[row.industry_id] = {
                "id": row.industry_id,
                "name": row.industry_name,
                "description": row.industry_description or "",
            }
    return list(by_id.values())


def list_admin_resume_starters(db: Session, templates: list[dict[str, Any]], keyword: str = "", industry_id: str = "") -> list[dict[str, Any]]:
    rows = [row for row in _sync_builtin_resume_starters(db) if row.is_visible]
    industry = (industry_id or "").strip()
    if industry:
        rows = [row for row in rows if row.industry_id == industry]
    text = (keyword or "").strip().lower()
    if text:
        rows = [
            row
            for row in rows
            if text in row.starter_id.lower()
            or text in row.industry_name.lower()
            or text in row.role_title.lower()
            or text in (row.role_subtitle or "").lower()
        ]
    templates_by_id = {item["template_id"]: item for item in templates}
    return [_admin_starter_payload(row, templates_by_id) for row in rows]


def _new_starter_id(db: Session) -> str:
    while True:
        starter_id = f"custom-{uuid4().hex[:12]}"
        if not db.scalar(select(ResumeStarter.id).where(ResumeStarter.starter_id == starter_id)):
            return starter_id


def _normalize_admin_starter_content(
    starter_id: str,
    industry_id: str,
    industry_name: str,
    role_title: str,
    keywords: list[str],
    content: Any,
) -> dict[str, Any]:
    value = deepcopy(content) if isinstance(content, dict) else {}
    if not isinstance(value.get("modules"), list) or not value["modules"]:
        value["modules"] = _modules_for_role(industry_id, starter_id, value)
    _ensure_skill_depth({"keywords": keywords}, value)
    _ensure_level_variants(
        {"role_title": role_title, "industry_name": industry_name, "keywords": keywords},
        value,
    )
    return value


def create_admin_resume_starter(db: Session, data: dict[str, Any], templates: list[dict[str, Any]]) -> dict[str, Any]:
    template_ids = {item["template_id"] for item in templates}
    template_id = data.get("default_template_id") or "tech"
    if template_id not in template_ids:
        raise AppException("模板不存在")
    starter_id = (data.get("starter_id") or "").strip() or _new_starter_id(db)
    if db.scalar(select(ResumeStarter.id).where(ResumeStarter.starter_id == starter_id)):
        raise AppException("岗位预设 ID 已存在")
    keywords = [str(item).strip() for item in (data.get("keywords") or []) if str(item).strip()]
    row = ResumeStarter(
        starter_id=starter_id,
        industry_id=(data.get("industry_id") or "custom").strip(),
        industry_name=(data.get("industry_name") or "自定义行业").strip(),
        industry_description=(data.get("industry_description") or "").strip(),
        role_title=(data.get("role_title") or "").strip(),
        role_subtitle=(data.get("role_subtitle") or "").strip(),
        default_template_id=template_id,
        keywords=keywords,
        focus=[str(item).strip() for item in (data.get("focus") or []) if str(item).strip()],
        content=_normalize_admin_starter_content(
            starter_id,
            (data.get("industry_id") or "custom").strip(),
            (data.get("industry_name") or "自定义行业").strip(),
            (data.get("role_title") or "").strip(),
            keywords,
            data.get("content") or {},
        ),
        sort_order=int(data.get("sort_order") or 1000),
        is_visible=1 if data.get("is_visible", True) else 0,
    )
    if not row.role_title:
        raise AppException("岗位名称不能为空")
    db.add(row)
    db.commit()
    db.refresh(row)
    return _admin_starter_payload(row, {item["template_id"]: item for item in templates})


def update_admin_resume_starter(db: Session, starter_id: str, data: dict[str, Any], templates: list[dict[str, Any]]) -> dict[str, Any]:
    template_ids = {item["template_id"] for item in templates}
    template_id = data.get("default_template_id") or "tech"
    if template_id not in template_ids:
        raise AppException("模板不存在")
    row = db.scalar(select(ResumeStarter).where(ResumeStarter.starter_id == starter_id))
    if not row:
        raise AppException("岗位预设不存在")
    keywords = [str(item).strip() for item in (data.get("keywords") or []) if str(item).strip()]
    row.industry_id = (data.get("industry_id") or "custom").strip()
    row.industry_name = (data.get("industry_name") or "自定义行业").strip()
    row.industry_description = (data.get("industry_description") or "").strip()
    row.role_title = (data.get("role_title") or "").strip()
    row.role_subtitle = (data.get("role_subtitle") or "").strip()
    row.default_template_id = template_id
    row.keywords = keywords
    row.focus = [str(item).strip() for item in (data.get("focus") or []) if str(item).strip()]
    row.content = _normalize_admin_starter_content(
        row.starter_id,
        row.industry_id,
        row.industry_name,
        row.role_title,
        row.keywords,
        data.get("content") or {},
    )
    row.sort_order = int(data.get("sort_order") or row.sort_order or 1000)
    row.is_visible = 1 if data.get("is_visible", True) else 0
    if not row.role_title:
        raise AppException("岗位名称不能为空")
    db.commit()
    db.refresh(row)
    return _admin_starter_payload(row, {item["template_id"]: item for item in templates})


def delete_admin_resume_starter(db: Session, starter_id: str) -> None:
    row = db.scalar(select(ResumeStarter).where(ResumeStarter.starter_id == starter_id))
    if not row:
        return
    row.is_visible = 0
    db.commit()


def _modules_for_role(industry_id: str, starter_id: str, content: dict[str, Any]) -> list[dict[str, str]]:
    modules = content.get("modules")
    if isinstance(modules, list) and modules:
        return [item for item in modules if isinstance(item, dict) and item.get("key") and item.get("title")]
    return ROLE_MODULE_OVERRIDES.get(starter_id) or INDUSTRY_MODULE_DEFAULTS.get(industry_id) or STANDARD_MODULES


def _ensure_skill_depth(role: dict[str, Any], content: dict[str, Any]) -> None:
    skills = content.get("skills") if isinstance(content.get("skills"), list) else []
    keywords = role.get("keywords") or []
    fallback = [
        {"name": "岗位核心能力", "keywords": keywords[:4], "description": "能够围绕岗位目标拆解任务、推进执行，并通过复盘持续优化结果。"},
        {"name": "业务理解与判断", "keywords": keywords[4:8] or keywords[:4], "description": "理解行业规则、用户或客户需求，能够在效率、质量和风险之间做出稳妥判断。"},
        {"name": "数据与复盘", "keywords": ["数据记录", "指标跟踪", "问题定位", "复盘优化"], "description": "能够记录关键过程和结果数据，定位影响目标的主要因素并提出改进动作。"},
        {"name": "协作与交付", "keywords": ["跨团队沟通", "进度管理", "流程沉淀", "风险反馈"], "description": "能够与上下游保持清晰沟通，推动事项闭环并沉淀可复用模板或 SOP。"},
    ]
    merged = [item for item in skills if isinstance(item, dict)]
    for item in fallback:
        if len(merged) >= 4:
            break
        if not any(existing.get("name") == item["name"] for existing in merged):
            merged.append(item)
    content["skills"] = merged


def _ensure_content_defaults(industry: dict[str, Any], role: dict[str, Any]) -> dict[str, Any]:
    normalized = deepcopy(role)
    content = normalized.setdefault("content", {})
    content["modules"] = _modules_for_role(industry["industry_id"], normalized["starter_id"], content)
    _ensure_skill_depth(normalized, content)
    _ensure_level_variants({**normalized, "industry_name": industry["industry_name"]}, content)
    return normalized


def _level(level_id: str) -> dict[str, str]:
    return next((item for item in STARTER_LEVELS if item["id"] == level_id), STARTER_LEVELS[1])


def _starter_value(source: Any, key: str, default: Any = "") -> Any:
    if isinstance(source, dict):
        return source.get(key) or default
    return getattr(source, key, default) or default


def _starter_keywords(source: Any) -> list[str]:
    keywords = _starter_value(source, "keywords", [])
    return [str(item).strip() for item in keywords if str(item).strip()] if isinstance(keywords, list) else []


def _default_level_variant(source: Any, level: dict[str, str]) -> dict[str, Any]:
    role_title = str(_starter_value(source, "role_title", "目标岗位"))
    industry_name = str(_starter_value(source, "industry_name", "目标行业"))
    keywords = "、".join(_starter_keywords(source)[:3]) or role_title
    if level["id"] == "fresh":
        return {
            "summary": f"具备{role_title}岗位所需的基础认知和实践训练，熟悉{keywords}等方向，可从资料整理、执行跟进、项目协作和复盘优化切入。",
            "work_title": "实习/实践经历",
            "projects_title": "校园/实践项目",
            "education_description": "建议补充与目标岗位相关的主修课程、课程项目、竞赛经历、社团职责、实训作品或证书。",
            "work_description": f"围绕{industry_name}基础场景参与实习、校园实践或助理型工作，重点积累岗位流程、协作方式和可复用方法。",
            "project_description": f"围绕{role_title}岗位能力进行课程、实训或个人实践项目，重点展示学习能力、执行过程和成果表达。",
            "work_highlights": [
                f"参与{industry_name}相关基础工作，完成资料整理、流程记录、执行跟进或用户/业务反馈收集。",
                "在指导下理解岗位流程和协作方式，沉淀表格、清单或复盘记录，提升后续执行效率。",
            ],
            "project_highlights": [
                f"围绕{keywords}完成资料查阅、需求理解、方案执行和成果整理，形成可展示的实践产出。",
                "在老师、导师或团队成员指导下承担明确模块，按计划推进任务并及时同步进展。",
            ],
        }
    if level["id"] == "junior":
        return {
            "summary_suffix": "能够独立完成明确任务，关注执行质量、沟通反馈和阶段性结果。",
            "work_title": "工作经历",
            "projects_title": "项目经历",
            "work_description": f"围绕{industry_name}实际业务场景承担{role_title}相关执行工作，关注任务交付、沟通反馈和质量稳定。",
            "project_description": f"围绕真实业务问题完成{role_title}相关项目任务，覆盖需求理解、方案执行、结果验证和复盘优化。",
            "work_highlights": [
                f"独立承担{role_title}相关明确任务，按节点完成交付并及时反馈风险和进展。",
                "结合业务反馈或过程数据优化执行细节，提升效率、质量或协作体验。",
            ],
        }
    if level["id"] == "mid":
        return {
            "summary_suffix": "能够负责完整模块或项目事项，兼顾方案拆解、跨团队协作、过程把控和结果复盘。",
            "work_title": "工作经历",
            "projects_title": "项目经历",
            "work_description": f"负责{role_title}相关模块或专项事项，覆盖目标拆解、过程推进、跨团队协作和结果复盘。",
            "project_description": f"负责{role_title}相关专项项目，连接业务目标、协作资源和落地动作，推动项目按阶段达成结果。",
            "work_highlights": [
                f"负责{role_title}相关模块或专项事项，拆解目标、协调上下游并推进结果落地。",
                "围绕关键指标复盘执行过程，沉淀方法、流程或模板，提升团队复用效率。",
            ],
        }
    return {
        "summary_suffix": "擅长拆解复杂目标、搭建流程机制、协调关键资源并带动团队持续优化。",
        "work_title": "核心工作经历",
        "projects_title": "重点项目",
        "work_description": f"负责{role_title}相关核心方向或复杂项目，推动流程机制建设、关键问题解决和团队协同提效。",
        "project_description": f"主导{role_title}相关核心项目或体系建设，统筹目标拆解、资源协调、风险控制和机制沉淀。",
        "work_highlights": [
            f"主导{role_title}相关复杂项目或核心模块，明确目标、资源、节奏和验收标准。",
            "搭建协作机制、质量标准或复盘体系，推动团队在效率、稳定性或业务结果上持续改善。",
        ],
    }


def _ensure_level_variants(source: Any, content: dict[str, Any]) -> bool:
    variants = content.get("level_variants")
    if not isinstance(variants, dict):
        variants = {}
        content["level_variants"] = variants
    changed = False
    for level in STARTER_LEVELS:
        current = variants.get(level["id"])
        if not isinstance(current, dict) or not current:
            variants[level["id"]] = _default_level_variant(source, level)
            changed = True
    return changed


def _sync_builtin_resume_starters(db: Session) -> list[ResumeStarter]:
    existing = db.scalars(select(ResumeStarter)).all()
    by_starter_id = {row.starter_id: row for row in existing}
    changed = False
    sort_order = 1
    for industry in BUILTIN_STARTERS:
        for role in industry["roles"]:
            role = _ensure_content_defaults(industry, role)
            row = by_starter_id.get(role["starter_id"])
            if row:
                if not getattr(row, "default_template_id", ""):
                    row.default_template_id = role.get("default_template_id") or INDUSTRY_DEFAULT_TEMPLATES.get(industry["industry_id"], "tech")
                    changed = True
                content = deepcopy(row.content or {})
                if _ensure_level_variants(row, content):
                    row.content = content
                    changed = True
                sort_order += 1
                continue
            row = ResumeStarter(
                starter_id=role["starter_id"],
                industry_id=industry["industry_id"],
                industry_name=industry["industry_name"],
                industry_description=industry["industry_description"],
                role_title=role["role_title"],
                role_subtitle=role.get("role_subtitle") or "",
                default_template_id=role.get("default_template_id") or INDUSTRY_DEFAULT_TEMPLATES.get(industry["industry_id"], "tech"),
                keywords=role.get("keywords") or [],
                focus=role.get("focus") or [],
                content=role.get("content") or {},
                sort_order=sort_order,
                is_visible=1,
            )
            db.add(row)
            changed = True
            sort_order += 1
    if changed:
        db.commit()
    return db.scalars(select(ResumeStarter).order_by(ResumeStarter.sort_order.asc(), ResumeStarter.id.asc())).all()


def _starter_to_role(row: ResumeStarter) -> dict[str, Any]:
    return {
        "starter_id": row.starter_id,
        "title": row.role_title,
        "subtitle": row.role_subtitle or "",
        "default_template_id": row.default_template_id or "tech",
        "keywords": row.keywords or [],
        "focus": row.focus or [],
        "content": row.content or {},
    }


def list_resume_starters(db: Session, industry_id: str = "") -> dict[str, Any]:
    rows = [row for row in _sync_builtin_resume_starters(db) if row.is_visible]
    industries: list[dict[str, Any]] = []
    by_industry: dict[str, dict[str, Any]] = {}
    for row in rows:
        industry = by_industry.get(row.industry_id)
        if not industry:
            industry = {
                "id": row.industry_id,
                "name": row.industry_name,
                "description": row.industry_description or "",
                "roles": [],
            }
            by_industry[row.industry_id] = industry
            industries.append(industry)
        if industry_id and row.industry_id == industry_id:
            industry["roles"].append(_starter_to_role(row))
    return {"levels": STARTER_LEVELS, "industries": industries}


def _get_starter(db: Session, starter_id: str) -> ResumeStarter:
    _sync_builtin_resume_starters(db)
    row = db.scalar(select(ResumeStarter).where(ResumeStarter.starter_id == starter_id, ResumeStarter.is_visible == 1))
    if not row:
        raise AppException("岗位起稿内容不存在")
    return row


BUILT_IN_SECTION_KEYS = ["summary", "education", "skills", "work", "projects", "awards"]
BUILT_IN_SECTION_TITLES = {
    "basics": "基本信息",
    "summary": "个人简介",
    "education": "教育经历",
    "skills": "专业技能",
    "work": "工作经历",
    "projects": "项目经历",
    "awards": "荣誉奖项",
}


def _module_list(row: ResumeStarter, content: dict[str, Any]) -> list[dict[str, str]]:
    return _modules_for_role(row.industry_id, row.starter_id, content)


def _unique_section_order(modules: list[dict[str, str]]) -> list[str]:
    order = ["basics"]
    for item in modules:
        key = str(item.get("key") or "").strip()
        if key and key not in order:
            order.append(key)
    return order


def _with_ids(items: list[dict[str, Any]], prefix: str) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for index, item in enumerate(items, start=1):
        next_item = deepcopy(item)
        next_item["id"] = next_item.get("id") or f"{prefix}_{index}"
        result.append(next_item)
    return result


def _keyword_text(row: ResumeStarter, limit: int = 3) -> str:
    keywords = _starter_keywords(row)
    return "、".join(keywords[:limit]) if keywords else row.role_title


def _level_variant(content: dict[str, Any], row: ResumeStarter, level: dict[str, str]) -> dict[str, Any]:
    variants = content.get("level_variants") if isinstance(content.get("level_variants"), dict) else {}
    variant = variants.get(level["id"]) if isinstance(variants.get(level["id"]), dict) else {}
    return {**_default_level_variant(row, level), **variant}


def _level_summary(content: dict[str, Any], row: ResumeStarter, level: dict[str, str], variant: dict[str, Any]) -> str:
    base = str(content.get("summary") or "").strip()
    summary = str(variant.get("summary") or "").strip()
    if summary:
        return summary
    suffix = str(variant.get("summary_suffix") or "").strip()
    return f"{base} {suffix}".strip()


def _level_highlight_seeds(row: ResumeStarter, level: dict[str, str], section: str, variant: dict[str, Any]) -> list[str]:
    key = "project_highlights" if section == "project" else "work_highlights"
    values = variant.get(key)
    return [str(item).strip() for item in values if str(item).strip()] if isinstance(values, list) else []


def _ensure_highlights(items: list[str], row: ResumeStarter, level: dict[str, str], variant: dict[str, Any], section: str = "work") -> list[str]:
    highlights = _level_highlight_seeds(row, level, section, variant)
    highlights.extend(str(item) for item in items if item)
    fallbacks = [
        f"梳理{row.role_title}相关流程和高频问题，沉淀执行清单、话术模板或检查标准。",
        "与上下游团队保持清晰协作，推动需求确认、资源协调、异常反馈和结果闭环。",
        "通过数据记录、案例复盘或用户反馈定位改进点，持续提升效率、质量或转化表现。",
        "可将 XX 替换为真实数据，例如效率提升、成本下降、转化改善、满意度提升或错误率下降。",
    ]
    if level["id"] == "senior":
        fallbacks.append("搭建团队协作机制或新人带教方法，提升团队交付质量和问题响应速度。")
    for item in fallbacks:
        if len(highlights) >= 4:
            break
        if item not in highlights:
            highlights.append(item)
    result: list[str] = []
    for item in highlights:
        if item not in result:
            result.append(item)
        if len(result) >= 5:
            break
    return result


def _level_work_description(row: ResumeStarter, level: dict[str, str], variant: dict[str, Any]) -> str:
    return str(variant.get("work_description") or _default_level_variant(row, level).get("work_description") or "")


def _level_project_description(row: ResumeStarter, level: dict[str, str], variant: dict[str, Any]) -> str:
    return str(variant.get("project_description") or _default_level_variant(row, level).get("project_description") or "")


def _compose_level_description(raw: Any, level_description: str, level: dict[str, str]) -> str:
    text = str(raw or "").strip()
    if level["id"] in ("mid", "senior"):
        return f"{level_description} {text}".strip()
    return text or level_description


def _work_entries(content: dict[str, Any], row: ResumeStarter, level: dict[str, str], variant: dict[str, Any]) -> list[dict[str, Any]]:
    is_fresh = level["id"] == "fresh"
    if is_fresh:
        entries: list[dict[str, Any]] = [
            {
                "company": "请填写实习/校园实践组织",
                "position": f"{row.role_title}实习生",
                "description": _level_work_description(row, level, variant),
                "highlights": [],
            },
            {
                "company": "请填写校园项目/社团/实验室",
                "position": f"{row.role_title}相关实践",
                "description": f"结合课程、竞赛、社团或个人项目完成{row.role_title}相关实践，重点展示学习能力、执行意识和复盘能力。",
                "highlights": [
                    "拆解任务要求并按阶段推进，主动记录问题、反馈和改进动作。",
                    "整理项目资料、过程数据或展示文档，形成可用于面试沟通的作品或案例。",
                ],
            },
        ]
    else:
        samples = content.get("work_samples") if isinstance(content.get("work_samples"), list) else []
        entries = [item for item in samples if isinstance(item, dict)]
        work = content.get("work") if isinstance(content.get("work"), dict) else {}
        if work:
            entries.insert(0, work)
    if len(entries) < 2:
        entries.append({
            "company": "请填写公司名称",
            "position": row.role_title,
            "description": _level_work_description(row, level, variant),
            "highlights": [],
        })
    result: list[dict[str, Any]] = []
    for index, item in enumerate(entries[:2], start=1):
        result.append({
            "id": f"work_{index}",
            "company": item.get("company") or ("请填写实习/校园实践组织" if is_fresh else "请填写公司名称"),
            "position": f"{row.role_title}实习生" if is_fresh and index == 1 else (item.get("position") or row.role_title),
            "start_date": item.get("start_date") or "",
            "end_date": item.get("end_date") or "",
            "description": _compose_level_description(item.get("description"), _level_work_description(row, level, variant), level),
            "highlights": _ensure_highlights(list(item.get("highlights") or []), row, level, variant, "work"),
        })
    return result


def _project_entries(content: dict[str, Any], row: ResumeStarter, level: dict[str, str], variant: dict[str, Any]) -> list[dict[str, Any]]:
    is_fresh = level["id"] == "fresh"
    if is_fresh:
        entries: list[dict[str, Any]] = [
            {
                "name": f"{row.role_title}课程/实践项目",
                "role": "项目成员",
                "tech_stack": _keyword_text(row, 4),
                "description": _level_project_description(row, level, variant),
                "highlights": [],
            },
            {
                "name": f"{row.industry_name}场景分析与改进练习",
                "role": "项目成员",
                "tech_stack": "资料调研 / 流程梳理 / 复盘总结",
                "description": f"选择{row.industry_name}真实或模拟场景，完成问题分析、方案执行和成果总结。",
                "highlights": [
                    "通过资料调研、用户/业务观察或案例拆解理解场景问题，形成清晰的分析结论。",
                    "输出项目文档、展示材料或复盘记录，说明个人承担内容和改进思路。",
                ],
            },
        ]
    else:
        samples = content.get("project_samples") if isinstance(content.get("project_samples"), list) else []
        entries = [item for item in samples if isinstance(item, dict)]
        project = content.get("project") if isinstance(content.get("project"), dict) else {}
        if project:
            entries.insert(0, project)
    if len(entries) < 2:
        entries.append({
            "name": f"{row.role_title}能力提升项目",
            "role": "项目负责人" if level["id"] in ("mid", "senior") else "项目成员",
            "tech_stack": "流程梳理 / 数据复盘 / 协同推进",
            "description": _level_project_description(row, level, variant),
            "highlights": [],
        })
    result: list[dict[str, Any]] = []
    for index, item in enumerate(entries[:2], start=1):
        result.append({
            "id": f"project_{index}",
            "name": item.get("name") or "请填写项目名称",
            "role": "项目成员" if is_fresh else (item.get("role") or ("项目负责人" if level["id"] in ("mid", "senior") else "项目成员")),
            "start_date": item.get("start_date") or "",
            "end_date": item.get("end_date") or "",
            "tech_stack": item.get("tech_stack") or "",
            "description": _compose_level_description(item.get("description"), _level_project_description(row, level, variant), level),
            "highlights": _ensure_highlights(list(item.get("highlights") or []), row, level, variant, "project"),
        })
    return result


def _custom_sections(modules: list[dict[str, str]], content: dict[str, Any]) -> list[dict[str, Any]]:
    provided = content.get("custom_sections") if isinstance(content.get("custom_sections"), list) else []
    provided_by_id = {item.get("id"): item for item in provided if isinstance(item, dict) and item.get("id")}
    sections: list[dict[str, Any]] = []
    for module in modules:
        key = str(module.get("key") or "")
        if not key.startswith("custom_"):
            continue
        template = provided_by_id.get(key) or CUSTOM_SECTION_LIBRARY.get(key)
        if not template:
            continue
        section = deepcopy(template)
        section["id"] = key
        section["title"] = module.get("title") or section.get("title") or "自定义模块"
        section["items"] = _with_ids([item for item in section.get("items", []) if isinstance(item, dict)], f"{key}_item")
        sections.append(section)
    return sections


def build_resume_data_from_starter(row: ResumeStarter, level_id: str) -> dict[str, Any]:
    level = _level(level_id)
    content = deepcopy(row.content or {})
    modules = _module_list(row, content)
    section_order = _unique_section_order(modules)
    custom_sections = _custom_sections(modules, content)
    is_fresh = level["id"] == "fresh"
    variant = _level_variant(content, row, level)
    summary = _level_summary(content, row, level, variant)
    skills = content.get("skills") if isinstance(content.get("skills"), list) else []
    section_titles = {
        **BUILT_IN_SECTION_TITLES,
        "work": str(variant.get("work_title") or ("实习/实践经历" if is_fresh else "工作经历")),
        "projects": str(variant.get("projects_title") or ("校园/实践项目" if is_fresh else ("重点项目" if level["id"] == "senior" else "项目经历"))),
    }
    for module in modules:
        key = str(module.get("key") or "")
        if key:
            section_titles[key] = str(module.get("title") or section_titles.get(key) or key)
    if is_fresh:
        section_titles["work"] = str(variant.get("work_title") or "实习/实践经历")
        section_titles["projects"] = str(variant.get("projects_title") or "校园/实践项目")
    elif level["id"] == "senior":
        section_titles["work"] = str(variant.get("work_title") or "核心工作经历")
        section_titles["projects"] = str(variant.get("projects_title") or "重点项目")

    return {
        "basics": {
            "name": "",
            "title": row.role_title,
            "status": level["status"],
            "phone": "",
            "email": "",
            "location": "",
            "expected_salary": "面议",
            "highest_degree": "",
            "website": "",
            "github": "",
            "avatar": "",
            "custom_fields": [
                {"id": "field_industry", "label": "目标行业", "value": row.industry_name, "icon": "Briefcase", "row": 1, "order": 9}
            ],
            "field_config": _starter_field_config(),
        },
        "summary": {"content": summary},
        "education": [
            {
                "id": "edu_1",
                "school": "请填写学校名称",
                "major": "请填写专业",
                "degree": "请填写学历",
                "start_date": "",
                "end_date": "",
                "description": str(variant.get("education_description") or ("建议补充与目标岗位相关的主修课程、课程项目、竞赛经历、社团职责、实训作品或证书。" if is_fresh else "可补充与目标岗位相关的学历背景、培训经历、专业认证或在职学习成果。")),
            }
        ],
        "skills": [
            {
                "id": f"skill_{index + 1}",
                "name": item.get("name") or "专业技能",
                "keywords": item.get("keywords") or [],
                "description": item.get("description") or "",
            }
            for index, item in enumerate(skills)
            if isinstance(item, dict)
        ],
        "work": [
            *(_work_entries(content, row, level, variant) if "work" in section_order else [])
        ],
        "projects": [
            *(_project_entries(content, row, level, variant) if "projects" in section_order else [])
        ],
        "awards": [
            {
                "id": "award_1",
                "name": "请填写与目标岗位相关的奖项/荣誉",
                "date": "",
                "description": "可补充竞赛、评优、项目表彰、客户认可或团队荣誉。",
            }
        ] if "awards" in section_order else [],
        "custom_sections": custom_sections,
        "layout": {
            "section_order": section_order,
            "hidden_sections": [key for key in BUILT_IN_SECTION_KEYS if key not in section_order],
            "skills_options": {"show_keywords": True, "description_inline": False},
            "section_titles": section_titles,
        },
    }


def starter_resume_title(row: ResumeStarter, level_id: str) -> str:
    level = _level(level_id)
    return f"{row.role_title}简历 · {level['short_label']}"


def create_resume_from_starter(db: Session, user_id: int, starter_id: str, level_id: str, template_id: str) -> Resume:
    row = _get_starter(db, starter_id)
    starter_template = row.default_template_id or industry_default_template_id(db, row.industry_id)
    template = starter_template if template_id in ("", "__industry_default", "industry_default", None) else (template_id or starter_template or "tech")
    return create_resume(
        db,
        user_id,
        ResumeCreate(
            title=starter_resume_title(row, level_id),
            template_id=template,
            resume_data=build_resume_data_from_starter(row, level_id),
            template_config=default_template_config(template),
        ),
    )
