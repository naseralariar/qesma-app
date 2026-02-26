from rest_framework import serializers

from apps.core.constants import ATTENDANCE_LOCATIONS


class AttendanceNoticeSerializer(serializers.Serializer):
    distribution_id = serializers.IntegerField()
    attendance_date = serializers.DateField()
    attendance_time = serializers.TimeField()
    location = serializers.ChoiceField(choices=ATTENDANCE_LOCATIONS)
    floor = serializers.CharField(max_length=20)
    room_number = serializers.CharField(max_length=20)


class SessionMinutesSerializer(serializers.Serializer):
    distribution_id = serializers.IntegerField(required=False)
    chairperson_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    page1_body = serializers.CharField(required=False, allow_blank=True, max_length=6000)
    page2_body = serializers.CharField(required=False, allow_blank=True, max_length=6000)

    def validate_page1_body(self, value):
        max_lines = 16
        max_chars_per_line = 200

        text = str(value or "").replace("\r\n", "\n")
        lines = text.split("\n")

        if len(lines) > max_lines:
            raise serializers.ValidationError("نص الصفحة الأولى يجب ألا يتجاوز 16 سطرًا")

        for line in lines:
            if len(line) > max_chars_per_line:
                raise serializers.ValidationError("كل سطر في نص الصفحة الأولى يجب ألا يتجاوز 200 حرف (بالمسافات)")

        return value
