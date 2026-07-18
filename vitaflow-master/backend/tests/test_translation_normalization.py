import unittest

from app.services.ai.chains import _normalize_translation_payload


class TranslationNormalizationTest(unittest.TestCase):
    def test_unwraps_nested_resume_data_without_changing_structure(self) -> None:
        source = {
            "basics": {
                "name": "张三",
                "title": "后端工程师",
                "custom_fields": [],
                "field_config": {},
            },
            "summary": {"content": "<p>负责后端开发。</p>"},
            "education": [],
            "skills": [],
            "work": [],
            "projects": [
                {
                    "id": "project_1",
                    "name": "简历平台",
                    "role": "开发工程师",
                    "start_date": "",
                    "end_date": "",
                    "tech_stack": ["FastAPI"],
                    "description": "<p>负责平台开发。</p>",
                    "highlights": [],
                }
            ],
            "awards": [],
            "custom_sections": [],
            "layout": {
                "section_order": [
                    "basics",
                    "summary",
                    "education",
                    "skills",
                    "work",
                    "projects",
                    "awards",
                ],
                "hidden_sections": [],
                "section_titles": {
                    "basics": "基本信息",
                    "summary": "个人简介",
                    "projects": "项目经历",
                },
                "field_labels": {},
                "skills_options": {},
            },
        }
        translated = {
            **source,
            "basics": {**source["basics"], "title": "Backend Engineer"},
            "summary": {"content": "<p>Responsible for backend development.</p>"},
            "projects": [
                {
                    **source["projects"][0],
                    "name": "Resume Platform",
                    "role": "Software Engineer",
                    "description": "<p>Responsible for platform development.</p>",
                }
            ],
            "layout": {
                **source["layout"],
                "section_titles": {
                    "basics": "Basic Information",
                    "summary": "Summary",
                    "projects": "Projects",
                },
            },
        }

        result = _normalize_translation_payload(
            {
                "target_language": "en",
                "translated_resume_data": {"resume_data": translated},
                "translated_sections": ["Summary", "Projects"],
            },
            {
                "resume_data": source,
                "source_language": "zh-CN",
                "target_language": "en",
            },
        )

        normalized = result["translated_resume_data"]
        self.assertNotIn("resume_data", normalized)
        self.assertEqual(normalized["basics"]["title"], "Backend Engineer")
        self.assertEqual(normalized["projects"][0]["id"], "project_1")
        self.assertEqual(normalized["projects"][0]["tech_stack"], ["FastAPI"])
        self.assertEqual(normalized["layout"]["section_order"], source["layout"]["section_order"])


if __name__ == "__main__":
    unittest.main()
