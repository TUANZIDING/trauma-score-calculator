"""Assemble the single-file app: python3 build.py -> index.html"""
from pathlib import Path
s = Path("src/ui.html").read_text(encoding="utf-8")
s = s.replace("/*__LESSON__*/", Path("src/lesson.html").read_text(encoding="utf-8"))
s = s.replace("/*__CORE__*/", Path("src/core.js").read_text(encoding="utf-8"))
Path("index.html").write_text(s, encoding="utf-8")
print("index.html written")
