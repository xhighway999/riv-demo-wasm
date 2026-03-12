import init, { RivPlayer } from "./pkg/riv_demo_wasm.js";

await init();

const drop      = document.getElementById("drop");
const fileInput = document.getElementById("file-input");
const canvas    = document.getElementById("canvas");
const ctx       = canvas.getContext("2d");
const controls  = document.getElementById("controls");
const btnPlay   = document.getElementById("btn-play");
const info      = document.getElementById("info");

let player = null;
let playing = false;
let rafId = null;
let lastTime = null;
let accumMs = 0;
let frameIndex = 0;
// One reusable ImageData, reallocated only on resolution change.
let imageData = null;

function loadBytes(bytes) {
    if (player) player.free();
    player = RivPlayer.load(bytes);

    canvas.width  = player.width();
    canvas.height = player.height();
    imageData = new ImageData(player.width(), player.height());
    canvas.style.display = "";
    controls.style.display = "";
    frameIndex = 0;
    accumMs = 0;
    lastTime = null;

    // Show first frame and start playing immediately.
    pullAndDraw();
    startPlay();
}

function pullAndDraw() {
    const f = player.next_frame();
    if (!f) return false;

    const rgb = f.data();   // Uint8Array view, RGB24
    const w = f.width(), h = f.height();
    const rgba = imageData.data;

    for (let i = 0; i < w * h; i++) {
        rgba[i * 4]     = rgb[i * 3];
        rgba[i * 4 + 1] = rgb[i * 3 + 1];
        rgba[i * 4 + 2] = rgb[i * 3 + 2];
        rgba[i * 4 + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);

    frameIndex = f.frame_index();
    const total = player.frame_count();
    info.textContent = total
        ? `frame ${frameIndex + 1} / ${total}  |  ${player.fps()} fps  |  ${w}×${h}`
        : `frame ${frameIndex + 1}  |  ${player.fps()} fps  |  ${w}×${h}`;

    f.free();
    return true;
}

function tick(ts) {
    if (!playing) return;

    if (lastTime !== null) {
        const dt = ts - lastTime;
        accumMs += dt;
        const frameDuration = 1000 / player.fps();

        while (accumMs >= frameDuration) {
            accumMs -= frameDuration;
            const ok = pullAndDraw();
            if (!ok) {
                // End of stream — loop.
                player.rewind();
                frameIndex = 0;
                pullAndDraw();
            }
        }
    }
    lastTime = ts;
    rafId = requestAnimationFrame(tick);
}

function startPlay() {
    if (playing) return;
    playing = true;
    btnPlay.textContent = "⏸ pause";
    lastTime = null;
    accumMs = 0;
    rafId = requestAnimationFrame(tick);
}

btnPlay.addEventListener("click", () => {
    if (!player) return;
    playing = !playing;
    btnPlay.textContent = playing ? "⏸ pause" : "▶ play";
    if (playing) {
        lastTime = null;
        accumMs = 0;
        rafId = requestAnimationFrame(tick);
    } else {
        cancelAnimationFrame(rafId);
    }
});

// Drag and drop / file picker
drop.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file) file.arrayBuffer().then(buf => loadBytes(new Uint8Array(buf)));
});
drop.addEventListener("dragover",  e => { e.preventDefault(); drop.classList.add("over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", e => {
    e.preventDefault();
    drop.classList.remove("over");
    const file = e.dataTransfer.files[0];
    if (file) file.arrayBuffer().then(buf => loadBytes(new Uint8Array(buf)));
});

// Auto-load a video from the query string: index.html?path/to/video.riv
const videoUrl = location.search.slice(1);
if (videoUrl) {
    const res = await fetch(videoUrl);
    const total = parseInt(res.headers.get("Content-Length") || "0", 10);
    const reader = res.body.getReader();
    const chunks = [];
    let loaded = 0;

    const fmt = n => n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : (n / 1024).toFixed(0) + " KB";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.byteLength;
        drop.textContent = total
            ? `loading… ${fmt(loaded)} / ${fmt(total)}`
            : `loading… ${fmt(loaded)}`;
    }

    const buf = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) { buf.set(chunk, offset); offset += chunk.byteLength; }
    loadBytes(buf);
}
