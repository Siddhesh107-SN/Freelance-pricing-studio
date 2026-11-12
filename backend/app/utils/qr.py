"""Self-contained, dependency-free QR Code generator in pure Python.
Generates valid QR codes as SVG strings for UPI payment URLs and text.
"""
from __future__ import annotations

import itertools


class QrCode:
    """Minimal self-contained QR code generator (Versions 1-10, EC Level L & M)."""

    # Format info bits for error correction L (mask 0..7) and M (mask 0..7)
    _FORMAT_BITS = {
        # (ec_level, mask): 15-bit integer
        ("L", 0): 0x77C4, ("L", 1): 0x72F3, ("L", 2): 0x7DAA, ("L", 3): 0x789D,
        ("L", 4): 0x662F, ("L", 5): 0x6318, ("L", 6): 0x6C41, ("L", 7): 0x6976,
        ("M", 0): 0x5412, ("M", 1): 0x5125, ("M", 2): 0x5E7C, ("M", 3): 0x5B4B,
        ("M", 4): 0x45DF, ("M", 5): 0x40E8, ("M", 6): 0x4FB1, ("M", 7): 0x4A86,
    }

    # Capacity table: (version, ec_level) -> (total_data_bytes, num_blocks, ec_bytes_per_block)
    _CAPACITIES = {
        (1, "L"): (19, 1, 7), (1, "M"): (16, 1, 10),
        (2, "L"): (34, 1, 10), (2, "M"): (28, 1, 16),
        (3, "L"): (55, 1, 15), (3, "M"): (44, 1, 26),
        (4, "L"): (80, 1, 20), (4, "M"): (64, 2, 18),
        (5, "L"): (108, 1, 26), (5, "M"): (86, 2, 24),
        (6, "L"): (136, 2, 18), (6, "M"): (108, 4, 16),
        (7, "L"): (156, 2, 20), (7, "M"): (124, 4, 18),
        (8, "L"): (194, 2, 24), (8, "M"): (154, 4, 22),
        (9, "L"): (232, 2, 30), (9, "M"): (182, 5, 22),
        (10, "L"): (274, 2, 18), (10, "M"): (216, 5, 26),
    }

    # Alignment pattern positions for versions 1..10
    _ALIGNMENT_POS = {
        1: [],
        2: [6, 18],
        3: [6, 22],
        4: [6, 26],
        5: [6, 30],
        6: [6, 34],
        7: [6, 22, 38],
        8: [6, 24, 42],
        9: [6, 26, 46],
        10: [6, 28, 50],
    }

    # GF(256) tables with primitive polynomial 0x11D (285)
    _EXP = [0] * 512
    _LOG = [0] * 256
    _gf_init = False

    @classmethod
    def _init_gf(cls):
        if cls._gf_init:
            return
        x = 1
        for i in range(255):
            cls._EXP[i] = x
            cls._EXP[i + 255] = x
            cls._LOG[x] = i
            x <<= 1
            if x & 0x100:
                x ^= 0x11D
        cls._gf_init = True

    @classmethod
    def _gf_mul(cls, x, y):
        if x == 0 or y == 0:
            return 0
        return cls._EXP[cls._LOG[x] + cls._LOG[y]]

    @classmethod
    def _rs_generator_poly(cls, degree):
        cls._init_gf()
        poly = [1]
        for i in range(degree):
            factor = [1, cls._EXP[i]]
            new_poly = [0] * (len(poly) + 1)
            for j, c in enumerate(poly):
                new_poly[j] ^= cls._gf_mul(c, factor[0])
                new_poly[j + 1] ^= cls._gf_mul(c, factor[1])
            poly = new_poly
        return poly

    @classmethod
    def _rs_remainder(cls, data, generator):
        cls._init_gf()
        res = list(data) + [0] * (len(generator) - 1)
        for i in range(len(data)):
            coef = res[i]
            if coef != 0:
                for j in range(1, len(generator)):
                    res[i + j] ^= cls._gf_mul(generator[j], coef)
        return res[len(data):]

    @classmethod
    def encode_text(cls, text: str, ec_level: str = "M") -> list[list[bool]]:
        data_bytes = text.encode("utf-8")
        num_bytes = len(data_bytes)

        # Pick smallest version (1..10)
        version = None
        for v in range(1, 11):
            cap, _, _ = cls._CAPACITIES.get((v, ec_level), (0, 0, 0))
            # 4 bits mode + 8/16 bits length + data
            header_bits = 4 + (8 if v < 10 else 16)
            if (header_bits + num_bytes * 8) <= cap * 8:
                version = v
                break
        if version is None:
            # Fall back to L
            ec_level = "L"
            for v in range(1, 11):
                cap, _, _ = cls._CAPACITIES.get((v, ec_level), (0, 0, 0))
                header_bits = 4 + (8 if v < 10 else 16)
                if (header_bits + num_bytes * 8) <= cap * 8:
                    version = v
                    break
        if version is None:
            version = 10

        cap_bytes, num_blocks, ec_bytes = cls._CAPACITIES[(version, ec_level)]

        # 1. Build bit buffer
        # Mode: 0100 for Byte
        bits = [0, 1, 0, 0]
        # Char count
        count_bits = 8 if version < 10 else 16
        for i in range(count_bits - 1, -1, -1):
            bits.append((num_bytes >> i) & 1)
        # Data
        for b in data_bytes:
            for i in range(7, -1, -1):
                bits.append((b >> i) & 1)

        # Terminator
        max_bits = cap_bytes * 8
        terminator = min(4, max_bits - len(bits))
        bits.extend([0] * terminator)

        # Pad to byte boundary
        while len(bits) % 8 != 0:
            bits.append(0)

        # Pad bytes 0xEC, 0x11
        pad_bytes = [0xEC, 0x11]
        pad_idx = 0
        while len(bits) < max_bits:
            val = pad_bytes[pad_idx % 2]
            for i in range(7, -1, -1):
                bits.append((val >> i) & 1)
            pad_idx += 1

        # Convert bits to bytes
        raw_bytes = []
        for i in range(0, len(bits), 8):
            b = 0
            for j in range(8):
                b = (b << 1) | bits[i + j]
            raw_bytes.append(b)

        # 2. Divide into blocks & compute error correction
        block_len = cap_bytes // num_blocks
        extra = cap_bytes % num_blocks
        data_blocks = []
        ec_blocks = []
        gen = cls._rs_generator_poly(ec_bytes)

        curr = 0
        for b_idx in range(num_blocks):
            blen = block_len + (1 if b_idx >= num_blocks - extra else 0)
            blk = raw_bytes[curr:curr + blen]
            curr += blen
            data_blocks.append(blk)
            ec_blocks.append(cls._rs_remainder(blk, gen))

        # Interleave
        final_bytes = []
        max_data_len = max(len(b) for b in data_blocks)
        for i in range(max_data_len):
            for b in data_blocks:
                if i < len(b):
                    final_bytes.append(b[i])
        for i in range(ec_bytes):
            for b in ec_blocks:
                final_bytes.append(b[i])

        # 3. Build Matrix
        size = 17 + version * 4
        # matrix: None = unassigned, True = dark, False = light
        modules: list[list[bool | None]] = [[None] * size for _ in range(size)]
        is_function = [[False] * size for _ in range(size)]

        def set_func(r, c, val):
            modules[r][c] = val
            is_function[r][c] = True

        # Finder patterns
        def add_finder(start_r, start_c):
            for r in range(start_r, start_r + 7):
                for c in range(start_c, start_c + 7):
                    dr = r - start_r
                    dc = c - start_c
                    if dr in (0, 6) or dc in (0, 6) or (2 <= dr <= 4 and 2 <= dc <= 4):
                        set_func(r, c, True)
                    else:
                        set_func(r, c, False)
            # Separators
            for r in range(start_r - 1, start_r + 8):
                for c in range(start_c - 1, start_c + 8):
                    if 0 <= r < size and 0 <= c < size and not is_function[r][c]:
                        set_func(r, c, False)

        add_finder(0, 0)
        add_finder(0, size - 7)
        add_finder(size - 7, 0)

        # Alignment patterns
        align = cls._ALIGNMENT_POS[version]
        for r_pos in align:
            for c_pos in align:
                if is_function[r_pos][c_pos]:
                    continue
                for dr in range(-2, 3):
                    for dc in range(-2, 3):
                        val = (abs(dr) == 2 or abs(dc) == 2 or (dr == 0 and dc == 0))
                        set_func(r_pos + dr, c_pos + dc, val)

        # Timing patterns
        for i in range(8, size - 8):
            val = (i % 2 == 0)
            if not is_function[6][i]:
                set_func(6, i, val)
            if not is_function[i][6]:
                set_func(i, 6, val)

        # Dark module
        set_func(size - 8, 8, True)

        # Reserve format info areas
        for c in range(9):
            if not is_function[8][c]:
                is_function[8][c] = True
        for r in range(9):
            if not is_function[r][8]:
                is_function[r][8] = True
        for c in range(size - 8, size):
            is_function[8][c] = True
        for r in range(size - 7, size):
            is_function[r][8] = True

        # 4. Place data bits in zigzag order
        bit_stream = []
        for b in final_bytes:
            for i in range(7, -1, -1):
                bit_stream.append((b >> i) & 1)

        bit_idx = 0
        right = size - 1
        while right > 0:
            if right == 6:  # Skip vertical timing pattern
                right -= 1
            for vert in range(size):
                up = ((right + 1) // 2) % 2 == 1
                r = (size - 1 - vert) if up else vert
                for c in (right, right - 1):
                    if not is_function[r][c]:
                        val = bit_stream[bit_idx] if bit_idx < len(bit_stream) else 0
                        modules[r][c] = bool(val)
                        bit_idx += 1
            right -= 2

        # 5. Mask pattern (we choose mask 0 for simplicity and apply format bits)
        # Mask 0: (row + col) % 2 == 0
        mask = 0
        for r in range(size):
            for c in range(size):
                if not is_function[r][c]:
                    if (r + c) % 2 == 0:
                        modules[r][c] = not modules[r][c]

        # 6. Apply format information
        format_val = cls._FORMAT_BITS[(ec_level, mask)]
        for i in range(15):
            b = bool((format_val >> i) & 1)
            # Top-left
            if i <= 5:
                modules[8][i] = b
            elif i == 6:
                modules[8][7] = b
            elif i <= 8:
                modules[8][8 - (i - 7)] = b
            else:
                modules[14 - i][8] = b
            # Split format info
            if i <= 7:
                modules[size - 1 - i][8] = b
            else:
                modules[8][size - 15 + i] = b

        return [[bool(m) for m in row] for row in modules]

    @classmethod
    def to_svg(cls, text: str, border: int = 2, size_px: int = 140, fg: str = "#111827") -> str:
        grid = cls.encode_text(text)
        n = len(grid)
        total = n + border * 2
        paths = []
        for r in range(n):
            for c in range(n):
                if grid[r][c]:
                    x = c + border
                    y = r + border
                    paths.append(f"M{x},{y}h1v1h-1z")
        d = "".join(paths)
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total} {total}" '
            f'width="{size_px}" height="{size_px}" style="display:block;">'
            f'<rect width="{total}" height="{total}" fill="#ffffff"/>'
            f'<path d="{d}" fill="{fg}"/>'
            f'</svg>'
        )

    @classmethod
    def to_data_uri(cls, text: str, border: int = 2, size_px: int = 140, fg: str = "#111827") -> str:
        import urllib.parse
        svg = cls.to_svg(text, border=border, size_px=size_px, fg=fg)
        encoded = urllib.parse.quote(svg)
        return f"data:image/svg+xml;utf8,{encoded}"
