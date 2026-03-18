from django.urls import path
from . import views

urlpatterns = [
    path("movement/", views.ReportMovement.as_view()),
    path("shortage/", views.ReportShortage.as_view()),
    path("popular/", views.ReportPopular.as_view()),
]
