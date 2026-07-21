# Complete corresponding Qwasm source

This directory accompanies the distributed `qwasm-gl.js` / `qwasm-gl.wasm` engine and contains the complete Qwasm source tree used for the build, including its Makefiles and GPL notices.

Reassemble and extract on macOS or Linux:

```sh
cat qwasm-source-f56b5e7.tar.gz.part* > qwasm-source-f56b5e7.tar.gz
sha256sum qwasm-source-f56b5e7.tar.gz
tar -xzf qwasm-source-f56b5e7.tar.gz
```

Expected SHA-256:

`765f3dfd90401d0abf987ea8d7d48a5585899d4e3332642edbc7f1a4a602f922`

The split is only to keep individual static-hosting files small. Concatenating the numbered pieces restores the normal gzip-compressed tar archive byte-for-byte.
