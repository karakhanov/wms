from rest_framework import permissions

from .models import Role, RolePolicyOverride


def _user_role_name(user):
    if not user or not user.is_authenticated:
        return None
    if getattr(user, "is_superuser", False):
        return Role.Name.ADMIN
    role = getattr(user, "role", None)
    return getattr(role, "name", None)


class RolePermission(permissions.BasePermission):
    """
    Базовая RBAC-политика:
    - read_roles: кто может читать;
    - write_roles: кто может создавать/менять/удалять.
    """

    read_roles = set()
    write_roles = set()

    def has_permission(self, request, view):
        role_name = _user_role_name(request.user)
        if not role_name:
            return False
        if request.method in permissions.SAFE_METHODS:
            return role_name in self.read_roles
        return role_name in self.write_roles


class AdminOnly(RolePermission):
    read_roles = {Role.Name.ADMIN}
    write_roles = {Role.Name.ADMIN}


class AdminManager(RolePermission):
    read_roles = {Role.Name.ADMIN, Role.Name.MANAGER}
    write_roles = {Role.Name.ADMIN, Role.Name.MANAGER}


class ManagerStorekeeper(RolePermission):
    read_roles = {Role.Name.ADMIN, Role.Name.MANAGER, Role.Name.STOREKEEPER}
    write_roles = {Role.Name.ADMIN, Role.Name.MANAGER, Role.Name.STOREKEEPER}


class ManagerStorekeeperProcurement(RolePermission):
    """Справочник поставщиков: склад + снабжение (выбор в накладной, быстрый ввод)."""

    read_roles = {Role.Name.ADMIN, Role.Name.MANAGER, Role.Name.STOREKEEPER, Role.Name.PROCUREMENT}
    write_roles = {Role.Name.ADMIN, Role.Name.MANAGER, Role.Name.STOREKEEPER, Role.Name.PROCUREMENT}


class WarehouseStructureReadOrAdminManage(permissions.BasePermission):
    """GET: склад/зоны/ячейки — контролёр, снабжение, кладовщик + админ/менеджер; POST/PATCH/DELETE — только админ/менеджер."""

    _manage = {Role.Name.ADMIN, Role.Name.MANAGER}
    _read = {
        Role.Name.ADMIN,
        Role.Name.MANAGER,
        Role.Name.STOREKEEPER,
        Role.Name.WAREHOUSE_CONTROLLER,
        Role.Name.PROCUREMENT,
    }

    def has_permission(self, request, view):
        role_name = _user_role_name(request.user)
        if not role_name:
            return False
        if request.method in permissions.SAFE_METHODS:
            return role_name in self._read
        return role_name in self._manage


class StockBalanceRead(RolePermission):
    """Просмотр остатков — как в DEFAULT_ROLE_POLICY['stock_balances']['read']."""

    read_roles = {
        Role.Name.ADMIN,
        Role.Name.MANAGER,
        Role.Name.STOREKEEPER,
        Role.Name.FOREMAN,
        Role.Name.PROCUREMENT,
        Role.Name.WAREHOUSE_CONTROLLER,
    }
    write_roles = set()


class StorekeeperOnly(RolePermission):
    read_roles = {Role.Name.ADMIN, Role.Name.STOREKEEPER}
    write_roles = {Role.Name.ADMIN, Role.Name.STOREKEEPER}


class AdminStorekeeper(RolePermission):
    read_roles = {Role.Name.ADMIN, Role.Name.STOREKEEPER}
    write_roles = {Role.Name.ADMIN, Role.Name.STOREKEEPER}


class AnyAuthenticatedRole(RolePermission):
    read_roles = {
        Role.Name.ADMIN,
        Role.Name.MANAGER,
        Role.Name.STOREKEEPER,
        Role.Name.FOREMAN,
        Role.Name.PROCUREMENT,
        Role.Name.WAREHOUSE_CONTROLLER,
    }
    write_roles = {
        Role.Name.ADMIN,
        Role.Name.MANAGER,
        Role.Name.STOREKEEPER,
        Role.Name.FOREMAN,
        Role.Name.PROCUREMENT,
        Role.Name.WAREHOUSE_CONTROLLER,
    }


