from decimal import ROUND_HALF_UP, Decimal


def format_inr(value, symbol: str = "\u20b9", decimals: int = 2) -> str:
    """Format using Indian digit grouping, e.g. 125000 -> ₹1,25,000.00."""
    d = Decimal(str(value if value not in (None, "") else 0))
    d = d.quantize(Decimal(1).scaleb(-decimals), rounding=ROUND_HALF_UP)
    neg = d < 0
    whole, _, frac = f"{abs(d):f}".partition(".")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        whole = ",".join(groups + [tail])
    out = f"{symbol}{whole}" + (f".{frac}" if decimals else "")
    return f"-{out}" if neg else out


def amount_in_words_inr(value) -> str:
    """Convert an amount into standard Indian currency words (e.g. Rupees Sixty-Four Thousand Nine Hundred Only)."""
    try:
        d = Decimal(str(value if value not in (None, "") else 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except Exception:
        return ""
    if d == 0:
        return "Rupees Zero Only"

    is_neg = d < 0
    d = abs(d)
    rupees = int(d)
    paise = int(round((d - rupees) * 100))

    ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
            "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
            "Seventeen", "Eighteen", "Nineteen"]
    tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    def two_digits(n: int) -> str:
        if n < 20:
            return ones[n]
        t = tens[n // 10]
        o = ones[n % 10]
        return f"{t}-{o}" if o else t

    def three_digits(n: int) -> str:
        h = n // 100
        rem = n % 100
        parts = []
        if h > 0:
            parts.append(f"{ones[h]} Hundred")
        if rem > 0:
            parts.append(two_digits(rem))
        return " ".join(parts)

    parts = []
    # Crores (>= 1,00,00,000)
    crores = rupees // 10000000
    rem = rupees % 10000000
    if crores > 0:
        parts.append(f"{three_digits(crores)} Crore" if crores == 1 else f"{three_digits(crores)} Crores")

    # Lakhs (>= 1,00,000)
    lakhs = rem // 100000
    rem = rem % 100000
    if lakhs > 0:
        parts.append(f"{two_digits(lakhs)} Lakh" if lakhs == 1 else f"{two_digits(lakhs)} Lakhs")

    # Thousands (>= 1,000)
    thousands = rem // 1000
    rem = rem % 1000
    if thousands > 0:
        parts.append(f"{two_digits(thousands)} Thousand")

    # Hundreds and below (< 1,000)
    if rem > 0:
        parts.append(three_digits(rem))

    words = " ".join(parts).strip()
    res = f"Rupees {words}" if words else "Rupees Zero"

    if paise > 0:
        res += f" and {two_digits(paise)} Paise"

    res += " Only"
    return f"Minus {res}" if is_neg else res
