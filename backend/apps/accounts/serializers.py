from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.accounts.constants import SIDEBAR_ITEM_KEYS, default_hidden_sidebar_items_for_role
from apps.core.constants import ATTENDANCE_LOCATIONS

from .models import Department


User = get_user_model()


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "code", "name", "is_active"]


class UserSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    can_edit_distribution = serializers.BooleanField(source="permission_edit_distribution", required=False, allow_null=True)
    can_delete_distribution = serializers.BooleanField(source="permission_delete_distribution", required=False, allow_null=True)
    can_search_outside_department = serializers.BooleanField(source="permission_search_outside_department", required=False)
    sidebar_hidden_items = serializers.ListField(child=serializers.CharField(), required=False)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "password",
            "first_name",
            "last_name",
            "email",
            "department",
            "department_name",
            "role",
            "can_edit_distribution",
            "can_delete_distribution",
            "can_search_outside_department",
            "attendance_allow_all_locations",
            "attendance_allowed_locations",
            "sidebar_hidden_items",
            "is_active",
        ]

    def validate_attendance_allowed_locations(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("قائمة مواقع التبليغ يجب أن تكون قائمة")
        invalid = [location for location in value if location not in ATTENDANCE_LOCATIONS]
        if invalid:
            raise serializers.ValidationError("توجد مواقع تبليغ غير معتمدة")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        allow_all = attrs.get("attendance_allow_all_locations")
        locations = attrs.get("attendance_allowed_locations")

        if self.instance is not None:
            if allow_all is None:
                allow_all = self.instance.attendance_allow_all_locations
            if locations is None:
                locations = self.instance.attendance_allowed_locations

        if allow_all is False and not locations:
            raise serializers.ValidationError({"attendance_allowed_locations": "اختر موقع تبليغ واحدًا على الأقل"})

        hidden_items = attrs.get("sidebar_hidden_items")
        if hidden_items is not None:
            invalid = [item for item in hidden_items if item not in SIDEBAR_ITEM_KEYS]
            if invalid:
                raise serializers.ValidationError({"sidebar_hidden_items": "توجد عناصر قائمة جانبية غير معتمدة"})
        return attrs

    def create(self, validated_data):
        if "sidebar_hidden_items" not in validated_data:
            role = validated_data.get("role", "viewer")
            validated_data["sidebar_hidden_items"] = default_hidden_sidebar_items_for_role(role)
        return super().create(validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["sidebar_hidden_items"] = instance.get_effective_sidebar_hidden_items()
        return data

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["department_id"] = user.department_id
        token["full_name"] = user.get_full_name()
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.check_password(attrs["current_password"]):
            raise serializers.ValidationError({"current_password": "كلمة المرور الحالية غير صحيحة"})
        return attrs
