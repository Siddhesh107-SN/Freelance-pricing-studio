def format_number(prefix: str, year: int, seq: int) -> str:
    return f"{prefix}-{year}-{seq:04d}"


def next_sequence(existing: list[str], prefix: str, year: int) -> int:
    start = f"{prefix}-{year}-"
    seqs = []
    for n in existing:
        if n.startswith(start):
            tail = n[len(start):]
            if tail.isdigit():
                seqs.append(int(tail))
    return (max(seqs) if seqs else 0) + 1
