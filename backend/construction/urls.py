from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("objects", views.ConstructionObjectViewSet, basename="construction-object")

urlpatterns = [path("", include(router.urls))]
