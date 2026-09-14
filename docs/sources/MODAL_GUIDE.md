# 🚀 Modal — Complete Starter Guide (for humans AND coding agents)

> **Modal** = serverless GPUs in the cloud. You write Python, decorate functions, and they run on whatever GPU you ask for. Pay **per second** of compute. No idle costs. Free $30 credits on signup.
>
> **Website:** https://modal.com · **Docs:** https://modal.com/docs

---

## 0. The 30-Second Mental Model

```python
import modal

app = modal.App("my-cool-app")

@app.function(gpu="T4")          # ← this function runs on a T4 GPU in the cloud
def generate_voice():
    return "hello from the cloud!"

# That's it. `modal run` executes it. `modal deploy` makes it callable remotely.
```

- **`modal run`** — run your code in the cloud right now (dev/experiments)
- **`modal deploy`** — deploy it as a persistent service (callable anytime, autoscales)
- **`@app.cls`** — stateful class: model loads ONCE and stays warm across calls (this is what you want for LLMs/TTS)

---

## 1. Install

```bash
# Requires Python 3.9+. If you use uv, prefer uv (Modal loves uv).
pip install modal

# Verify
modal --version
# modal client version: 1.x.x
```

If pip complains about system packages (Ubuntu 23+), use a venv:

```bash
python3 -m venv .venv
.venv/bin/pip install modal
.venv/bin/python -m modal --version
```

**Windows note:** everything is identical, just `pip install modal` and `modal` should be on PATH.

---

## 2. Setup & Login (one-time)

```bash
# Interactive auth wizard — opens a browser, logs you in, generates a token
modal setup
```

That's it. Verify:

```bash
modal token info          # shows which account you're authenticated as
modal workspace show      # shows your workspace
```

**Troubleshooting:**
- If a token already exists and you want to switch accounts: `modal token new`
- If you want to set a token manually: `modal token set`
- Browser can't open? The CLI prints a URL — open it manually, paste the code.

---

## 3. Set Your $30 Budget (DO THIS BEFORE PLAYING)

Modal budgets are **enforced by Modal** — when you hit the cap, all compute is blocked. No surprise bills.

1. Go to **https://modal.com/settings/usage** (Settings → Usage & Billing)
2. Find **Workspace budget** → set **$30** → Save
3. Same page shows your current spend and the credit balance

You can also check spend from CLI:

```bash
modal workspace show
```

---

## 4. Install the Modal Skill for Your Coding Agent

Modal ships an official skill pack that teaches coding agents (Claude Code, Command Code, etc.) how to use Modal correctly — API reference, examples, best practices, all bundled locally.

```bash
# Install into .agents/skills/ (works with Command Code and most agent CLIs)
modal skills install --yes

# Install for Claude Code specifically (puts it in .claude/skills/)
modal skills install --yes --claude

# Install globally into your home directory (~/.agents/)
modal skills install --yes --global

# Skip the bundled docs if you want it lean
modal skills install --yes --no-docs

# Update later when Modal releases new features
modal skills update
```

**After installing, tell your coding agent something like this:**

> "I've installed the Modal skill at .agents/skills/modal (or .claude/skills/modal). For any Modal task — deploying apps, GPU config, secrets, volumes, cron jobs — activate/read that skill first and follow it. The bundled docs in references/ are the source of truth. Use `modal --help` and `modal <command> --help` to discover current CLI options."

