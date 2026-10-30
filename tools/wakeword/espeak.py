"""espeak-ng speech through its C API (the library and voices come from the espeakng-loader wheel; no binary needed)."""
import ctypes
import numpy as np
import espeakng_loader

_lib = ctypes.cdll.LoadLibrary(espeakng_loader.get_library_path())
_SYNCH = 2                       # AUDIO_OUTPUT_SYNCHRONOUS
_rate = _lib.espeak_Initialize(_SYNCH, 0, espeakng_loader.get_data_path().encode(), 0)
if _rate <= 0:
    raise RuntimeError("espeak-ng did not start")
SAMPLE_RATE = _rate              # 22050

_CB = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.c_void_p)
_buf: list[np.ndarray] = []


@_CB
def _collect(wav, n, events):
    if n > 0 and wav:
        _buf.append(np.ctypeslib.as_array(wav, shape=(n,)).copy())
    return 0


_lib.espeak_SetSynthCallback(_collect)
_RATE, _VOLUME, _PITCH, _RANGE = 1, 2, 3, 4
_CHARS_UTF8 = 1


def say(text: str, voice: str = "en-us", rate: int = 170, pitch: int = 50, pitch_range: int = 50) -> np.ndarray:
    """float32 audio at SAMPLE_RATE."""
    if _lib.espeak_SetVoiceByName(voice.encode()) != 0:
        raise ValueError(f"no espeak voice {voice}")
    _lib.espeak_SetParameter(_RATE, rate, 0)
    _lib.espeak_SetParameter(_PITCH, pitch, 0)
    _lib.espeak_SetParameter(_RANGE, pitch_range, 0)
    _lib.espeak_SetParameter(_VOLUME, 100, 0)
    _buf.clear()
    data = text.encode("utf-8") + b"\0"
    _lib.espeak_Synth(data, len(data), 0, 0, 0, _CHARS_UTF8, None, None)
    _lib.espeak_Synchronize()
    if not _buf:
        return np.zeros(0, dtype=np.float32)
    return (np.concatenate(_buf).astype(np.float32) / 32768.0)
