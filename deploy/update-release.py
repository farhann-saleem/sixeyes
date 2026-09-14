#!/usr/bin/python3
"""Install tested public GitHub releases; keep secrets and data outside releases."""
import fcntl, hashlib, json, os, pathlib, re, shutil, subprocess, tarfile, tempfile, time, urllib.request
BASE = pathlib.Path('/opt/marketing-studio')
REPO = 'farhann-saleem/sixeyes'
lock = open('/run/marketing-studio-deploy.lock', 'w')
try:
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
except BlockingIOError:
    raise SystemExit(0)
def fetch(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'marketing-studio-deploy'}), timeout=90)
def run(*args):
    subprocess.run(args, check=True)
def switch(target):
    link = BASE / 'next'
    link.unlink(missing_ok=True)
    link.symlink_to(target)
    link.replace(BASE / 'current')
def healthy(sha):
    for _ in range(30):
        try:
            with fetch('http://127.0.0.1:3001/health') as response:
                if json.load(response).get('revision') == sha:
                    return True
        except Exception:
            pass
        time.sleep(2)
    return False
with fetch(f'https://api.github.com/repos/{REPO}/releases?per_page=10') as response:
    releases = json.load(response)
release = next((r for r in releases if not r['draft'] and re.fullmatch(r'deploy-[a-f0-9]{40}', r['tag_name'])), None)
if not release:
    raise SystemExit('No tested deployment release published yet')
sha = release['tag_name'][7:]
current = BASE / 'current'
previous = current.resolve() if current.is_symlink() else None
if previous and previous.name == sha:
    raise SystemExit(0)
failed = BASE / 'incoming' / 'failed-revision'
if failed.exists() and failed.read_text().strip() == sha:
    raise SystemExit('Skipping failed release; push a fix or remove incoming/failed-revision to retry')
assets = {a['name']: a['browser_download_url'] for a in release['assets']}
prefix = f'https://github.com/{REPO}/releases/download/{release["tag_name"]}/'
for name in ('marketing-studio.tar.gz', 'SHA256SUMS'):
    if not assets.get(name, '').startswith(prefix):
        raise SystemExit('Release asset is missing or has an unexpected origin')
target = BASE / 'releases' / sha
with tempfile.TemporaryDirectory(dir=BASE / 'incoming') as scratch:
    archive = pathlib.Path(scratch) / 'release.tar.gz'
    with fetch(assets['marketing-studio.tar.gz']) as response, archive.open('wb') as out:
        shutil.copyfileobj(response, out)
    with fetch(assets['SHA256SUMS']) as response:
        expected = response.read(1024).decode().split()[0]
    digest = hashlib.sha256()
    with archive.open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(block)
    if not re.fullmatch('[a-f0-9]{64}', expected) or digest.hexdigest() != expected:
        raise SystemExit('Release checksum mismatch')
    if target.exists():
        shutil.rmtree(target)
    target.mkdir()
    with tarfile.open(archive) as tar:
        for member in tar.getmembers():
            p = pathlib.PurePosixPath(member.name)
            if p.is_absolute() or '..' in p.parts or not (member.isdir() or member.isfile()):
                raise SystemExit('Unsafe archive member')
            if p.parts[0] not in ('apps', 'image-template', 'video-template', 'effects-template', 'deploy'):
                raise SystemExit('Unexpected release file')
        tar.extractall(target, filter='data')
    run('chown', '-R', 'msapp:msapp', str(target))
    run('runuser', '-u', 'msapp', '--', 'env', 'HOME=/opt/marketing-studio/home', 'npm', 'ci', '--no-audit', '--no-fund', '--prefix', str(target / 'apps/backend'))
    # Source is read-only at runtime. Secrets live in shared, outside the archive.
    run('chown', '-R', 'root:root', str(target))
    (target / '.env').symlink_to(BASE / 'shared/.env')
    (target / 'revision.env').write_text(f'DEPLOY_REVISION={sha}\n')
    switch(target)
    run('systemctl', 'restart', 'ms-backend')
    if not healthy(sha):
        failed.write_text(sha + '\n')
        if previous:
            switch(previous)
            run('systemctl', 'restart', 'ms-backend')
        raise SystemExit('New release failed health check; previous release restored when available')
    failed.unlink(missing_ok=True)
    print(f'Deployed {sha}', flush=True)
# Keep the active release and its predecessor for rollback; shared data is never removed.
for old in (BASE / 'releases').iterdir():
    if old not in (target, previous) and re.fullmatch('[a-f0-9]{40}', old.name):
        shutil.rmtree(old)
