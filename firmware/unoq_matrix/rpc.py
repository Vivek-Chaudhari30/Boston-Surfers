"""Small standard-library MessagePack RPC client for the board's local Arduino Router."""
import socket
import struct


def pack(value):
    if value is None:
        return b'\xc0'
    if isinstance(value, bool):
        return b'\xc3' if value else b'\xc2'
    if isinstance(value, int):
        return b'\xd2' + struct.pack('>i', value)
    if isinstance(value, str):
        raw = value.encode()
        return (bytes([0xa0 + len(raw)]) if len(raw) < 32 else b'\xd9' + bytes([len(raw)])) + raw
    if isinstance(value, (list, tuple)):
        return bytes([0x90 + len(value)]) + b''.join(pack(item) for item in value)
    raise ValueError('unsupported RPC argument')


def read_value(stream):
    def take(size):
        data = b''
        while len(data) < size:
            chunk = stream.recv(size - len(data))
            if not chunk:
                raise ConnectionError('Arduino Router closed the socket')
            data += chunk
        return data
    def value():
        tag = take(1)[0]
        if tag < 0x80:
            return tag
        if tag >= 0xe0:
            return tag - 256
        if 0xa0 <= tag <= 0xbf:
            return take(tag & 31).decode()
        if 0x90 <= tag <= 0x9f:
            return [value() for _ in range(tag & 15)]
        if 0x80 <= tag <= 0x8f:
            return {value(): value() for _ in range(tag & 15)}
        if tag == 0xc0:
            return None
        if tag in (0xc2, 0xc3):
            return tag == 0xc3
        formats = {0xcc: '>B', 0xcd: '>H', 0xce: '>I', 0xcf: '>Q', 0xd0: '>b', 0xd1: '>h', 0xd2: '>i', 0xd3: '>q'}
        if tag in formats:
            fmt = formats[tag]
            return struct.unpack(fmt, take(struct.calcsize(fmt)))[0]
        if tag in (0xd9, 0xda, 0xdb):
            fmt = {0xd9: '>B', 0xda: '>H', 0xdb: '>I'}[tag]
            size = struct.unpack(fmt, take(struct.calcsize(fmt)))[0]
            if size > 65536:
                raise ValueError('oversized RPC string')
            return take(size).decode()
        if tag in (0xdc, 0xdd):
            fmt = '>H' if tag == 0xdc else '>I'
            size = struct.unpack(fmt, take(struct.calcsize(fmt)))[0]
            if size > 256:
                raise ValueError('oversized RPC array')
            return [value() for _ in range(size)]
        raise ValueError('unsupported MessagePack tag: ' + hex(tag))
    return value()


def call(method, *params, timeout=2):
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as stream:
        stream.settimeout(timeout)
        stream.connect('/var/run/arduino-router.sock')
        stream.sendall(pack([0, 1, method, list(params)]))
        for _ in range(16):
            response = read_value(stream)
            if isinstance(response, list) and len(response) == 4 and response[0] == 1 and response[1] == 1:
                if response[2] is not None:
                    raise RuntimeError(str(response[2]))
                return response[3]
        raise RuntimeError('No matching Arduino RPC response')
