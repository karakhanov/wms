from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("balances", views.StockBalanceViewSet, basename="stockbalance")
router.register("min-levels", views.MinStockLevelViewSet, basename="minstocklevel")

urlpatterns = [path("", include(router.urls))]
