use reitero_decode::{Decoder, VideoReader, DecodeError};
use wasm_bindgen::prelude::*;

type DecodeResult<T> = Result<T, DecodeError>;

struct OwnedSliceReader {
    data: Vec<u8>,
    pos: usize,
}

impl OwnedSliceReader {
    fn new(data: Vec<u8>) -> Self {
        Self { data, pos: 0 }
    }
}

impl VideoReader for OwnedSliceReader {
    fn read(&mut self, buf: &mut [u8]) -> DecodeResult<usize> {
        let remaining = &self.data[self.pos..];
        let n = buf.len().min(remaining.len());
        buf[..n].copy_from_slice(&remaining[..n]);
        self.pos += n;
        Ok(n)
    }

    fn position(&mut self) -> u64 {
        self.pos as u64
    }

    fn seek(&mut self, pos: u64) -> DecodeResult<()> {
        let p = pos as usize;
        if p > self.data.len() {
            return Err(DecodeError::DecodingFailed("seek out of bounds".into()));
        }
        self.pos = p;
        Ok(())
    }
}

/// A single decoded frame handed back to JS.
#[wasm_bindgen]
pub struct RivFrame {
    data: Vec<u8>,
    width: u32,
    height: u32,
    timestamp_ms: u32,
    frame_index: u32,
}

#[wasm_bindgen]
impl RivFrame {
    /// RGB24 pixel data as a Uint8Array view.
    pub fn data(&self) -> js_sys::Uint8Array {
        unsafe { js_sys::Uint8Array::view(&self.data) }
    }
    pub fn width(&self) -> u32 { self.width }
    pub fn height(&self) -> u32 { self.height }
    pub fn timestamp_ms(&self) -> u32 { self.timestamp_ms }
    pub fn frame_index(&self) -> u32 { self.frame_index }
}

/// Streaming player — decodes one frame at a time, never holds more than one
/// decoded frame in memory.
///
/// JS usage:
/// ```js
/// const player = RivPlayer.load(uint8Array);
/// player.fps(); player.width(); player.height(); player.frame_count();
/// const frame = player.next_frame(); // null at end of stream
/// player.rewind();                   // seek back to first frame
/// ```
#[wasm_bindgen]
pub struct RivPlayer {
    // Raw encoded bytes kept for rewinding.
    raw: Vec<u8>,
    decoder: Decoder<OwnedSliceReader>,
    fps: u32,
    width: u32,
    height: u32,
    frame_count: u64,
}

#[wasm_bindgen]
impl RivPlayer {
    pub fn load(data: &[u8]) -> Result<RivPlayer, JsError> {
        let raw = data.to_vec();
        let reader = OwnedSliceReader::new(raw.clone());
        let decoder = Decoder::new(reader).map_err(|e| JsError::new(&e.to_string()))?;

        let h = decoder.header().clone();
        Ok(RivPlayer {
            raw,
            fps: h.fps,
            width: h.display_width,
            height: h.display_height,
            frame_count: h.frame_count,
            decoder,
        })
    }

    /// Decode and return the next frame, or `null` at end of stream.
    pub fn next_frame(&mut self) -> Option<RivFrame> {
        if !self.decoder.has_more_frames() {
            return None;
        }
        let f = self.decoder.decode_frame().ok()?;
        Some(RivFrame {
            data: f.data,
            width: f.width,
            height: f.height,
            timestamp_ms: f.timestamp as u32,
            frame_index: f.frame_index as u32,
        })
    }

    /// Restart from the first frame.
    pub fn rewind(&mut self) -> Result<(), JsError> {
        let reader = OwnedSliceReader::new(self.raw.clone());
        self.decoder = Decoder::new(reader).map_err(|e| JsError::new(&e.to_string()))?;
        Ok(())
    }

    pub fn fps(&self) -> u32 { self.fps }
    pub fn width(&self) -> u32 { self.width }
    pub fn height(&self) -> u32 { self.height }
    /// Frame count from the file header (may be 0 if not written by encoder).
    pub fn frame_count(&self) -> u32 { self.frame_count as u32 }
}
