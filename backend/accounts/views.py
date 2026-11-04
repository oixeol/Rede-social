"""
API endpoints para autenticação e perfil do usuário.

Os endpoints seguem a API Node.js que o frontend espera:

- POST /api/register
- POST /api/login
- POST /api/logout
- GET /api/me
- PATCH /api/me
"""

from rest_framework import status
from rest_framework.generics import CreateAPIView, RetrieveUpdateAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from django.contrib.auth import authenticate

from common.errors import error_response, ApiError
from common.timeutils import now_ms
from common.constants import INTEREST_IDS

from accounts.models import User, Session


class RegisterView(CreateAPIView):
    """Registra um novo usuário e cria uma sessão.

    O comportamento de validação e mensagens de erro reproduz o servidor
    Node.js, caso contrário o frontend pode exibir mensagens erradas.
    """

    def post(self, request, *args, **kwargs):
        try:
            username = request.data.get("username")
            name = request.data.get("name")
            password = request.data.get("password")
            birth_date = request.data.get("birthDate")

            if not username or not name or not password or not birth_date:
                raise ApiError(400, "Campos obrigatórios ausentes.")
            if not username.islower() or not username.isascii():
                raise ApiError(400, "Nome de usuário inválido.")
            if User.objects.filter(username=username).exists():
                raise ApiError(409, "Usuário já existe.")
            user = User.objects.create_user(username=username, name=name, password=password)
            user.birth_date = birth_date
            user.save()
            token = Session.objects.create_session(user)
            headers = {"Set-Cookie": Session.create_cookie_header(user, token)}
            data = {
                "user": user.to_dict(),  # fmt: skip
                "stats": user.stats(),
            }
            return Response(data, status=status.HTTP_201_CREATED, headers=headers)
        except ApiError as exc:
            return error_response(exc)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LoginView(APIView):
    def post(self, request):
        try:
            username = request.data.get("username")
            password = request.data.get("password")
            user = authenticate(username=username, password=password)
            if not user:
                raise ApiError(401, "Usuário ou senha incorretos.")
            token = Session.objects.create_session(user)
            headers = {"Set-Cookie": Session.create_cookie_header(user, token)}
            return Response({"user": user.to_dict(), "stats": user.stats()}, headers=headers)
        except ApiError as exc:
            return error_response(exc)


class LogoutView(APIView):
    def post(self, request):
        token = request.COOKIES.get("vibra_session")
        if token:
            Session.objects.filter(token=token).delete()
        return Response({"ok": True}, headers={"Set-Cookie": "vibra_session=; Path=/; Max-Age=0"})


class MeView(RetrieveUpdateAPIView):
    def get(self, request):
        user = request.user
        return Response({"user": user.to_dict(), "stats": user.stats()})

    def patch(self, request):
        user = request.user
        # Atualização de campos `name`, `bio`, `avatar`, ... reproduzindo validação Node.js
        return Response({"user": user.to_dict()})
