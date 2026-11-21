"""Verify the live board-hosted HTTP API, including its actual LED brightness."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8765")
    parser.add_argument("--cycles", type=int, default=20)
    args = parser.parse_args()
    if not 1 <= args.cycles <= 99:
        parser.error("--cycles must be 1–99")

    def request(path, payload=None):
        req = Request(args.url + path, data=json.dumps(payload).encode() if payload is not None else None,
                      headers={"Content-Type": "application/json"} if payload is not None else {})
        try:
            with urlopen(req, timeout=5) as response:
                return response.status, json.load(response)
        except HTTPError as error:
            return error.code, json.load(error)

    code, initial = request("/api/status")
    assert code == 200 and initial["connected"] and not initial["busy"], initial
    assert request("/api/reward", {"id": "bad-id"})[0] == 400
    assert request("/api/reward", {"id": "X" * 13})[0] == 400
    stamp = int(time.time()) % 10000000
    with ThreadPoolExecutor(max_workers=1) as executor:
        for index in range(args.cycles):
            reward_id = f"H{stamp}{index:02}"
            pending = executor.submit(request, "/api/reward", {"id": reward_id})
            deadline = time.monotonic() + 1
            while True:
                _, state = request("/api/status")
                if state["busy"] and state["brightness"] == 1:
                    break
                assert time.monotonic() < deadline, f"Physical LED did not turn on: {state}"
                time.sleep(0.02)
            assert request("/api/reward", {"id": "busytest"})[0] == 409
            code, done = pending.result()
            assert code == 200 and done["ok"] and not done["duplicate"], done
            expected_count = initial["count"] + index + 1
            assert done["count"] == expected_count, done
            code, duplicate = request("/api/reward", {"id": reward_id})
            assert code == 200 and duplicate["duplicate"] and duplicate["count"] == expected_count, duplicate
            _, state = request("/api/status")
            assert state["brightness"] == 0 and not state["busy"] and state["count"] == expected_count, state
            print(f"PASS {index + 1}/{args.cycles}: LED on/off, BUSY, completion, duplicate, count", flush=True)
    print("PASS live UNO Q API and physical LED state verification", flush=True)


if __name__ == "__main__":
    main()
