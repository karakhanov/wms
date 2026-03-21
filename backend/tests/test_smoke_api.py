import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from users.models import Role

User = get_user_model()


@pytest.mark.django_db
def test_products_list_requires_authentication():
    client = APIClient()
    response = client.get("/api/products/")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_products_list_returns_results_for_authenticated_user():
    role = Role.objects.create(name=Role.Name.MANAGER)
    user = User.objects.create_user(
        username="pytest_user",
        password="pass",
        role=role,
    )
    client = APIClient()
    client.force_authenticate(user=user)
    response = client.get("/api/products/")
    assert response.status_code == status.HTTP_200_OK
    assert "results" in response.data


@pytest.mark.django_db
def test_token_obtain_pair_invalid_credentials():
    client = APIClient()
    response = client.post(
        "/api/auth/token/",
        {"username": "nope", "password": "wrong"},
        format="json",
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
