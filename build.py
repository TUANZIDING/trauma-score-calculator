"""Assemble the single-file app: python3 build.py [out.html]"""
import sys
from pathlib import Path
s = Path("src/ui.html").read_text(encoding="utf-8")
s = s.replace("/*__LESSON__*/", Path("src/lesson.html").read_text(encoding="utf-8"))
core = Path("src/icdmap.js").read_text(encoding="utf-8") + "\n" + Path("src/core.js").read_text(encoding="utf-8")
s = s.replace("/*__CORE__*/", core)
out = sys.argv[1] if len(sys.argv) > 1 else "index.html"
Path(out).write_text(s, encoding="utf-8")
print(out, "written")
