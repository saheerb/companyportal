#!/bin/bash
PROMPT="Modify the background of this video to a Modern interrogation room. Maintain absolute character consistency: keep the same people, their exact facial features, clothing, and hair. Preserve original motion: the dialogue, lip-syncing, and hand gestures must remain identical to the source video. Only replace the environment with better lighting and noise reduction."

python3 scripts/veo_generate.py \
    --prompt "$PROMPT" \
    --video 1.MP4 \
    --duration 5 \
    --output result.mp4 \
    --api-key AIzaSyCTDKh5ekQHyhyiEIy0NlmHQeGKvwXkwTw
