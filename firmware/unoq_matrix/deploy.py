"""Build on the original UNO Q runtime, then flash with the newer USB uploader."""
import argparse
from pathlib import Path
import shlex
import subprocess
import tempfile


def main():
    tools = Path.home() / "Library/Arduino15/packages/arduino/tools"
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--serial", required=True, help="UNO Q USB serial number")
    parser.add_argument("--adb", type=Path, default=tools / "adb/32.0.0/adb")
    parser.add_argument("--remoteocd", type=Path, default=tools / "remoteocd/0.1.1/remoteocd")
    parser.add_argument("--libraries", type=Path, default=Path.home() / "Documents/Arduino/libraries")
    args = parser.parse_args()
    source_dir = Path(__file__).resolve().parent
    libraries = [args.libraries / name for name in ("MsgPack", "ArxContainer", "ArxTypeTraits", "DebugLog")]
    for path in [args.adb, args.remoteocd, *libraries]:
        if not path.exists():
            parser.error(f"Required tool/library not found: {path}")

    def run(*command, capture=False):
        return subprocess.run([str(part) for part in command], check=True, text=True,
                              stdout=subprocess.PIPE if capture else None)

    def adb(*command, capture=False):
        return run(args.adb, "-s", args.serial, *command, capture=capture)

    def remote(*command, capture=False):
        return adb("shell", shlex.join([str(part) for part in command]), capture=capture)

    # This workflow intentionally targets the original runtime already on Jeet's
    # board. Do not flash a different core's binary at the legacy sketch address.
    loader = "/home/arduino/.arduino15/packages/arduino/hardware/zephyr/0.52.0/firmwares/zephyr-arduino_uno_q_stm32u585xx.elf"
    remote("test", "-f", loader)
    board_temp = remote("mktemp", "-d", "/tmp/cb-reward.XXXXXX", capture=True).stdout.strip()
    if not board_temp.startswith("/tmp/cb-reward.") or "\n" in board_temp:
        raise RuntimeError("Unexpected temporary build directory")
    board_source = f"{board_temp}/src/unoq_matrix"
    board_libraries = f"{board_temp}/libraries"
    board_build = f"{board_temp}/build"
    remote("mkdir", "-p", board_source, board_libraries)
    adb("push", source_dir / "unoq_matrix.ino", f"{board_source}/unoq_matrix.ino")
    adb("push", *libraries, f"{board_libraries}/")
    remote("env", "TMPDIR=/tmp", "arduino-cli", "compile", "--fqbn", "arduino:zephyr:unoq",
           "--libraries", board_libraries, "--output-dir", board_build, board_source)

    with tempfile.TemporaryDirectory(prefix="cb-unoq-native-") as local_temp:
        local_temp = Path(local_temp)
        local_loader = local_temp / "loader.elf"
        local_sketch = local_temp / "reward.bin"
        adb("pull", loader, local_loader)
        adb("pull", f"{board_build}/unoq_matrix.ino.elf-zsk.bin", local_sketch)
        run(args.remoteocd, "upload", "--adb-path", args.adb, "--serial", args.serial,
            "--file", source_dir.parent / "unoq_reward" / "flash_legacy.cfg", local_loader, local_sketch)
    print("Uploaded matrix RPC firmware. Check cb_matrix_status before triggering its display.")


if __name__ == "__main__":
    main()
