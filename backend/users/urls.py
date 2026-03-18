from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from . import views

router = DefaultRouter()
router.register("roles", views.RoleViewSet, basename="role")
router.register("users", views.UserViewSet, basename="user")
router.register("action-log", views.ActionLogViewSet, basename="action-log")

urlpatterns = [
    path("token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", views.current_user),
    path("", include(router.urls)),
]
