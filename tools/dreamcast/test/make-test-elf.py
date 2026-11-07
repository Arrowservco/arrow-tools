#!/usr/bin/env python3
"""Hand-assemble a tiny Dreamcast (SH-4) homebrew ELF used to smoke-test the player.

It programs the PowerVR2 registers for a 640x480 RGB565 framebuffer (the same
register values the Flycast/reios framebuffer scan-out understands), fills VRAM
with a diagonal colour gradient, then spins forever.  No game data involved.

usage: make-test-elf.py OUT.elf
"""
import struct
import sys

BASE = 0x8C010000  # reios loads homebrew ELFs here

code = []      # 16-bit opcodes
lits = []      # 32-bit literal pool values
fixups = []    # (code index, literal index, register)


def emit(op):
    code.append(op & 0xFFFF)


def load_lit(reg, value):
    """mov.l @(disp,PC),Rn - displacement is patched once the pool address is known."""
    if value in lits:
        li = lits.index(value)
    else:
        lits.append(value)
        li = len(lits) - 1
    fixups.append((len(code), li, reg))
    emit(0)  # placeholder


def store_l(rn, rm):   # mov.l Rm,@Rn
    emit(0x2002 | (rn << 8) | (rm << 4))


def store_w(rn, rm):   # mov.w Rm,@Rn
    emit(0x2001 | (rn << 8) | (rm << 4))


def add_imm(rn, imm):  # add #imm,Rn
    emit(0x7000 | (rn << 8) | (imm & 0xFF))


def dt(rn):            # dt Rn  (T = (Rn-1 == 0))
    emit(0x4010 | (rn << 8))


# --- PowerVR2 / SPG video setup (mirrors the documented 640x480 RGB565 values) ---
PVR = 0xA05F8000
regs = [
    (0x044, 0x00000045),                      # FB_R_CTRL: enable, RGB565
    (0x048, 0x00000001),                      # FB_W_CTRL: RGB565
    (0x050, 0x00000000),                      # FB_R_SOF1
    (0x060, 0x00000000),                      # FB_W_SOF1
    (0x05C, 319 | (479 << 10) | (1 << 20)),   # FB_R_SIZE
    (0x11C, 160),                             # FB_W_LINESTRIDE
    (0x0E8, 0x00000000),                      # VO_CONTROL
    (0x040, 0x00000000),                      # VO_BORDER_COL
    (0x0D8, (524 << 16) | 857),               # SPG_LOAD
    (0x0D0, 0x00000050),                      # SPG_CONTROL (NTSC, interlaced)
]
for off, val in regs:
    load_lit(2, PVR + off)
    load_lit(3, val)
    store_l(2, 3)

# --- fill VRAM: pixel(i) = i (wraps) -> diagonal rainbow-ish gradient ---
load_lit(5, 0xA5000000)   # r5 = framebuffer pointer
load_lit(6, 640 * 480)    # r6 = pixel counter
emit(0xE400)              # mov #0,r4  (colour)
loop = len(code)
store_w(5, 4)             # mov.w r4,@r5
add_imm(5, 2)             # add #2,r5
add_imm(4, 1)             # add #1,r4
dt(6)                     # dt r6
# bf loop : target = PC+4+2*disp, PC = address of the bf instruction
bf_index = len(code)
disp = (loop - bf_index) * 2 - 4
assert -256 <= disp <= 254 and disp % 2 == 0
emit(0x8B00 | ((disp // 2) & 0xFF))
# spin: bra . ; nop
emit(0xAFFE)
emit(0x0009)

# literal pool (4-byte aligned)
if len(code) % 2:
    emit(0x0009)
pool_base = len(code) * 2
for i, (ci, li, reg) in enumerate(fixups):
    pc = ci * 2
    lit_addr = pool_base + li * 4
    disp = (lit_addr - ((pc & ~3) + 4)) // 4
    assert 0 <= disp < 256, "literal out of range"
    code[ci] = 0xD000 | (reg << 8) | disp

blob = b"".join(struct.pack("<H", op) for op in code) + b"".join(
    struct.pack("<I", v) for v in lits
)

# --- ELF32 little-endian, EM_SH (42), one PT_LOAD ---
ehsize, phsize = 52, 32
offset = 0x1000
elf = bytearray()
elf += b"\x7fELF" + bytes([1, 1, 1, 0]) + b"\0" * 8
elf += struct.pack("<HHIIIIIHHHHHH", 2, 42, 1, BASE, ehsize, 0, 0x0, ehsize, phsize, 1, 0, 0, 0)
elf += struct.pack("<IIIIIIII", 1, offset, BASE, BASE, len(blob), len(blob), 7, 4)
elf += b"\0" * (offset - len(elf))
elf += blob

with open(sys.argv[1], "wb") as f:
    f.write(elf)
print(f"wrote {sys.argv[1]}: {len(elf)} bytes, {len(code)} opcodes, {len(lits)} literals")
