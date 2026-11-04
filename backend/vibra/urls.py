"""
URLconf principal da API Vibra.

Este módulo define as rotas REST; os app específicos (accounts, social,
messaging, dating) têm seus próprios `urls.py` com os detalhes das
endpoints.
"""

from django.urls import path, include

urlpatterns = [
    # Configuração da plataforma
    path('api/config', include('common.urls')),
    # Autenticação (registro, login, logout)
    path('api/', include('accounts.urls')),
    # Área social: posts, stories, likes, comentários, follow, blocks
    path('api/', include('social.urls')),
    # Mensagens e conversas
    path('api/', include('messaging.urls')),
    # Namoro (perfil de namoro, matches, Radar, discover)
    path('api/', include('dating.urls')),
    # Uploads
    path('api/uploads/', include('uploads.urls')),
    # Webhooks de identidade
    path('api/webhooks/', include('webhooks.urls')),
    # Administração de denúncias/relatos
    path('api/moderation/', include('moderation.urls')),
]