from rest_framework.permissions import BasePermission


class RolePermission(BasePermission):
    action_map = {
        "create": {"admin", "manager", "officer"},
        "update": {"admin", "manager", "officer"},
        "partial_update": {"admin", "manager", "officer"},
        "destroy": {"admin", "manager"},
        "list": {"admin", "manager", "officer", "viewer"},
        "retrieve": {"admin", "manager", "officer", "viewer"},
    }

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        allowed_roles = self.action_map.get(getattr(view, "action", ""), {"admin", "manager", "officer", "viewer"})
        return request.user.role in allowed_roles
