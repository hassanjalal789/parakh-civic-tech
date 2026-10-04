from django.http import JsonResponse


def health(request):
    """Liveness only. Reveals nothing about configuration."""
    return JsonResponse({"status": "ok"})