DEFAULT_ROLE_POLICY = {
    "products": {
        "read": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
        "write": [Role.Name.ADMIN, Role.Name.MANAGER],
    },
    "categories": {
        "read": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
        "write": [Role.Name.ADMIN, Role.Name.MANAGER],
    },
    "units": {
        "read": [Role.Name.ADMIN, Role.Name.MANAGER, Role.Name.STOREKEEPER],
        "write": [Role.Name.ADMIN, Role.Name.MANAGER, Role.Name.STOREKEEPER],
    },
    "warehouse": {"read": [Role.Name.ADMIN, Role.Name.MANAGER], "write": [Role.Name.ADMIN, Role.Name.MANAGER]},
    "construction_objects": {
        "read": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
        "write": [Role.Name.ADMIN, Role.Name.MANAGER],
    },
    "zones": {"read": [Role.Name.ADMIN, Role.Name.MANAGER], "write": [Role.Name.ADMIN, Role.Name.MANAGER]},
    "racks": {"read": [Role.Name.ADMIN, Role.Name.MANAGER], "write": [Role.Name.ADMIN, Role.Name.MANAGER]},
    "cells": {"read": [Role.Name.ADMIN, Role.Name.MANAGER], "write": [Role.Name.ADMIN, Role.Name.MANAGER]},
    "suppliers": {
        "read": [Role.Name.ADMIN, Role.Name.MANAGER, Role.Name.STOREKEEPER, Role.Name.PROCUREMENT],
        "write": [Role.Name.ADMIN, Role.Name.MANAGER, Role.Name.STOREKEEPER, Role.Name.PROCUREMENT],
    },
    "receipts": {
        "read": [Role.Name.ADMIN, Role.Name.MANAGER, Role.Name.STOREKEEPER, Role.Name.PROCUREMENT],
        "write": [Role.Name.ADMIN, Role.Name.MANAGER, Role.Name.STOREKEEPER, Role.Name.PROCUREMENT],
    },
    "orders": {
        "read": [Role.Name.ADMIN, Role.Name.MANAGER, Role.Name.STOREKEEPER],
        "write": [Role.Name.ADMIN, Role.Name.MANAGER, Role.Name.STOREKEEPER],
    },
    "stock_balances": {
        "read": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
        "write": [Role.Name.ADMIN, Role.Name.MANAGER, Role.Name.STOREKEEPER],
    },
    "min_stock_levels": {
        "read": [Role.Name.ADMIN, Role.Name.MANAGER, Role.Name.STOREKEEPER],
        "write": [Role.Name.ADMIN, Role.Name.MANAGER, Role.Name.STOREKEEPER],
    },
    "transfers": {"read": [Role.Name.ADMIN, Role.Name.STOREKEEPER], "write": [Role.Name.ADMIN, Role.Name.STOREKEEPER]},
    "inventory": {"read": [Role.Name.ADMIN, Role.Name.STOREKEEPER], "write": [Role.Name.ADMIN, Role.Name.STOREKEEPER]},
    "reports": {"read": [Role.Name.ADMIN, Role.Name.MANAGER], "write": [Role.Name.ADMIN, Role.Name.MANAGER]},
    "users": {"read": [Role.Name.ADMIN, Role.Name.MANAGER], "write": [Role.Name.ADMIN, Role.Name.MANAGER]},
    "user_admin_actions": {"read": [Role.Name.ADMIN], "write": [Role.Name.ADMIN]},
    "action_log": {
        "read": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
        "write": [Role.Name.ADMIN, Role.Name.MANAGER],
    },
    "material_requests": {
        "read": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
        ],
        "write": [Role.Name.ADMIN, Role.Name.MANAGER, Role.Name.FOREMAN],
    },
    "issue_notes": {
        "read": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
        "write": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.FOREMAN,
            Role.Name.STOREKEEPER,
            Role.Name.PROCUREMENT,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
    },
    "notifications": {
        "read": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
        "write": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
    },
    "sidebar_dashboard": {
        "read": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
        "write": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
    },
    "sidebar_products": {
        "read": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
        "write": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
    },
    "sidebar_categories": {
        "read": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
        "write": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
    },
    "sidebar_warehouse": {
        "read": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
        "write": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
    },
    "sidebar_objects": {
        "read": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
        "write": [Role.Name.ADMIN, Role.Name.MANAGER, Role.Name.FOREMAN],
    },
    "sidebar_suppliers": {
        "read": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
        ],
        "write": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
        ],
    },
    "sidebar_receipts": {
        "read": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
        ],
        "write": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
        ],
    },
    "sidebar_orders": {
        "read": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
        ],
        "write": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
        ],
    },
    "sidebar_issueNotes": {
        "read": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
        "write": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
    },
    "sidebar_stock": {
        "read": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
        "write": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
    },
    "sidebar_transfers": {
        "read": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
        "write": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
    },
    "sidebar_inventory": {
        "read": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
        "write": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
    },
    "sidebar_reports": {
        "read": [Role.Name.ADMIN, Role.Name.MANAGER],
        "write": [Role.Name.ADMIN, Role.Name.MANAGER],
    },
    "sidebar_users": {
        "read": [Role.Name.ADMIN, Role.Name.MANAGER],
        "write": [Role.Name.ADMIN, Role.Name.MANAGER],
    },
    "sidebar_rolesAccess": {
        "read": [Role.Name.ADMIN],
        "write": [Role.Name.ADMIN],
    },
    "sidebar_notifications": {
        "read": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
        "write": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
    },
    "sidebar_history": {
        "read": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
        "write": [
            Role.Name.ADMIN,
            Role.Name.MANAGER,
            Role.Name.STOREKEEPER,
            Role.Name.FOREMAN,
            Role.Name.PROCUREMENT,
            Role.Name.WAREHOUSE_CONTROLLER,
        ],
    },
}


def get_role_policy():
    policy = {resource: {"read": list(rules["read"]), "write": list(rules["write"])} for resource, rules in DEFAULT_ROLE_POLICY.items()}
    overrides = RolePolicyOverride.objects.all().values("role_name", "resource", "can_read", "can_write")
    for row in overrides:
        resource = row["resource"]
        role_name = row["role_name"]
        if resource not in policy:
            continue
        read_set = set(policy[resource]["read"])
        write_set = set(policy[resource]["write"])
        if row["can_read"]:
            read_set.add(role_name)
        else:
            read_set.discard(role_name)
        if row["can_write"]:
            write_set.add(role_name)
        else:
            write_set.discard(role_name)
        policy[resource]["read"] = sorted(read_set)
        policy[resource]["write"] = sorted(write_set)
    return policy


def get_user_permissions(user):
    role_name = _user_role_name(user)
    if not role_name:
        return {"role": None, "permissions": {}}
    policy = get_role_policy()
    permissions_map = {}
    for resource, rules in policy.items():
        permissions_map[resource] = {
            "can_read": role_name in rules["read"],
            "can_write": role_name in rules["write"],
        }
    return {"role": role_name, "permissions": permissions_map}
