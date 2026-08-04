"""Contract tests for unified resume template rendering."""
from __future__ import annotations

import unittest

from flask import Flask

from models import db
from routes.resumes import resumes_bp


class ResumeTemplateRenderingTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(
            SQLALCHEMY_DATABASE_URI="sqlite://",
            SQLALCHEMY_TRACK_MODIFICATIONS=False,
            LOCAL_TOKEN="test-local-render-token",
            TESTING=True,
        )
        db.init_app(self.app)
        self.app.register_blueprint(resumes_bp)
        with self.app.app_context():
            db.create_all()
        self.client = self.app.test_client()
        self.headers = {
            "Authorization": "Bearer test-local-render-token",
            "Content-Type": "application/json",
        }

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()
            db.engine.dispose()

    def _render(self, sd=None, template_id="classic"):
        payload = {
            "title": "示例简历",
            "structuredData": sd or {
                "name": "张三",
                "phone": "13800000000",
                "email": "test@example.com",
                "education": [{"school": "示例大学", "major": "计算机科学", "degree": "本科", "period": "2020-2024"}],
            },
            "templateConfig": {"templateId": template_id},
        }
        response = self.client.post("/api/resumes/render-preview", headers=self.headers, json=payload)
        return response

    def test_all_three_templates_return_ok(self):
        for tid in ("classic", "ats_compact", "project_focus"):
            with self.subTest(template=tid):
                resp = self._render(template_id=tid)
                self.assertEqual(resp.status_code, 200)
                data = resp.get_json()["data"]
                self.assertIn("<html", data["html"])
                self.assertGreater(data["renderMs"], 0)

    def test_ats_compact_has_no_colorful_cards(self):
        resp = self._render(template_id="ats_compact")
        html = resp.get_json()["data"]["html"]
        # ATS: card items should not use colored backgrounds
        self.assertNotIn("background-color", html.lower())
        # Body background is allowed
        self.assertIn("background: #fff", html.lower())

    def test_missing_data_returns_default_template(self):
        resp = self._render(sd={}, template_id="unknown-template")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("<html", resp.get_json()["data"]["html"])

    def test_preview_respects_hidden_modules(self):
        sd = {
            "name": "张三",
            "education": [{"school": "X大学", "major": "CS", "degree": "本科", "period": "2020-2024"}],
            "projects": [{"name": "AI助手", "role": "核心开发", "period": "2023-2024", "tags": ["Python"]}],
        }
        resp = self._render(sd=sd, template_id="classic")
        self.assertIn("教育背景", resp.get_json()["data"]["html"])
        self.assertIn("项目经历", resp.get_json()["data"]["html"])

        resp_hidden = self.client.post("/api/resumes/render-preview", headers=self.headers, json={
            "title": "隐藏版",
            "structuredData": sd,
            "templateConfig": {"templateId": "classic"},
            "hiddenModules": ["education"],
        })
        html = resp_hidden.get_json()["data"]["html"]
        self.assertNotIn("教育背景", html)
        self.assertIn("项目经历", html)

    def test_templates_metadata_endpoint(self):
        resp = self.client.get("/api/resumes/templates", headers=self.headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()["data"]
        self.assertEqual(len(data), 3)
        ids = {item["id"] for item in data}
        self.assertEqual(ids, {"classic", "ats_compact", "project_focus"})


if __name__ == "__main__":
    unittest.main()
