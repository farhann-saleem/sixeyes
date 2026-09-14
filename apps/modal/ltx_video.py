"""marketing-studio-ltx — LTX-2.5 image-to-video on Modal.

Port of youtube/automation/avatar-docs/modal/ltx_video.py.
Do not overwrite goldmine app avatar-ltx. Do not load R2 Comfy distilled LTX.

Contract:
    generate(frame_bytes, prompt, duration_s, aspect, seed, output_id)
        -> filename on volume marketing-studio-ltx-outputs (not bytes)

Deploy:
    source .venv/bin/activate
    modal deploy apps/modal/ltx_video.py

Smoke (5s):
    modal run apps/modal/ltx_video.py
"""

from __future__ import annotations

import os
from pathlib import Path

import modal

def _load_local_env() -> None:
    """Read repo .env on the laptop only. Container path is /root/ltx_video.py — do not walk parents[2]."""
    if not modal.is_local():
        return
    for parent in Path(__file__).resolve().parents:
        candidate = parent / ".env"
        if candidate.is_file():
            for _line in candidate.read_text().splitlines():
                _line = _line.strip()
                if _line and not _line.startswith("#") and "=" in _line:
                    _k, _v = _line.split("=", 1)
                    os.environ.setdefault(_k.strip(), _v.strip())
            return


_load_local_env()

R2_BUCKET = os.environ.get("R2_BUCKET", "comfy")
R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID")
R2_MOUNT_PATH = "/r2"
# H100 80GB OOMs on a full .to("cuda") (~76.7 GiB). Sequential offload =
# ~40s/step. H200 141GB / B200 keep the whole pipe on GPU (goldmine ~60s path).
_GPU_ENV = os.environ.get("MS_LTX_GPU")
GPU = _GPU_ENV.split(",") if _GPU_ENV else ["H200", "B200"]
MODEL_ID = "Lightricks/LTX-2.5-Diffusers"
INFERENCE_STEPS = 20  # goldmine used 20 for speed; 30 is quality-only

if modal.is_local() and not R2_ACCOUNT_ID:
    raise RuntimeError("R2_ACCOUNT_ID missing from repo .env (needed for CloudBucketMount).")

MINUTES = 60
image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg", "libsndfile1", "git")
    .uv_pip_install(
        "accelerate",
        "av",
        "diffusers @ git+https://github.com/huggingface/diffusers",
        "huggingface-hub",
        "pillow",
        "sentencepiece",
        "soundfile",
        "torch",
        "torchvision",
        "transformers",
    )
    .env(
        {
            "HF_XET_HIGH_PERFORMANCE": "1",
            "HF_HUB_CACHE": "/models",
            "PYTORCH_CUDA_ALLOC_CONF": "expandable_segments:True",
            "PYTHONUNBUFFERED": "1",
            "R2_ACCOUNT_ID": R2_ACCOUNT_ID,
            "R2_BUCKET": R2_BUCKET,
        }
    )
)

app = modal.App("marketing-studio-ltx")

r2_secret = modal.Secret.from_name(
    "r2-credentials",
    required_keys=["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"],
)
hf_secret = modal.Secret.from_name("huggingface")

model_volume = modal.Volume.from_name("marketing-studio-ltx-models", create_if_missing=True)
output_volume = modal.Volume.from_name("marketing-studio-ltx-outputs", create_if_missing=True)

MODEL_PATH = "/models"
OUTPUT_PATH = "/outputs"

# All dimensions must be divisible by 32 (LTX requirement).
ASPECT_SIZES = {
    "16:9": (960, 544),
    "21:9": (960, 416),
    "9:16": (544, 960),
    "1:1": (544, 544),
    "4:3": (672, 512),
}

FPS = 24


