"""Contract tests for template selection and preview UI controls."""
import unittest
from pathlib import Path


EDITOR_HTML = Path(__file__).resolve().parents[1] / "static" / "editor.html"
PREVIEW_JS = Path(__file__).resolve().parents[1] / "static" / "js" / "resume-template-preview.js"


class ResumeTemplateUiContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.editor = EDITOR_HTML.read_text(encoding="utf-8")
        cls.preview = PREVIEW_JS.read_text(encoding="utf-8")

    def test_editor_loads_template_preview_script(self):
        self.assertIn("resume-template-preview.js", self.editor)

    def test_preview_js_exposes_template_functions(self):
        self.assertIn("function initTemplateControls", self.preview)
        self.assertIn("function refreshPreview", self.preview)
        self.assertIn("function getTemplateConfig", self.preview)
        self.assertIn("/api/resumes/render-preview", self.preview)
        self.assertIn("/api/resumes/templates", self.preview)

    def test_editor_has_template_selection_controls(self):
        self.assertIn('id="template-controls"', self.editor)
        self.assertIn('id="template-options"', self.editor)
        self.assertIn('id="tpl-accent"', self.editor)
        self.assertIn("LaTeX（传统版）", self.editor)

    def test_editor_no_longer_has_inline_build_html(self):
        self.assertNotIn("function buildHTML(", self.editor)

    def test_save_includes_template_config(self):
        self.assertIn("getTemplateConfig", self.editor)


if __name__ == "__main__":
    unittest.main()
