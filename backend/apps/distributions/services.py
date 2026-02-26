from decimal import Decimal, ROUND_HALF_UP

RANK_ORDER = [1, 2, 3, 4, 5, 6, 7]
THREE = Decimal("0.001")


def qd(value: Decimal) -> Decimal:
    return value.quantize(THREE, rounding=ROUND_HALF_UP)


def distribute_proceeds(total_proceeds: Decimal, creditors: list[dict]) -> list[dict]:
    remaining = qd(total_proceeds)
    for creditor in creditors:
        creditor["distribution_amount"] = Decimal("0.000")

    for rank in RANK_ORDER:
        rank_creditors = [c for c in creditors if c["debt_rank"] == rank]
        if not rank_creditors:
            continue

        rank_total = qd(sum((c["debt_amount"] for c in rank_creditors), Decimal("0.000")))
        if remaining <= Decimal("0.000"):
            break

        if remaining >= rank_total:
            for creditor in rank_creditors:
                creditor["distribution_amount"] = qd(creditor["debt_amount"])
            remaining = qd(remaining - rank_total)
            continue

        allocated = Decimal("0.000")
        for index, creditor in enumerate(rank_creditors):
            if index == len(rank_creditors) - 1:
                share = qd(remaining - allocated)
            else:
                ratio = creditor["debt_amount"] / rank_total
                share = qd(remaining * ratio)
                allocated = qd(allocated + share)
            creditor["distribution_amount"] = max(Decimal("0.000"), share)
        remaining = Decimal("0.000")
        break

    return creditors
