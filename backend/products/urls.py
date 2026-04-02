from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("categories", views.CategoryViewSet, basename="category")
router.register("units", views.UnitViewSet, basename="unit")
router.register("services", views.ServiceViewSet, basename="service")
router.register("", views.ProductViewSet, basename="product")

urlpatterns = [path("", include(router.urls))]
