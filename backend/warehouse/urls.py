from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("warehouses", views.WarehouseViewSet, basename="warehouse")
router.register("zones", views.ZoneViewSet, basename="zone")
router.register("racks", views.RackViewSet, basename="rack")
router.register("cells", views.CellViewSet, basename="cell")

urlpatterns = [path("", include(router.urls))]
