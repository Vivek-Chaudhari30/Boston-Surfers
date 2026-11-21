"""Board-hosted LED reward demo. Run on UNO Q, access through adb USB forwarding."""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import threading
import time
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
LED = Path("/sys/class/leds/green:user/brightness")
ID_PATTERN = re.compile(r"[A-Za-z0-9]{1,12}\Z")


class RewardLight:
    def __init__(self, path=LED):
        self.path = path
        self.lock = threading.Lock()
        self.last_id = None
        self.count = 0
        self.busy = False
        self.path.write_text("0")

    def status(self):
        return {"connected": True, "device": "Arduino UNO Q", "mode": "led-only",
                "led": "green:user", "brightness": int(self.path.read_text().strip()),
                "busy": self.busy, "count": self.count, "lastId": self.last_id}

    def reward(self, reward_id):
        if not self.lock.acquire(blocking=False):
            return 409, {"ok": False, "code": "BUSY", "error": "A reward light is already running"}
        try:
            if reward_id == self.last_id:
                return 200, {"ok": True, "id": reward_id, "duplicate": True,
                             "count": self.count, "mode": "led-only"}
            self.busy = True
            try:
                self.path.write_text("1")
                time.sleep(1.2)
            finally:
                self.path.write_text("0")
                self.busy = False
            self.last_id = reward_id
            self.count += 1
            return 200, {"ok": True, "id": reward_id, "duplicate": False,
                         "count": self.count, "mode": "led-only"}
        finally:
            self.busy = False
            self.lock.release()


def make_handler(device):
    class Handler(BaseHTTPRequestHandler):
        def respond(self, status, payload):
            body = json.dumps(payload).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            path = urlparse(self.path).path
            if path == "/":
                body = (ROOT / "index.html").read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            elif path == "/api/status":
                try:
                    self.respond(200, device.status())
                except OSError as error:
                    self.respond(503, {"connected": False, "error": str(error)})
            else:
                self.respond(404, {"error": "Not found"})

        def do_POST(self):
            if self.path != "/api/reward":
                return self.respond(404, {"error": "Not found"})
            origin = self.headers.get("Origin")
            if origin and origin != "http://" + self.headers.get("Host", ""):
                return self.respond(403, {"error": "Use this panel's own origin"})
            if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                return self.respond(415, {"error": "Expected application/json"})
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 1 <= length <= 256:
                    return self.respond(400, {"error": "Invalid request size"})
                payload = json.loads(self.rfile.read(length))
                reward_id = payload.get("id") if isinstance(payload, dict) else None
                if not isinstance(reward_id, str) or not ID_PATTERN.fullmatch(reward_id):
                    return self.respond(400, {"error": "id must be 1–12 ASCII letters/digits"})
            except (ValueError, UnicodeError):
                return self.respond(400, {"error": "Invalid JSON request"})
            try:
                status, payload = device.reward(reward_id)
                self.respond(status, payload)
            except OSError as error:
                self.respond(503, {"ok": False, "error": str(error)})

    return Handler


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    device = RewardLight()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(device))
    print(f"UNO Q LED demo listening on board localhost:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        LED.write_text("0")
        server.server_close()
