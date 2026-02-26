from django.contrib.auth import get_user_model
from django.conf import settings
from rest_framework import status, viewsets
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.core.models import AuditLog

from .models import Department
from .permissions import RolePermission
from .serializers import ChangePasswordSerializer, CustomTokenObtainPairSerializer, DepartmentSerializer, UserSerializer


User = get_user_model()


def _set_auth_cookies(response, access_token=None, refresh_token=None):
    cookie_kwargs = {
        "httponly": True,
        "secure": settings.JWT_COOKIE_SECURE,
        "samesite": settings.JWT_COOKIE_SAMESITE,
        "path": settings.JWT_COOKIE_PATH,
    }
    if settings.JWT_COOKIE_DOMAIN:
        cookie_kwargs["domain"] = settings.JWT_COOKIE_DOMAIN

    if access_token:
        response.set_cookie("access_token", access_token, **cookie_kwargs)
    if refresh_token:
        response.set_cookie("refresh_token", refresh_token, **cookie_kwargs)


def _clear_auth_cookies(response):
    cookie_kwargs = {"path": settings.JWT_COOKIE_PATH}
    if settings.JWT_COOKIE_DOMAIN:
        cookie_kwargs["domain"] = settings.JWT_COOKIE_DOMAIN
    response.delete_cookie("access_token", **cookie_kwargs)
    response.delete_cookie("refresh_token", **cookie_kwargs)


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_scope = "login"

    @staticmethod
    def _client_ip(request):
        forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR")

    def post(self, request, *args, **kwargs):
        username = str(request.data.get("username", "") or "").strip()
        try:
            response = super().post(request, *args, **kwargs)
            _set_auth_cookies(
                response,
                access_token=response.data.get("access"),
                refresh_token=response.data.get("refresh"),
            )
            user = None
            user_id = (response.data or {}).get("user", {}).get("id")
            if user_id:
                user = User.objects.filter(id=user_id).first()
            AuditLog.objects.create(
                user=user,
                action="LOGIN",
                model_name="User",
                object_id=str(user.id) if user else (username or "unknown"),
                details={"status": "success", "username": username},
                ip_address=self._client_ip(request),
            )
            return response
        except (AuthenticationFailed, ValidationError) as exc:
            user = User.objects.filter(username=username).first() if username else None
            detail = getattr(exc, "detail", "Authentication failed")
            AuditLog.objects.create(
                user=user,
                action="LOGIN",
                model_name="User",
                object_id=str(user.id) if user else (username or "unknown"),
                details={"status": "failure", "username": username, "reason": str(detail)},
                ip_address=self._client_ip(request),
            )
            raise


class CustomTokenRefreshView(TokenRefreshView):
    throttle_scope = "sensitive"

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data={
                "refresh": request.data.get("refresh") or request.COOKIES.get("refresh_token"),
            }
        )
        serializer.is_valid(raise_exception=True)
        response = Response(serializer.validated_data, status=status.HTTP_200_OK)
        _set_auth_cookies(
            response,
            access_token=response.data.get("access"),
            refresh_token=response.data.get("refresh"),
        )
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "sensitive"

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        AuditLog.objects.create(
            user=request.user,
            action="UPDATE",
            model_name="User",
            object_id=str(request.user.id),
            details={"event": "password_change"},
        )
        return Response({"detail": "Password updated successfully"}, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        response = Response({"detail": "Logged out"}, status=status.HTTP_200_OK)
        _clear_auth_cookies(response)
        return response


class DepartmentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Department.objects.filter(is_active=True)
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated]


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related("department").all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, RolePermission]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.role == "admin":
            return qs
        return qs.filter(department=self.request.user.department)

    def perform_create(self, serializer):
        user = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action="CREATE",
            model_name="User",
            object_id=str(user.id),
            details={"username": user.username},
        )
