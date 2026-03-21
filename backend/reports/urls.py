from django.urls import path
from . import views

urlpatterns = [
    path("summary/", views.ReportDashboardSummary.as_view()),
    path("movement/", views.ReportMovement.as_view()),
    path("shortage/", views.ReportShortage.as_view()),
    path("popular/", views.ReportPopular.as_view()),
    path("object-consumption/", views.ReportObjectConsumption.as_view()),
]
