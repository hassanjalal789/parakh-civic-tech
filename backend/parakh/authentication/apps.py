from django.apps import AppConfig


class AuthenticationConfig(AppConfig):
    name = "parakh.authentication"
    label = "authentication"

    def ready(self) -> None:
        from django.conf import settings

        from .sms import check_sms_configuration

        check_sms_configuration(settings.PARAKH_ENV, settings.PARAKH_SMS_BACKEND)
