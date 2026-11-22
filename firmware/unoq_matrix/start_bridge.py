#!/usr/bin/env python3
"""Restore the USB bridge and detach it from the terminal; no firmware flash."""
import argparse
import json
from pathlib import Path
import shlex
import subprocess
import time
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--serial', default='3454450778')
    parser.add_argument('--adb', default=str(Path.home() / 'Library/Arduino15/packages/arduino/tools/adb/32.0.0/adb'))
    args = parser.parse_args()
    adb = [args.adb, '-s', args.serial]

    def run(*arguments):
        return subprocess.run([*adb, *arguments], check=True, text=True, capture_output=True).stdout.strip()

    run('get-state')
    run('shell', 'mkdir -p /home/arduino/cb-unoq-matrix')
    directory = Path(__file__).resolve().parent
    for name in ('server.py', 'rpc.py'):
        run('push', str(directory / name), '/home/arduino/cb-unoq-matrix/' + name)
    run('forward', 'tcp:8765', 'tcp:8765')
    # Probe on the board first to avoid starting a second listener.
    launcher = '''import subprocess, urllib.request
try:
    with urllib.request.urlopen('http://127.0.0.1:8765/api/status', timeout=3) as response:
        print(response.read().decode())
except Exception:
    log = open('/home/arduino/cb-unoq-matrix/bridge.log', 'ab', buffering=0)
    process = subprocess.Popen(['python3', '-u', 'server.py', '--port', '8765'],
        cwd='/home/arduino/cb-unoq-matrix', stdin=subprocess.DEVNULL,
        stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    print('Started detached bridge PID', process.pid)
'''
    print(run('shell', 'python3 -c ' + shlex.quote(launcher)))
    for _ in range(12):
        try:
            with urllib.request.urlopen('http://127.0.0.1:8765/api/status', timeout=2) as response:
                status = json.load(response)
            if status.get('connected') and status.get('mode') == 'matrix-only':
                print(json.dumps(status))
                print('Bridge ready. It survives this terminal closing. Keep USB connected.')
                return
        except (OSError, ValueError):
            pass
        time.sleep(0.5)
    print(run('shell', 'tail -n 30 /home/arduino/cb-unoq-matrix/bridge.log'))
    raise SystemExit('Bridge did not become ready. Inspect the board log above.')


if __name__ == '__main__':
    main()
