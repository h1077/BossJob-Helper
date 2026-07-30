"""Integration tests for immutable resume version snapshots."""
from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from flask import Flask

from models import Resume, ResumeVersion, User, db
from routes.resumes import resumes_bp


class ResumeVersionApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.app = Flask(__name__)
        self.app.config.update(
            SQLALCHEMY_DATABASE_URI=f"sqlite:///{Path(self.temp_dir.name) / 'versions.db'}",
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

    def create_resume(self, title="原始简历", content="原始内容"):
        response = self.client.post(
            "/api/resumes",
            headers=self.headers,
            json={
                "title": title,
                "content": content,
                "structuredData": {"name": "张三", "projects": []},
                "templateConfig": {"templateId": "project_focus", "accentColor": "#9333ea"},
            },
        )
        self.assertEqual(response.status_code, 200)
        return response.get_json()["data"]

    def test_manual_snapshots_are_numbered_and_immutable(self):
        resume = self.create_resume()

        first = self.client.post(
            f"/api/resumes/{resume['id']}/versions",
            headers=self.headers,
            json={"note": "投递前"},
        )
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.get_json()["data"]["versionNumber"], 1)
        self.assertEqual(first.get_json()["data"]["templateConfig"]["templateId"], "project_focus")

        updated = self.client.put(
            f"/api/resumes/{resume['id']}",
            headers=self.headers,
            json={"content": "修改后的内容", "title": "修改版简历"},
        )
        self.assertEqual(updated.status_code, 200)

        second = self.client.post(
            f"/api/resumes/{resume['id']}/versions",
            headers=self.headers,
            json={"note": "修改后"},
        )
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.get_json()["data"]["versionNumber"], 2)

        first_detail = self.client.get(
            f"/api/resumes/{resume['id']}/versions/{first.get_json()['data']['id']}",
            headers=self.headers,
        )
        self.assertEqual(first_detail.status_code, 200)
        self.assertEqual(first_detail.get_json()["data"]["title"], "原始简历")
        self.assertEqual(first_detail.get_json()["data"]["content"], "原始内容")
        self.assertEqual(first_detail.get_json()["data"]["structuredData"]["name"], "张三")
        self.assertEqual(first_detail.get_json()["data"]["templateConfig"]["accentColor"], "#9333ea")

    def test_restore_creates_a_protective_snapshot_of_current_content(self):
        resume = self.create_resume()
        version_response = self.client.post(
            f"/api/resumes/{resume['id']}/versions",
            headers=self.headers,
            json={"note": "基线"},
        )
        self.assertEqual(version_response.status_code, 200)
        version = version_response.get_json()["data"]
        self.client.put(
            f"/api/resumes/{resume['id']}",
            headers=self.headers,
            json={"content": "待撤销内容", "title": "待撤销标题"},
        )

        restored = self.client.post(
            f"/api/resumes/{resume['id']}/versions/{version['id']}/restore",
            headers=self.headers,
        )
        self.assertEqual(restored.status_code, 200)
        self.assertEqual(restored.get_json()["data"]["title"], "原始简历")
        self.assertEqual(restored.get_json()["data"]["content"], "原始内容")

        versions = self.client.get(
            f"/api/resumes/{resume['id']}/versions", headers=self.headers
        )
        self.assertEqual(versions.status_code, 200)
        self.assertEqual(
            [item["source"] for item in versions.get_json()["data"]],
            ["before_restore", "manual"],
        )

    def test_missing_version_returns_not_found(self):
        resume = self.create_resume()
        response = self.client.get(
            f"/api/resumes/{resume['id']}/versions/999999", headers=self.headers
        )
        self.assertEqual(response.status_code, 404)

    def test_other_users_resume_versions_are_not_visible(self):
        with self.app.app_context():
            other_user = User(email="other@example.test", password_hash="test")
            db.session.add(other_user)
            db.session.flush()
            other_resume = Resume(
                user_id=other_user.id,
                title="其他用户简历",
                content="其他内容",
            )
            db.session.add(other_resume)
            db.session.flush()
            other_version = ResumeVersion(
                user_id=other_user.id,
                resume_id=other_resume.id,
                version_number=1,
                title=other_resume.title,
                content=other_resume.content,
                source="manual",
            )
            db.session.add(other_version)
            db.session.commit()

            other_resume_id = other_resume.id
            other_version_id = other_version.id

        response = self.client.get(
            f"/api/resumes/{other_resume_id}/versions/{other_version_id}",
            headers=self.headers,
        )
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
