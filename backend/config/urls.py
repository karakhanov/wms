from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from . import locale_views

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/language/", locale_views.language_list),
    path("api/language/set/", locale_views.SetLanguageView.as_view()),
    path("api/auth/", include("users.urls")),
    path("api/products/", include("products.urls")),
    path("api/warehouse/", include("warehouse.urls")),
    path("api/construction/", include("construction.urls")),
    path("api/receipts/", include("receipts.urls")),
    path("api/orders/", include("orders.urls")),
    path("api/stock/", include("stock.urls")),
    path("api/transfers/", include("transfers.urls")),
    path("api/inventory/", include("inventory.urls")),
    path("api/reports/", include("reports.urls")),
    path("api/notifications/", include("notifications.urls")),
]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
