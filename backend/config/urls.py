from django.contrib import admin
from django.urls import include, path
from django.views.generic import RedirectView

from apps.accounts.views import CustomTokenObtainPairView, CustomTokenRefreshView

urlpatterns = [
    path("", RedirectView.as_view(url="/api/", permanent=False)),
    path("admin/", admin.site.urls),
    path("api/auth/token/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", CustomTokenRefreshView.as_view(), name="token_refresh"),
    path("api/", include("apps.accounts.urls")),
    path("api/", include("apps.distributions.urls")),
    path("api/", include("apps.reports.urls")),
]
