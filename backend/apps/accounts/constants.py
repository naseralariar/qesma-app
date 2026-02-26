SIDEBAR_ITEM_KEYS = [
    "dashboard",
    "new_distribution",
    "search",
    "attendance",
    "session_minutes",
    "user_management",
]


def default_hidden_sidebar_items_for_role(role):
    if role in {"admin", "manager"}:
        return []
    return ["dashboard"]