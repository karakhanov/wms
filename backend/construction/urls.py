from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("object-types", views.ConstructionObjectTypeViewSet, basename="construction-object-type")
router.register("object-type-limits", views.ConstructionObjectTypeItemLimitViewSet, basename="construction-object-type-limit")
router.register("objects", views.ConstructionObjectViewSet, basename="construction-object")

urlpatterns = [path("", include(router.urls))]
