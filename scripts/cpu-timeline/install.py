"""Install additive timeline support into a COPY of the existing worker build context.
Usage: python3 install.py /path/to/worker-build-context
The legacy concat and FaceFusion functions are preserved verbatim.
"""
from pathlib import Path
import shutil
import sys
root = Path(sys.argv[1])
handler = root / 'handler.py'
s = handler.read_text()
if 'timeline_version' not in s:
    assert 'def stitch(inp, work):' in s and "'init_error': _init_error}" in s
    s = s.replace('def stitch(inp, work):', '''def stitch(inp, work):
    if 'timeline' in inp:
        from timeline_stitch import render
        return render(inp, work, sys.modules[__name__])''')
    s = s.replace("'init_error': _init_error}", "'init_error': _init_error, 'timeline_version': 1}")
    handler.write_text(s)
shutil.copyfile(Path(__file__).with_name('timeline_stitch.py'), root / 'timeline_stitch.py')
docker = root / 'Dockerfile'
s = docker.read_text()
if 'COPY timeline_stitch.py' not in s:
    s += '\nCOPY timeline_stitch.py /app/\n'
docker.write_text(s)
