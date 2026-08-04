"""Tests for DOCX export and backup import/export."""
from __future__ import annotations

import io
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from flask import Flask

from models import Resume, db
from routes.resumes import resumes_bp


class ResumeDocxBackupTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.app = Flask(__name__)
        self.app.config.update(
            SQLALCHEMY_DATABASE_URI=f"sqlite:///{Path(self.temp_dir.name) / 'docx_backup.db'}",
            SQLALCHEMY_TRACK_MODIFICATIONS=False,
            LOCAL_TOKEN="test-local-backup-token",
            TESTING=True,
        )
        db.init_app(self.app)
        self.app.register_blueprint(resumes_bp)
        with self.app.app_context():
            db.create_all()
        self.client = self.app.test_client()
        self.headers = {
            "Authorization": "Bearer test-local-backup-token",
            "Content-Type": "application/json",
        }

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()
            db.engine.dispose()
        self.temp_dir.cleanup()

    def _create_resume(self):
        response = self.client.post(
            "/api/resumes",
            headers=self.headers,
            json={
                "title": "导出测试简历",
                "content": "测试内容",
                "structuredData": {"name": "张三", "phone": "13800000000", "projects": []},
                "templateConfig": {"templateId": "classic"},
            },
        )
        self.assertEqual(response.status_code, 200)
        return response.get_json()["data"]

    def test_docx_export_returns_word_document(self):
        resume = self._create_resume()
        resp = self.client.get(
            f"/api/resumes/{resume['id']}/export-docx",
            headers=self.headers,
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("application/vnd.openxmlformats", resp.content_type)

    def test_docx_export_no_structured_data_returns_400(self):
        response = self.client.post(
            "/api/resumes",
            headers=self.headers,
            json={"title": "无结构", "content": "纯文本简历"},
        )
        resume = response.get_json()["data"]
        resp = self.client.get(
            f"/api/resumes/{resume['id']}/export-docx",
            headers=self.headers,
        )
        self.assertEqual(resp.status_code, 400)

    def test_backup_export_contains_manifest_and_versions(self):
        resume = self._create_resume()
        self.client.post(
            f"/api/resumes/{resume['id']}/versions",
            headers=self.headers,
            json={"note": "备份前快照"},
        )

        resp = self.client.get(f"/api/resumes/{resume['id']}/backup", headers=self.headers)
        self.assertEqual(resp.status_code, 200)
        self.assertIn("application/zip", resp.content_type)

        with zipfile.ZipFile(io.BytesIO(resp.data)) as zf:
            names = zf.namelist()
            self.assertIn("manifest.json", names)
            self.assertIn("structured_data.json", names)
            self.assertIn("content.txt", names)
            self.assertTrue(any("versions/V001" in n for n in names))

    def test_backup_restore_preserves_data(self):
        resume = self._create_resume()
        self.client.post(
            f"/api/resumes/{resume['id']}/versions",
            headers=self.headers,
            json={"note": "backup_test"},
        )
        backup_resp = self.client.get(f"/api/resumes/{resume['id']}/backup", headers=self.headers)

        restored = self.client.post(
            "/api/resumes/restore",
            headers={"Authorization": self.headers["Authorization"]},
            content_type="multipart/form-data",
            data={"file": (io.BytesIO(backup_resp.data), "backup.zip", "application/zip")},
        )
        self.assertEqual(restored.status_code, 200)
        result = restored.get_json()
        self.assertTrue(result["success"])
        self.assertEqual(result["data"]["restoredVersions"], 1)

    def test_restore_rejects_invalid_zip(self):
        resp = self.client.post(
            "/api/resumes/restore",
            headers={"Authorization": self.headers["Authorization"]},
            content_type="multipart/form-data",
            data={"file": (io.BytesIO(b"not a zip"), "bad.zip", "application/octet-stream")},
        )
        self.assertEqual(resp.status_code, 400)


if __name__ == "__main__":
    unittest.main()
