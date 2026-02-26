from django.contrib import admin

from .models import Creditor, Debtor, Distribution

admin.site.register(Debtor)
admin.site.register(Distribution)
admin.site.register(Creditor)
