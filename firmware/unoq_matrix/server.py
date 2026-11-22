"""UNO Q native HTTP → Arduino Router → blue LED matrix. No external Python packages."""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import re
import threading
import time
import zlib
from rpc import call

ID = re.compile(r'[A-Za-z0-9]{1,12}\Z')


class MatrixDevice:
    def __init__(self):
        self.lock = threading.Lock()
        self.completed = set()
        self.last_id = None

    def status(self):
        if call('cb_matrix_status', 0) != 20261121:
            raise RuntimeError('Matrix firmware is not ready')
        return {'connected': True, 'device': 'Arduino UNO Q', 'mode': 'matrix-only',
                'busy': bool(call('cb_matrix_status', 1)),
                'count': call('cb_matrix_status', 3), 'lastId': self.last_id}

    def reward(self, reward_id):
        if not ID.fullmatch(reward_id):
            return 400, {'ok': False, 'error': 'Invalid animation id'}
        if not self.lock.acquire(blocking=False):
            return 409, {'ok': False, 'error': 'Matrix is playing', 'code': 'BUSY'}
        try:
            if reward_id in self.completed:
                return 200, {'ok': True, 'id': reward_id, 'duplicate': True, 'mode': 'matrix-only'}
            number = (zlib.crc32(reward_id.encode()) & 0x7fffffff) or 1
            started = call('cb_matrix_start', number)
            if started == 0:
                return 409, {'ok': False, 'error': 'Matrix is busy', 'code': 'BUSY'}
            if started not in (1, 2):
                raise RuntimeError('MCU rejected animation')
            deadline = time.monotonic() + 5
            while time.monotonic() < deadline:
                if call('cb_matrix_status', 2) == number:
                    self.completed.add(reward_id)
                    self.last_id = reward_id
                    return 200, {'ok': True, 'id': reward_id, 'duplicate': started == 2,
                                 'count': call('cb_matrix_status', 3), 'mode': 'matrix-only'}
                time.sleep(0.1)
            raise TimeoutError('Matrix did not acknowledge completion')
        finally:
            self.lock.release()


def handler(device):
    class Handler(BaseHTTPRequestHandler):
        def respond(self, status, data):
            body = json.dumps(data).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path != '/api/status':
                return self.respond(404, {'error': 'Not found'})
            try:
                self.respond(200, device.status())
            except (OSError, RuntimeError, ValueError) as error:
                self.respond(503, {'connected': False, 'error': str(error)})

        def do_POST(self):
            if self.path != '/api/reward':
                return self.respond(404, {'error': 'Not found'})
            origin = self.headers.get('Origin')
            if origin and origin != 'http://' + self.headers.get('Host', ''):
                return self.respond(403, {'error': 'Origin not allowed'})
            if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                return self.respond(415, {'error': 'Expected JSON'})
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 1 <= length <= 256:
                    return self.respond(400, {'error': 'Invalid request size'})
                data = json.loads(self.rfile.read(length))
                reward_id = data.get('id') if isinstance(data, dict) else None
                if not isinstance(reward_id, str) or not ID.fullmatch(reward_id):
                    return self.respond(400, {'error': 'Invalid animation id'})
            except (ValueError, UnicodeError):
                return self.respond(400, {'error': 'Invalid JSON'})
            try:
                status, result = device.reward(reward_id)
                self.respond(status, result)
            except (OSError, RuntimeError, ValueError) as error:
                self.respond(503, {'ok': False, 'error': str(error)})
    return Handler


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    device = MatrixDevice()
    print(json.dumps(device.status()), flush=True)
    server = ThreadingHTTPServer(('127.0.0.1', args.port), handler(device))
    print('UNO Q MATRIX server listening on board localhost:' + str(args.port), flush=True)
    server.serve_forever()