def _frames_for_duration(duration_s: int) -> int:
    """Smallest 8k+1 frame count that covers duration_s at FPS (ceil, not shorten)."""
    raw = max(9, int(duration_s * FPS))
    if (raw - 1) % 8 == 0:
        return raw
    return ((raw - 1) // 8 + 1) * 8 + 1


def _hf_cache_ready() -> bool:
    root = Path(MODEL_PATH)
    return any(root.glob("models--Lightricks--LTX-2.5-Diffusers"))


@app.cls(
    gpu=GPU,
    image=image,
    secrets=[r2_secret, hf_secret],
    timeout=15 * MINUTES,
    scaledown_window=10 * MINUTES,
    volumes={
        R2_MOUNT_PATH: modal.CloudBucketMount(
            bucket_name=R2_BUCKET,
            bucket_endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            secret=r2_secret,
            read_only=True,
        ),
        MODEL_PATH: model_volume,
        OUTPUT_PATH: output_volume,
    },
)
class LTXVideo:
    """Stateful LTX-2.5 I2V worker: pipeline stays warm between calls."""

    @modal.enter()
    def load_pipeline(self):
        print(f"Loading {MODEL_ID} ...")
        import torch
        from diffusers import LTX2ImageToVideoPipeline

        cache_ready = _hf_cache_ready()
        gpu_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "none"
        vram_gb = torch.cuda.get_device_properties(0).total_memory / 1e9 if torch.cuda.is_available() else 0
        print(f"HF cache ready={cache_ready} gpu={gpu_name} vram_gb={vram_gb:.1f}")
        torch.backends.cuda.matmul.allow_tf32 = True
        torch.backends.cudnn.allow_tf32 = True
        load_kw = dict(local_files_only=cache_ready)
        try:
            self.pipe = LTX2ImageToVideoPipeline.from_pretrained(
                MODEL_ID, dtype=torch.bfloat16, **load_kw
            )
        except TypeError:
            self.pipe = LTX2ImageToVideoPipeline.from_pretrained(
                MODEL_ID, torch_dtype=torch.bfloat16, **load_kw
            )
        # Do not sequential-offload. That was 1233s for 5s. Need ≥~80GB free VRAM.
        self.pipe.to("cuda")
        model_volume.commit()
        used = torch.cuda.memory_allocated() / 1e9
        print(f"Pipeline on cuda (no offload). allocated_gb={used:.1f}")

    @modal.method()
    def generate(
        self,
        frame_bytes: bytes,
        prompt: str,
        duration_s: int = 5,
        aspect: str = "16:9",
        seed: int = 42,
        output_id: str = "clip",
        negative_prompt: str = "",
    ) -> str:
        """Generate one I2V clip. Returns the output filename on the volume."""
        import io
        import time

        import torch
        from diffusers.utils import encode_video, load_image
        from PIL import Image

        width, height = ASPECT_SIZES.get(aspect, (960, 544))
        num_frames = _frames_for_duration(duration_s)

        print(
            f"[{output_id}] seed={seed} {width}x{height} frames={num_frames} "
            f"fps={FPS} steps={INFERENCE_STEPS} gpu={torch.cuda.get_device_name(0)}"
        )
        t0 = time.time()

        img = load_image(Image.open(io.BytesIO(frame_bytes)))

        call_kwargs = dict(
            image=img,
            prompt=prompt,
            width=width,
            height=height,
            num_frames=num_frames,
            frame_rate=float(FPS),
            num_inference_steps=INFERENCE_STEPS,
            guidance_scale=3.0,
            audio_guidance_scale=7.0,
            stg_scale=1.0,
            modality_scale=3.0,
            generator=torch.Generator("cuda").manual_seed(seed),
            output_type="np",
            return_dict=False,
        )
        if negative_prompt:
            call_kwargs["negative_prompt"] = negative_prompt

        try:
            result = self.pipe(**call_kwargs)
        except Exception as e:
            raise RuntimeError(f"LTX generate failed: {type(e).__name__}: {e}") from None
        video = result[0]
        audio = result[1] if len(result) > 1 else None

        mp4_name = f"{output_id}_{seed}.mp4"
        out_path = str(Path(OUTPUT_PATH) / mp4_name)

        encode_kwargs = dict(video=video[0], fps=FPS, output_path=out_path)
        if audio is not None and len(audio) > 0:
            try:
                encode_kwargs["audio"] = audio[0].float().cpu()
                encode_kwargs["audio_sample_rate"] = self.pipe.vocoder.config.output_sampling_rate
            except Exception as e:
                print(f"[{output_id}] audio encode skipped: {e}")
        encode_video(**encode_kwargs)

        output_volume.commit()
        torch.cuda.empty_cache()

        elapsed = time.time() - t0
        print(f"[{output_id}] done in {elapsed:.0f}s -> {mp4_name}")
        return mp4_name


def _smoke_frame_bytes() -> bytes:
    """Local seed image. Wikimedia 403s datacenter UAs; do not depend on it."""
    import io

    from PIL import Image, ImageDraw

    local_dir = Path(__file__).resolve().parent / "out"
    local_dir.mkdir(exist_ok=True)
    seed_path = local_dir / "seed.jpg"
    if seed_path.exists() and seed_path.stat().st_size > 1000:
        return seed_path.read_bytes()

    img = Image.new("RGB", (960, 544), (92, 148, 196))
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 280, 960, 544), fill=(62, 120, 58))
    draw.polygon([(380, 544), (480, 260), (580, 544)], fill=(138, 104, 62))
    draw.ellipse((720, 40, 820, 140), fill=(255, 220, 120))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    data = buf.getvalue()
    seed_path.write_bytes(data)
    return data


@app.local_entrypoint()
def main():
    """Smoke: 5s I2V. Writes apps/modal/out/ (gitignored)."""
    print("Smoke: 5s LTX-2.5 I2V")
    frame = _smoke_frame_bytes()

    out = LTXVideo().generate.remote(
        frame_bytes=frame,
        prompt=(
            "slow camera push in over a wooden boardwalk, gentle wind rustles tall grass, "
            "warm golden afternoon light. Audio: soft wind, distant birdsong."
        ),
        duration_s=5,
        seed=1234,
        output_id="smoke_5s_fast",
    )
    print(f"Volume file: {out}")
    local_dir = Path(__file__).resolve().parent / "out"
    local_dir.mkdir(exist_ok=True)
    dest = local_dir / out
    try:
        dest.write_bytes(b"".join(output_volume.read_file(out)))
    except Exception as e:
        print(f"volume.read_file failed ({e}); try: modal volume get marketing-studio-ltx-outputs {out} {dest}")
        raise
    print(f"Saved {dest}")
