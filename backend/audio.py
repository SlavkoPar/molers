import os
import shutil
import subprocess
import tempfile

M4A_MIME = "audio/mp4"
CONVERT_TIMEOUT_SECONDS = 60


class AudioConversionError(Exception):
    """ffmpeg ran but could not turn the upload into m4a."""


def find_ffmpeg():
    """FFMPEG_PATH, then ffmpeg on PATH, then the binary bundled with imageio-ffmpeg."""
    path = os.environ.get("FFMPEG_PATH")
    if path:
        return path
    path = shutil.which("ffmpeg")
    if path:
        return path
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except (ImportError, RuntimeError):
        return None


def to_amr_wb(data):
    """Re-encode any audio as 16 kHz mono AMR-WB, the format the mobile app records."""
    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        raise AudioConversionError("ffmpeg is not available")

    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "in")
        dst = os.path.join(tmp, "out.amr")
        with open(src, "wb") as f:
            f.write(data)
        try:
            result = subprocess.run(
                [
                    ffmpeg, "-nostdin", "-y", "-i", src,
                    "-vn", "-ac", "1", "-ar", "16000",
                    "-c:a", "libvo_amrwbenc", "-b:a", "23850", dst,
                ],  # fmt: skip
                capture_output=True,
                timeout=CONVERT_TIMEOUT_SECONDS,
            )
        except subprocess.TimeoutExpired:
            raise AudioConversionError("Voice message conversion timed out")
        if result.returncode != 0 or not os.path.exists(dst):
            raise AudioConversionError("Voice message is not a readable audio file")
        with open(dst, "rb") as f:
            return f.read()


def to_m4a(data, mime_type):
    """Return (bytes, mime) with the audio as AAC in an m4a container.

    Audio that is already mp4/m4a is returned untouched. If ffmpeg isn't installed
    the original is kept, so a recording is never lost; a file ffmpeg cannot read
    raises AudioConversionError.
    """
    if mime_type == M4A_MIME:
        return data, mime_type

    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        return data, mime_type

    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "in")
        dst = os.path.join(tmp, "out.m4a")
        with open(src, "wb") as f:
            f.write(data)
        try:
            result = subprocess.run(
                [
                    ffmpeg, "-nostdin", "-y", "-i", src,
                    "-vn", "-c:a", "aac", "-b:a", "64k",
                    "-movflags", "+faststart", dst,
                ],  # fmt: skip
                capture_output=True,
                timeout=CONVERT_TIMEOUT_SECONDS,
            )
        except subprocess.TimeoutExpired:
            raise AudioConversionError("Voice message conversion timed out")
        if result.returncode != 0 or not os.path.exists(dst):
            raise AudioConversionError("Voice message is not a readable audio file")
        with open(dst, "rb") as f:
            converted = f.read()
    if not converted:
        raise AudioConversionError("Voice message is not a readable audio file")
    return converted, M4A_MIME
