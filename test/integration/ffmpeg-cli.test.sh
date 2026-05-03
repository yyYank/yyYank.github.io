#!/usr/bin/env bash
# Run the exact ffmpeg commands used by the movie components against a real
# ffmpeg binary inside Docker, to catch argument-level mistakes that ffmpeg.wasm
# would also reject.

set -euo pipefail

cd "$(dirname "$0")/../.."

FIXTURE_DIR="test/fixtures"
WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

if [[ ! -f "$FIXTURE_DIR/sample.mp4" ]]; then
  echo "Generating fixture sample.mp4..."
  docker run --rm -v "$(pwd)/$FIXTURE_DIR:/work" -w /work linuxserver/ffmpeg:latest \
    -y -f lavfi -i "testsrc=duration=3:size=320x240:rate=15" \
    -f lavfi -i "sine=frequency=1000:duration=3" \
    -c:v libx264 -c:a aac -t 3 sample.mp4 >/dev/null 2>&1
fi

cp "$FIXTURE_DIR/sample.mp4" "$WORK_DIR/input.mp4"

run_ffmpeg() {
  docker run --rm -v "$WORK_DIR:/work" -w /work linuxserver/ffmpeg:latest "$@" >/dev/null 2>&1
}

assert_file() {
  local f="$1"
  if [[ ! -s "$WORK_DIR/$f" ]]; then
    echo "FAIL: $f missing or empty"
    exit 1
  fi
}

echo "Test 1: streamCopyTrim args"
run_ffmpeg -ss 0.500 -t 1.500 -i input.mp4 -c copy trimmed-copy.mp4
assert_file trimmed-copy.mp4

echo "Test 2: encodeToMp4 args (mpeg4 + aac)"
run_ffmpeg -i trimmed-copy.mp4 \
  -map "0:v:0?" -map "0:a:0?" \
  -c:v mpeg4 -c:a aac \
  re-encoded.mp4
assert_file re-encoded.mp4

echo "Test 3: encodeToMp4 on full file (no trim)"
run_ffmpeg -i input.mp4 \
  -map "0:v:0?" -map "0:a:0?" \
  -c:v mpeg4 -c:a aac \
  full-encoded.mp4
assert_file full-encoded.mp4

echo "All ffmpeg CLI tests passed."
