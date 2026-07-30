"""Contract tests for persisted resume template configuration."""
from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from flask import Flask
from sqlalchemy import inspect, text

from models import db
from routes.resumes import resumes_bp


class ResumeTemplateContractTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.app = Flask(__name__)
        self.app.config.update(
            SQLALCHEMY_DATABASE_URI=f"sqlite:///{Path(self.temp_dir.name) / 'templates.db'}",
            SQLALCHEMY_TRACK_MODIFICATIONS=False,
            LOCAL_TOKEN="test-local-token",
            TESTING=True,
        )
        db.init_app(self.app)
        self.app.register_blueprint(resumes_bp)
        with self.app.app_context():
            db.create_all()
        self.client = self.app.test_client()
        self.headers = {
            "Authorization": "Bearer test-local-token",
            "Content-Type": "application/json",
        }

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()
            db.engine.dispose()
        self.temp_dir.cleanup()

    def _create_resume(self, template_config=None):
        payload = {
            "title": "模板测试简历",
            "content": "用于验证模板配置持久化。",
            "structuredData": {"name": "测试用户"},
        }
        if template_config is not None:
            payload["templateConfig"] = template_config
        response = self.client.post("/api/resumes", headers=self.headers, json=payload)
        self.assertEqual(response.status_code, 200)
        return response.get_json()["data"]

    def test_missing_or_invalid_template_config_resolves_to_classic_default(self):
        legacy_resume = self._create_resume()
        invalid_resume = self._create_resume({
            "templateId": "unknown-template",
            "accentColor": "red",
            "bodyFontSize": 99,
            "lineHeight": 0,
            "pageMargin": -2,
        })

        expected = {
            "schemaVersion": 1,
            "templateId": "classic",
            "accentColor": "#2563eb",
            "bodyFontSize": 13,
            "lineHeight": 1.7,
            "pageMargin": 16,
        }
        self.assertEqual(legacy_resume["templateConfig"], expected)
        self.assertEqual(invalid_resume["templateConfig"], expected)

    def test_template_config_is_persisted_and_accepts_legacy_snake_case(self):
        resume = self._create_resume({
            "templateId": "ats_compact",
            "accentColor": "#0F766E",
            "bodyFontSize": 12,
            "lineHeight": 1.5,
            "pageMargin": 12,
        })
        self.assertEqual(resume["templateConfig"]["templateId"], "ats_compact")
        self.assertEqual(resume["templateConfig"]["accentColor"], "#0f766e")

        updated = self.client.put(
            f"/api/resumes/{resume['id']}",
            headers=self.headers,
            json={"template_config": {"template_id": "project_focus", "themeColor": "#7c3aed"}},
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.get_json()["data"]["templateConfig"]["templateId"], "project_focus")
        self.assertEqual(updated.get_json()["data"]["templateConfig"]["accentColor"], "#7c3aed")

    def test_snapshots_and_restore_preserve_the_template_config(self):
        resume = self._create_resume({"templateId": "project_focus", "accentColor": "#9333ea"})
        snapshot_response = self.client.post(
            f"/api/resumes/{resume['id']}/versions",
            headers=self.headers,
            json={"note": "保存项目优先版"},
        )
        self.assertEqual(snapshot_response.status_code, 200)
        snapshot = snapshot_response.get_json()["data"]
        self.assertEqual(snapshot["templateConfig"]["templateId"], "project_focus")

        changed = self.client.put(
            f"/api/resumes/{resume['id']}",
            headers=self.headers,
            json={"templateConfig": {"templateId": "ats_compact"}},
        )
        self.assertEqual(changed.status_code, 200)

        restored = self.client.post(
            f"/api/resumes/{resume['id']}/versions/{snapshot['id']}/restore",
            headers=self.headers,
        )
        self.assertEqual(restored.status_code, 200)
        self.assertEqual(restored.get_json()["data"]["templateConfig"]["templateId"], "project_focus")

    def test_migration_adds_template_columns_and_can_run_twice(self):
        from app import _run_migrations

        migration_app = Flask(__name__)
        migration_app.config.update(
            SQLALCHEMY_DATABASE_URI="sqlite://",
            SQLALCHEMY_TRACK_MODIFICATIONS=False,
        )
        db.init_app(migration_app)
        with migration_app.app_context():
            db.session.execute(text(
                'CREATE TABLE resumes (id INTEGER PRIMARY KEY, user_id INTEGER, title VARCHAR(200), content TEXT)'
            ))
            db.session.execute(text(
                'CREATE TABLE interested_jobs (id INTEGER PRIMARY KEY, user_id INTEGER, job_id VARCHAR(100))'
            ))
            db.session.commit()

            _run_migrations(inspect(db.engine))
            _run_migrations(inspect(db.engine))

            resume_columns = {column['name'] for column in inspect(db.engine).get_columns('resumes')}
            version_columns = {column['name'] for column in inspect(db.engine).get_columns('resume_versions')}
            self.assertIn('template_config', resume_columns)
            self.assertIn('template_config', version_columns)
            db.session.remove()
            db.engine.dispose()


if __name__ == "__main__":
    unittest.main()
