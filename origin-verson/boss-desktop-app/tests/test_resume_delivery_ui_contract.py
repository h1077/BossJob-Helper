"""Static contracts for resume-version and delivery-record UI controls."""
import unittest
from pathlib import Path


APP_JS = Path(__file__).resolve().parents[1] / 'static' / 'js' / 'app.js'
INDEX_HTML = Path(__file__).resolve().parents[1] / 'static' / 'index.html'


class ResumeDeliveryUiContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.script = APP_JS.read_text(encoding='utf-8')
        cls.page = INDEX_HTML.read_text(encoding='utf-8')

    def test_job_table_and_detail_expose_delivery_resume_controls(self):
        self.assertIn('投递简历', self.page)
        self.assertIn('deliveryResume', self.script)
        self.assertIn("/delivery-resume", self.script)
        self.assertIn('loadJobDelivery', self.script)

    def test_resume_cards_expose_version_history_and_restore_controls(self):
        self.assertIn('版本历史', self.script)
        self.assertIn('showResumeVersions', self.script)
        self.assertIn("/versions", self.script)
        self.assertIn('/restore', self.script)

    def test_delete_actions_surface_server_protection_errors(self):
        self.assertIn('删除岗位失败', self.script)
        self.assertIn('删除简历失败', self.script)


if __name__ == '__main__':
    unittest.main()
