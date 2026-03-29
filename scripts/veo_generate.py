#!/usr/bin/env python3
"""
Standalone Veo video generation script using the official Google GenAI SDK.

Modes:
  Text-to-video  : Gemini API (--api-key)
  Image-to-video : Gemini API (--api-key + --image)
  Video-to-video : Vertex AI  (--project + --video)  ← requires gcloud auth

Install:
    pip3 install google-genai

Setup for video-to-video (Vertex AI):
    gcloud auth application-default login

Usage:
    # text-to-video
    python3 veo_generate.py --prompt "Cinematic car" --api-key YOUR_KEY

    # image-to-video
    python3 veo_generate.py --prompt "..." --image frame.jpg --api-key YOUR_KEY

    # video-to-video (Vertex AI)
    python3 veo_generate.py --prompt "..." --video input.mp4 --project YOUR_GCP_PROJECT
"""

import argparse
import mimetypes
import os
import sys
import time
from pathlib import Path

try:
    from google import genai
    from google.genai import types
except ImportError:
    print("Error: google-genai not installed. Run: pip3 install google-genai", file=sys.stderr)
    sys.exit(1)


GEMINI_MODEL = "veo-3.0-generate-preview"
VERTEX_MODEL = "veo-2.0-generate-001"   # Vertex AI Veo 2 supports video input


def main():
    parser = argparse.ArgumentParser(description="Generate a video with Veo")
    parser.add_argument("--prompt",   required=True, help="Text prompt")
    parser.add_argument("--image",    default=None,  help="Reference image (image-to-video, Gemini API)")
    parser.add_argument("--video",    default=None,  help="Reference video (video-to-video, requires --project)")
    parser.add_argument("--duration", default=5,     type=int, choices=[5, 8], help="Duration in seconds (default 5)")
    parser.add_argument("--output",   default=None,  help="Output file path")
    parser.add_argument("--api-key",  default=None,  help="Google AI API key (Gemini API)")
    parser.add_argument("--project",  default=None,  help="GCP project ID (required for --video / Vertex AI)")
    parser.add_argument("--location", default="us-central1", help="Vertex AI region (default us-central1)")
    parser.add_argument("--dry-run",  action="store_true", help="Print request without calling API (no cost)")
    args = parser.parse_args()

    use_vertex = bool(args.video or args.project)

    if use_vertex and not args.project:
        print("Error: --project is required for video-to-video (Vertex AI)", file=sys.stderr)
        sys.exit(1)

    if not use_vertex:
        api_key = args.api_key or os.environ.get("GOOGLE_AI_API_KEY")
        if not api_key:
            print("Error: provide --api-key or set GOOGLE_AI_API_KEY", file=sys.stderr)
            sys.exit(1)

    for label, path in [("video", args.video), ("image", args.image)]:
        if path and not Path(path).exists():
            print(f"Error: {label} file not found: {path}", file=sys.stderr)
            sys.exit(1)

    output = args.output or f"output_{int(time.time())}.mp4"

    print(f"[veo] Mode     : {'Vertex AI (video-to-video)' if use_vertex else 'Gemini API'}")
    print(f"[veo] Model    : {VERTEX_MODEL if use_vertex else GEMINI_MODEL}")
    print(f"[veo] Prompt   : {args.prompt[:120]}{'...' if len(args.prompt) > 120 else ''}")
    print(f"[veo] Duration : {args.duration}s")
    print(f"[veo] Video    : {args.video or 'none'}")
    print(f"[veo] Image    : {args.image or 'none'}")

    if args.dry_run:
        print(f"\n[dry-run] Output would be: {output}")
        print("[dry-run] No API call made.")
        return

    # Build client
    if use_vertex:
        client = genai.Client(vertexai=True, project=args.project, location=args.location)
        model = VERTEX_MODEL
    else:
        client = genai.Client(api_key=api_key)
        model = GEMINI_MODEL

    config = types.GenerateVideosConfig(
        aspect_ratio="16:9",
        duration_seconds=args.duration,
        number_of_videos=1,
    )

    kwargs = dict(model=model, prompt=args.prompt, config=config)

    if args.video:
        mime, _ = mimetypes.guess_type(args.video)
        mime = mime or "video/mp4"
        print(f"[veo] Uploading reference video...")
        f = client.files.upload(file=args.video, config={"mime_type": mime})
        print(f"[veo] Uploaded: {f.uri}")
        kwargs["video"] = types.Video(uri=f.uri)

    elif args.image:
        mime, _ = mimetypes.guess_type(args.image)
        mime = mime or "image/jpeg"
        print(f"[veo] Uploading reference image...")
        f = client.files.upload(file=args.image, config={"mime_type": mime})
        print(f"[veo] Uploaded: {f.uri}")
        kwargs["image"] = types.Image(uri=f.uri)

    print(f"[veo] Starting generation...")
    operation = client.models.generate_videos(**kwargs)

    attempt = 0
    while not operation.done:
        attempt += 1
        time.sleep(5)
        print(f"[veo] Polling... attempt {attempt}", end="\r", flush=True)
        operation = client.operations.get(operation)

    print()

    if not operation.response or not operation.response.generated_videos:
        print(f"[veo] No videos in response: {operation}", file=sys.stderr)
        sys.exit(1)

    video = operation.response.generated_videos[0].video
    print(f"[veo] Video URI: {video.uri}")
    print(f"[veo] Downloading...")

    client.files.download(file=video.uri, download_to=output)
    size_mb = Path(output).stat().st_size / (1024 * 1024)
    print(f"[veo] Saved to: {output} ({size_mb:.1f} MB)")
    print(f"[veo] Done!")


if __name__ == "__main__":
    main()
