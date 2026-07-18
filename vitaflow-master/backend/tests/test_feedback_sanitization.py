import unittest

from app.api.feedback import feedback_data
from app.models.ai_config import UserFeedback
from app.services.rich_text_service import sanitize_rich_text_html


class FeedbackSanitizationTest(unittest.TestCase):
    def test_sanitizer_removes_executable_html_and_keeps_safe_content(self) -> None:
        content = (
            '<p onclick="alert(1)">正常反馈</p>'
            '<script>localStorage.getItem("vitaflow_token")</script>'
            '<img src="javascript:alert(2)" onerror="alert(3)" alt="截图">'
            '<img src="/api/files/feedback.png" alt="安全截图">'
        )

        sanitized = sanitize_rich_text_html(content, allow_images=True)

        self.assertIn("<p>正常反馈</p>", sanitized)
        self.assertNotIn("script", sanitized.lower())
        self.assertNotIn("onclick", sanitized.lower())
        self.assertNotIn("onerror", sanitized.lower())
        self.assertNotIn("javascript:", sanitized.lower())
        self.assertIn('src="/api/files/feedback.png"', sanitized)

    def test_feedback_response_sanitizes_legacy_stored_content(self) -> None:
        feedback = UserFeedback(
            user_id=1,
            category="general",
            content='<svg onload="alert(1)"></svg><p>保留内容</p>',
            status="open",
        )

        data = feedback_data(feedback)

        self.assertEqual(data["content"], "<p>保留内容</p>")


if __name__ == "__main__":
    unittest.main()
