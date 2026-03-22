#!/usr/bin/env python3
"""Simple HTTP server with no-cache headers for dev iteration."""

import http.server
import socketserver
import os

PORT = 8081
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def send_cache_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
    
    def end_headers(self):
        self.send_cache_headers()
        super().end_headers()
    
    def do_GET(self):
        # Add timestamp to force reload
        if self.path.endswith('.html') or self.path.endswith('.js') or self.path.endswith('.css'):
            self.send_cache_headers()
        super().do_GET()

if __name__ == '__main__':
    with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:
        print(f"🚀 Serving NeuroGraph from: {DIRECTORY}")
        print(f"📍 URL: http://localhost:{PORT}/")
        print(f"🔌 API: http://localhost:18787/api/neurograph/")
        print("Press Ctrl+C to stop")
        httpd.serve_forever()
