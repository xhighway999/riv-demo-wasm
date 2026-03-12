# riv-demo-wasm

**[▶ Live demo](https://coffeecupentertainment.com/static/riv2-player/index.html?bbb.riv)**

Minimal WASM player for the [RIV codec](https://github.com/xhighway999/riv2). Drop a `.riv` file in the browser, or pass one via URL:

```
index.html?your-video.riv
index.html?https://example.com/your-video.riv
```

`bbb.riv` (Big Buck Bunny clip) is bundled for out-of-the-box testing.

---

## Build

Requires [`wasm-pack`](https://rustwasm.github.io/wasm-pack/).

```sh
CARGO_NET_GIT_FETCH_WITH_CLI=true wasm-pack build --target web --release
```

Then serve the directory with any static file server (WASM requires correct MIME type):

```sh
python3 -m http.server 8080
```

---

## License

MIT OR Unlicense, at your option.
