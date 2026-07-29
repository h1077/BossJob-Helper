"""Contract tests for the single standalone resume-editor entry."""
from __future__ import annotations

import json
import re
import subprocess
import unittest
from pathlib import Path


DESKTOP_APP = Path(__file__).resolve().parents[1]
STATIC = DESKTOP_APP / "static"


class ResumeEntryContractTests(unittest.TestCase):
    def test_index_does_not_embed_a_second_resume_editor(self):
        index = (STATIC / "index.html").read_text(encoding="utf-8")

        for removed_marker in (
            'id="resume-editor"',
            'id="resume-top-bar"',
            'id="modal-generate-overlay"',
            'id="modal-score-overlay"',
            'id="modal-jdmatch-overlay"',
            '/js/resume-editor.js',
        ):
            self.assertNotIn(removed_marker, index)

    def test_open_resume_editor_uses_the_standalone_page(self):
        app_js = (STATIC / "js" / "app.js").read_text(encoding="utf-8")
        match = re.search(
            r"function openResumeEditor\(resumeId = null\) \{.*?\n\}",
            app_js,
            flags=re.DOTALL,
        )
        self.assertIsNotNone(match, "app.js must provide openResumeEditor(resumeId = null)")

        script = """
let destinations = [];
const window = { location: { assign: value => destinations.push(value) } };
%s
openResumeEditor();
openResumeEditor(123);
console.log(JSON.stringify(destinations));
""" % match.group(0)
        result = subprocess.run(
            ["node", "-e", script],
            check=True,
            capture_output=True,
            text=True,
        )
        self.assertEqual(json.loads(result.stdout), ["/editor.html", "/editor.html#123"])

    def test_homepage_no_longer_has_embedded_editor_routing_or_styles(self):
        app_js = (STATIC / "js" / "app.js").read_text(encoding="utf-8")
        css = (STATIC / "css" / "app.css").read_text(encoding="utf-8")

        self.assertNotIn("editingResumeId", app_js)
        self.assertNotIn("function handleHash()", app_js)
        self.assertNotIn("function backToResumeList()", app_js)
        self.assertNotIn(".editor-fullscreen", css)
        self.assertFalse(css.endswith("\n\n"), "app.css must not end with a blank line")

    def test_standalone_editor_page_remains_present(self):
        editor = STATIC / "editor.html"
        self.assertTrue(editor.is_file())
        self.assertIn('id="preview-frame"', editor.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