That one paragraph saves a LOT of agent mistakes (trust me — Modal's API evolves fast, and stale training data causes errors).

---

## 5. Hello World in 60 Seconds

Create `hello_modal.py`:

```python
import modal

app = modal.App("hello")

@app.function()
def hello():
    return "Hello from Modal!"

@app.local_entrypoint()          # runs on YOUR machine, calls the cloud function
def main():
    print(hello.remote())        # .remote() = execute in the cloud
```

Run it:

```bash
modal run hello_modal.py
```

Expected output: `Hello from Modal!`

---

## 6. The Commands You'll Actually Use

### Running & Deploying

```bash
modal run my_app.py                 # run local_entrypoint (dev/test)
modal deploy my_app.py              # deploy as a persistent app
modal serve my_app.py               # deploy with hot-reload (dev servers, web endpoints)

modal app list                       # see all deployed apps + status
modal app logs my-app-name           # stream logs from a deployed app
modal app stop my-app-name --yes     # kill running containers / stop app
modal app delete my-app-name         # remove a deployment permanently
```

### Shell & Debugging

```bash
modal shell                          # interactive shell in a Modal container (GPU enabled)
modal shell --gpu T4                 # shell WITH a T4 attached (great for testing CUDA)
```

### Storage

```bash
modal secret create my-secret KEY1=value1 KEY2=value2   # create secrets (API keys etc.)
modal secret list                                       # list secrets
modal secret delete my-secret                           # delete a secret

modal volume create my-volume /data                     # persistent disk
modal volume list                                       # list volumes
modal volume ls my-volume /data                         # browse volume files
modal volume get my-volume /data/file.txt               # download a file

modal dict create my-dict                               # key-value store
modal queue create my-queue                             # message queue for jobs
```

### Inspecting & Managing

```bash
modal image list              # built images (they're cached — this is why redeploys are fast)
modal workspace show          # workspace info + usage
modal environment list        # environments (dev/staging/prod separation)
modal profile list            # if you have multiple accounts
```

### Docs & Skills

```bash
modal skills show             # print the Modal skill content to terminal
modal bootstrap my-app        # generate a starter project template
```

### 🔥 Pro tip — always check help

Modal ships new features constantly. When a command errors, the FIRST move is:

```bash
modal <command> --help
```

The help text is always current and usually has the answer.

---

## 7. Real Patterns You'll Want

### 7.1 Stateful model (load once, stay warm) — the LLM pattern

```python
import modal

app = modal.App("my-model")

image = modal.Image.debian_slim().pip_install("transformers", "torch")

@app.cls(gpu="T4", image=image, scaledown_window=300)  # 300s idle before shutdown
class Model:
    @modal.enter()               # runs once when container starts
    def load(self):
        from transformers import pipeline
        self.pipe = pipeline("text-generation", model="gpt2", device="cuda")

    @modal.method()              # callable remotely, model stays in VRAM
    def generate(self, text: str) -> str:
        return self.pipe(text, max_new_tokens=50)[0]["generated_text"]
```

Deploy + call:

```python
# in any Python file on your machine
import modal
Model = modal.Cls.from_name("my-model", "Model")
print(Model().generate.remote("Once upon a time"))
```

### 7.2 Secrets (never hardcode API keys)

```bash
modal secret create my-apis OPENAI_API_KEY=sk-... HF_TOKEN=hf_...
```

```python
secret = modal.Secret.from_name("my-apis")

@app.function(secrets=[secret])
def use_api():
    import os
    return os.environ["OPENAI_API_KEY"]  # injected into container env
```

### 7.3 Cloudflare R2 / S3 storage

```python
r2_secret = modal.Secret.from_name(
    "r2-credentials",                                    # modal secret create r2-credentials \
    required_keys=["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]  # AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=...
)

@app.function(
    secrets=[r2_secret],
    volumes={
        "/r2": modal.CloudBucketMount(
            bucket_name="my-bucket",
            bucket_endpoint_url="https://<ACCOUNT_ID>.r2.cloudflarestorage.com",
            secret=r2_secret,
            read_only=True,
        )
    },
)
def read_bucket():
    import os
    print(os.listdir("/r2"))    # files are just... there
```

### 7.4 GPUs — picking the right one

```python
gpu="T4"          # cheapest, ~16GB VRAM — good for small models, TTS, testing
gpu="L4"          # ~24GB, faster
gpu="A10G"        # ~24GB, good mid-range
gpu="A100"        # 40/80GB, serious work
gpu="H100"        # 80GB, the big one
gpu="any"         # Modal picks whatever's available
```

Pricing is on https://modal.com/pricing — check before you pick. T4 ≈ $0.59/hr. You pay per second, only while code runs.

### 7.5 Cron jobs (scheduled tasks)

```python
@app.function(schedule=modal.Cron("0 9 * * *"))   # every day at 9am UTC
def daily_job():
    print("running!")
```

Deploy it — Modal handles the scheduling, zero always-on servers.

---

## 8. What Breaks Coding Agents (and how to fix)

If your agent gets stuck on Modal, check these first:

| Symptom | Fix |
|---|---|
| `modal: command not found` | Install with `pip install modal` (NOT `modal-client` — that's a dead legacy package) |
| `DeprecationError: container_idle_timeout...` | Use `scaledown_window=` instead |
| `mount-s3: No such file or directory` | Don't shell out to mount-s3 — use `modal.CloudBucketMount` natively |
| Warm containers serving old code after deploy | `modal app stop <app> --yes` then redeploy |
| Module missing in container | Add it to the image: `.pip_install("that-module")` |
| Function times out | `@app.function(timeout=600)` — default is short |
| Auth errors / 401 | `modal token new` to refresh |
| Agent uses outdated API | Point it at `modal skills install` docs, and `modal <cmd> --help` |

---

## 9. Quick Reference Card

```bash
# Setup (once)
pip install modal
modal setup
modal skills install --yes          # install agent skill
# budget at https://modal.com/settings/usage

# Daily loop
modal run app.py                    # test in cloud
modal deploy app.py                 # ship it
modal app logs <name>               # debug
modal app stop <name> --yes         # kill
modal shell --gpu T4                # poke around interactively

# When in doubt
modal --help
modal <command> --help
```

---

## 10. What $30 Buys (roughly)

| GPU | ~$/hr | Hours from $30 | Best for |
|---|---|---|---|
| T4 | $0.59 | ~50 hrs | TTS, small models, experiments |
| L4 | $0.80 | ~37 hrs | Mid-size inference |
| A10G | $1.10 | ~27 hrs | Fine-tuning, medium models |
| A100 40GB | $1.90 | ~15 hrs | Big training jobs |
| H100 | $3.95 | ~7.5 hrs | Only if you really need it |

Plus small CPU/RAM charges on top (~$0.02-0.05/hr). You only pay while a container is RUNNING — idle = $0.

---

*Guide generated from a working Modal deployment (Chatterbox TTS on T4 + Cloudflare R2). If something breaks, run `modal <cmd> --help` before anything else.*
