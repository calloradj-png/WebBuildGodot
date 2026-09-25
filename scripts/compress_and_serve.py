#!/usr/bin/env python3
"""
Pre-compression and Local Test Server for Godot 4 Web builds.
1. Pre-compresses .wasm, .pck, and .js with Gzip (and Brotli if installed).
2. Serves the web build locally with correct MIME types and Content-Encoding headers.
"""

import os
import sys
import gzip
import http.server
import socketserver
import webbrowser
from pathlib import Path

try:
    import brotli
    HAS_BROTLI = True
except ImportError:
    HAS_BROTLI = False

BUILD_DIR = Path(__file__).resolve().parent.parent / "build" / "web"
PORT = 8060

def compress_build():
    if not BUILD_DIR.exists():
        print(f"[!] Build directory does not exist: {BUILD_DIR}")
        print("Please export the project first using Godot.")
        return

    print("=== Pre-compressing Web Build Files ===")
    targets = [".wasm", ".pck", ".js"]
    total_raw = 0
    total_gzip = 0

    for file_path in BUILD_DIR.iterdir():
        if file_path.suffix in targets and not file_path.name.endswith(".gz") and not file_path.name.endswith(".br"):
            raw_data = file_path.read_bytes()
            raw_size = len(raw_data)
            total_raw += raw_size

            # Gzip
            gz_path = file_path.with_name(file_path.name + ".gz")
            compressed_gz = gzip.compress(raw_data, compresslevel=9)
            gz_path.write_bytes(compressed_gz)
            gz_size = len(compressed_gz)
            total_gzip += gz_size

            status = f"  {file_path.name}: {raw_size / 1024 / 1024:.2f} MB -> Gzip: {gz_size / 1024 / 1024:.2f} MB (-{(1 - gz_size / raw_size) * 100:.1f}%)"

            # Brotli
            if HAS_BROTLI:
                br_path = file_path.with_name(file_path.name + ".br")
                compressed_br = brotli.compress(raw_data, quality=11)
                br_path.write_bytes(compressed_br)
                br_size = len(compressed_br)
                status += f" -> Brotli: {br_size / 1024 / 1024:.2f} MB (-{(1 - br_size / raw_size) * 100:.1f}%)"

            print(status)

    print(f"\nTotal: {total_raw / 1024 / 1024:.2f} MB -> Gzip: {total_gzip / 1024 / 1024:.2f} MB")
    if not HAS_BROTLI:
        print("[Tip] Run `python -m pip install brotli` for even higher Brotli compression ratios!")

class FastDeliveryHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BUILD_DIR), **kwargs)

    def end_headers(self):
        # Enable CORS and isolation headers
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self):
        # Transparently serve .br or .gz if supported by client
        accept_encoding = self.headers.get("Accept-Encoding", "")
        req_path = self.translate_path(self.path)

        if os.path.isfile(req_path):
            if HAS_BROTLI and "br" in accept_encoding and os.path.exists(req_path + ".br"):
                self.send_response(200)
                self.send_header("Content-Encoding", "br")
                self.send_header("Content-Type", self.guess_type(req_path))
                self.end_headers()
                with open(req_path + ".br", "rb") as f:
                    self.copyfile(f, self.wfile)
                return
            elif "gzip" in accept_encoding and os.path.exists(req_path + ".gz"):
                self.send_response(200)
                self.send_header("Content-Encoding", "gzip")
                self.send_header("Content-Type", self.guess_type(req_path))
                self.end_headers()
                with open(req_path + ".gz", "rb") as f:
                    self.copyfile(f, self.wfile)
                return

        return super().do_GET()

def run_server():
    compress_build()
    print(f"\n[*] Starting fast local test server at http://localhost:{PORT}/")
    webbrowser.open(f"http://localhost:{PORT}/")
    with socketserver.TCPServer(("", PORT), FastDeliveryHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == "__main__":
    run_server()
