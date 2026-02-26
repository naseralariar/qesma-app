from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import DebtorViewSet, DistributionViewSet

router = DefaultRouter()
router.register("debtors", DebtorViewSet, basename="debtor")
router.register("distributions", DistributionViewSet, basename="distribution")

urlpatterns = [path("", include(router.urls))]
