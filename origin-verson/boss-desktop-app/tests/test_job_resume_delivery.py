"""Integration tests for job-to-resume delivery records."""
from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from flask import Flask

from models import Resume, ResumeVersion, db
from routes.jobs import jobs_bp
from routes.resumes import resumes_bp


class JobResumeDeliveryTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.app = Flask(__name__)
        self.app.config.update(
            SQLALCHEMY_DATABASE_URI=f"sqlite:///{Path(self.temp_dir.name) / 'delivery.db'}",
            SQLALCHEMY_TRACK_MODIFICATIONS=False,
            LOCAL_TOKEN="test-local-token",
            TESTING=True,
        )
        db.init_app(self.app)
        self.app.register_blueprint(jobs_bp)
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

    def create_resume(self):
        response = self.client.post(
            "/api/resumes",
            headers=self.headers,
            json={
                "title": "投递简历",
                "content": "投递前的内容",
                "structuredData": {"name": "张三"},
            },
        )
        self.assertEqual(response.status_code, 200)
        return response.get_json()["data"]

    def create_job(self):
        response = self.client.post(
            "/api/jobs/collect",
            headers=self.headers,
            json={"jobId": "job-delivery-1", "companyName": "示例公司", "jobName": "后端工程师"},
        )
        self.assertEqual(response.status_code, 200)
        return response.get_json()["data"]

    def test_delivery_records_an_immutable_resume_snapshot(self):
        resume = self.create_resume()
        job = self.create_job()

        recorded = self.client.post(
            f"/api/jobs/{job['id']}/delivery-resume",
            headers=self.headers,
            json={"resumeId": resume["id"]},
        )
        self.assertEqual(recorded.status_code, 200)
        delivery_resume = recorded.get_json()["data"]["deliveryResume"]
        self.assertEqual(delivery_resume["resumeId"], resume["id"])
        self.assertEqual(delivery_resume["versionNumber"], 1)

        self.client.put(
            f"/api/resumes/{resume['id']}",
            headers=self.headers,
            json={"content": "投递后的修改内容"},
        )
        version = self.client.get(
            f"/api/resumes/{resume['id']}/versions/{delivery_resume['versionId']}",
            headers=self.headers,
        )
        self.assertEqual(version.get_json()["data"]["content"], "投递前的内容")

        with self.app.app_context():
            self.assertEqual(ResumeVersion.query.count(), 1)

    def test_repeated_delivery_recording_is_idempotent(self):
        resume = self.create_resume()
        job = self.create_job()
        first = self.client.post(
            f"/api/jobs/{job['id']}/delivery-resume",
            headers=self.headers,
            json={"resumeId": resume["id"]},
        )
        second = self.client.post(
            f"/api/jobs/{job['id']}/delivery-resume",
            headers=self.headers,
            json={"resumeId": resume["id"]},
        )
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(
            first.get_json()["data"]["deliveryResume"]["versionId"],
            second.get_json()["data"]["deliveryResume"]["versionId"],
        )
        with self.app.app_context():
            self.assertEqual(ResumeVersion.query.count(), 1)

    def test_recorded_delivery_cannot_be_rebound_to_another_resume(self):
        first_resume = self.create_resume()
        alternative_resume = self.client.post(
            "/api/resumes",
            headers=self.headers,
            json={"title": "另一份简历", "content": "另一份内容"},
        ).get_json()["data"]
        job = self.create_job()
        self.client.post(
            f"/api/jobs/{job['id']}/delivery-resume",
            headers=self.headers,
            json={"resumeId": first_resume["id"]},
        )

        rebound = self.client.post(
            f"/api/jobs/{job['id']}/delivery-resume",
            headers=self.headers,
            json={"resumeId": alternative_resume["id"]},
        )
        self.assertEqual(rebound.status_code, 409)
        with self.app.app_context():
            self.assertEqual(ResumeVersion.query.count(), 1)

    def test_delivery_linked_resume_cannot_be_deleted(self):
        resume = self.create_resume()
        job = self.create_job()
        self.client.post(
            f"/api/jobs/{job['id']}/delivery-resume",
            headers=self.headers,
            json={"resumeId": resume["id"]},
        )

        deleted = self.client.delete(f"/api/resumes/{resume['id']}", headers=self.headers)
        self.assertEqual(deleted.status_code, 409)
        self.assertFalse(deleted.get_json()["success"])


if __name__ == "__main__":
    unittest.main()
