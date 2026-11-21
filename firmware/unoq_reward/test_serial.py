"""Exercise the physical UNO Q LED reward protocol; Python standard library only."""
import argparse
import collections
import os
import select
import termios
import time
import tty


class Board:
    def __init__(self, port):
        self.fd = os.open(port, os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
        self.original = termios.tcgetattr(self.fd)
        tty.setraw(self.fd)
        settings = termios.tcgetattr(self.fd)
        settings[4] = settings[5] = termios.B115200
        termios.tcsetattr(self.fd, termios.TCSANOW, settings)
        self.buffer = b""
        self.lines = collections.deque()

    def close(self):
        termios.tcsetattr(self.fd, termios.TCSANOW, self.original)
        os.close(self.fd)

    def send(self, command):
        data = (command + "\n").encode("ascii")
        while data:
            _, writable, _ = select.select([], [self.fd], [], 2)
            if not writable:
                raise TimeoutError("Serial write stalled")
            data = data[os.write(self.fd, data):]
        print(f"> {command}", flush=True)

    def receive(self, timeout=3):
        deadline = time.monotonic() + timeout
        while not self.lines:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError("No reply from UNO Q")
            readable, _, _ = select.select([self.fd], [], [], remaining)
            if not readable:
                continue
            self.buffer += os.read(self.fd, 4096)
            if len(self.buffer) > 16384:
                raise ValueError("Serial stream exceeded buffer limit")
            while b"\n" in self.buffer:
                line, self.buffer = self.buffer.split(b"\n", 1)
                value = line.decode("ascii", errors="replace").strip()
                if value:
                    self.lines.append(value)
        value = self.lines.popleft()
        print(f"< {value}", flush=True)
        return value

    def expect(self, expected, timeout=3):
        actual = self.receive(timeout)
        if actual != expected:
            raise AssertionError(f"Expected {expected!r}, got {actual!r}")


def run(board, cycles):
    # UNO Q does not reset on port open. The web adapter also supports PING
    # when the initial READY was sent before the browser connected.
    board.send("PING")
    response = board.receive(10)
    if response == "READY cb-dispenser v1":
        response = board.receive()
    if response != "PONG":
        raise AssertionError(f"Handshake failed: {response!r}")

    board.send("STATUS")
    status = board.receive()
    prefix = "STATUS idle count="
    if not status.startswith(prefix):
        raise AssertionError(status)
    initial_count = int(status[len(prefix):])
    board.send("garbage")
    board.expect("ERR - BADCMD")
    board.send("X" * 40)
    board.expect("ERR - BADCMD")
    board.send("SERVO 90")
    board.expect("ERR - NOHARDWARE")
    board.send("DISPENSE bad-id")
    board.expect("ERR - BADCMD")

    stamp = int(time.time()) % 10000000
    for index in range(cycles):
        reward_id = f"T{stamp}{index:02}"
        board.send(f"DISPENSE {reward_id}")
        board.expect(f"ACK {reward_id}")
        if index == 0:
            board.send("DISPENSE busytest")
            board.expect("ERR busytest BUSY")
            board.send("STATUS")
            board.expect("STATUS busy")
            board.send("PING")
            board.expect("PONG")
        board.expect(f"DONE {reward_id}", timeout=4)
        board.send(f"DISPENSE {reward_id}")
        board.expect(f"DONE {reward_id}")
        board.send("STATUS")
        board.expect(f"STATUS idle count={initial_count + index + 1}")
        print(f"PASS cycle {index + 1}/{cycles} (including idempotent retry)", flush=True)
    print("PASS handshake, invalid commands, overflow recovery, BUSY, live PING/STATUS, counts", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", required=True)
    parser.add_argument("--cycles", type=int, default=20)
    args = parser.parse_args()
    if not 1 <= args.cycles <= 99:
        parser.error("--cycles must be between 1 and 99")
    board = Board(args.port)
    try:
        run(board, args.cycles)
    finally:
        board.close()
