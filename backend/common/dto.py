"""
Camada compartilhada de DTOs e regras de privacidade.

O servidor Node.js concentrava essas regras em helpers dentro de
`server.js` (`userDTO`, `selfDTO`, `statsFor`, `badgesFor`, `isBlocked`,
`canViewUserContent`, `canMessageTarget`...). Aqui as mesmas regras ficam em
um módulo comum, importado por todos os apps, para que o contrato da API
permaneça idêntico independentemente da rota.
"""

from django.db.models import Count, Q

from common.constants import BADGES, INTEREST_IDS
from common.text import parse_json_array
from common.timeutils import now_ms


# ---------------------------------------------------------------------------
# DTOs
# ---------------------------------------------------------------------------


def user_dto(user):
    """DTO público de um usuário (sem dados privados)."""
    if user is None:
        return None
    return {
        'id': user.id,
        'username': user.username,
        'name': user.name,
        'bio': user.bio,
        'avatar': user.avatar or None,
        'interests': parse_json_array(user.interests, INTEREST_IDS),
        'isPrivate': bool(user.is_private),
    }


def self_dto(user):
    """DTO do próprio usuário — inclui nascimento e política de mensagens."""
    if user is None:
        return None
    payload = user_dto(user)
    payload['birthDate'] = user.birth_date.isoformat() if user.birth_date else None
    payload['messagePolicy'] = user.message_policy or 'connections'
    return payload


def brief_user_dto(user):
    """DTO enxuto usado em posts, comentários e conversas."""
    if user is None:
        return None
    return {
        'id': user.id,
        'username': user.username,
        'name': user.name,
        'avatar': user.avatar or None,
        'isPrivate': bool(user.is_private),
    }


def stats_for(user_id):
    """Contadores públicos exibidos no perfil."""
    from dating.models import IdentityVerification
    from social.models import Comment, Follow, Like, Post, Story

    likes_received = (
        Like.objects.filter(post__user_id=user_id)
        .values('post_id')
        .annotate(total=Count('id'))
        .count()
    )
    verified = IdentityVerification.objects.filter(
        user_id=user_id,
        status='approved',
    ).exists()

    return {
        'posts': Post.objects.filter(user_id=user_id).count(),
        'followers': Follow.objects.filter(following_id=user_id).count(),
        'following': Follow.objects.filter(follower_id=user_id).count(),
        'comments': Comment.objects.filter(user_id=user_id).count(),
        'stories': Story.objects.filter(user_id=user_id).count(),
        'likesReceived': likes_received,
        'verified': 1 if verified else 0,
    }


def badges_for(user, stats):
    """Conquistas desbloqueadas pelo usuário."""
    earned = []
    labels = {item['id']: item for item in BADGES}

    def add(badge_id):
        badge = labels.get(badge_id)
        if badge:
            earned.append(
                {
                    'id': badge['id'],
                    'label': badge['label'],
                    'icon': badge['icon'],
                    'description': badge['description'],
                }
            )

    if stats['posts'] >= 1:
        add('first_post')
    if stats['posts'] >= 5:
        add('creator')
    if stats['posts'] >= 10:
        add('prolific')
    if stats['followers'] >= 1:
        add('first_follower')
    if stats['followers'] >= 10:
        add('popular')
    if stats['followers'] >= 50:
        add('influencer')
    if stats['following'] >= 1:
        add('explorer')
    if stats['comments'] >= 5:
        add('conversador')
    if stats['stories'] >= 1:
        add('storyteller')
    if stats['verified']:
        add('verified')

    account_age = now_ms() - int(user.created_at or now_ms())
    if account_age >= 7 * 24 * 60 * 60 * 1000:
        add('veteran')

    return earned


# ---------------------------------------------------------------------------
# Relações
# ---------------------------------------------------------------------------


def is_blocked(user_a, user_b):
    """Bloqueio é bilateral: basta existir em qualquer direção."""
    from social.models import Block

    if not user_a or not user_b:
        return False
    return Block.objects.filter(
        Q(blocker_id=user_a.id, blocked_id=user_b.id)
        | Q(blocker_id=user_b.id, blocked_id=user_a.id)
    ).exists()


def is_following(follower, following):
    """Indica se `follower` segue `following`."""
    from social.models import Follow

    if not follower or not following:
        return False
    return Follow.objects.filter(
        follower_id=follower.id,
        following_id=following.id,
    ).exists()


def has_follow_request(requester, target):
    """Indica se existe solicitação de seguimento pendente."""
    from social.models import FollowRequest

    if not requester or not target:
        return False
    return FollowRequest.objects.filter(
        requester_id=requester.id,
        target_id=target.id,
    ).exists()


def is_close_friend(owner, friend):
    """Indica se `friend` é melhor amigo de `owner`."""
    from social.models import CloseFriend

    if not owner or not friend:
        return False
    return CloseFriend.objects.filter(
        owner_id=owner.id,
        friend_id=friend.id,
    ).exists()


def follow_request_count(target):
    """Quantidade de solicitações pendentes recebidas."""
    from social.models import FollowRequest

    return FollowRequest.objects.filter(target_id=target.id).count()


def has_conversation_between(user_a, user_b):
    """Indica se já existe uma conversa social entre os dois usuários."""
    from messaging.models import Conversation

    if not user_a or not user_b:
        return False
    conversation_ids = Conversation.objects.filter(
        kind='social',
        members__user_id=user_a.id,
    ).filter(members__user_id=user_b.id).values_list('id', flat=True)
    return conversation_ids.exists()


# ---------------------------------------------------------------------------
# Privacidade
# ---------------------------------------------------------------------------


def can_view_user_content(viewer, owner):
    """
    Decide se o conteúdo de `owner` é visível para `viewer`.

    Perfil privado só é visível para quem o segue (ou para o próprio dono).
    """
    if owner is None:
        return False
    if viewer is None:
        return False
    if owner.id == viewer.id:
        return True
    if not owner.is_private:
        return True
    return is_following(viewer, owner)


def assert_can_view_owner(viewer, owner):
    """Levanta erro 403 quando o conteúdo do dono é privado."""
    if not can_view_user_content(viewer, owner):
        from common.errors import ApiError

        raise ApiError(
            403,
            'Este perfil é privado. Envie uma solicitação para seguir e ver o conteúdo.',
        )


def can_message_target(me, target):
    """
    Regra de visibilidade do botão "Enviar mensagem".

    - `everyone` → qualquer usuário pode falar com o alvo;
    - `nobody` → ninguém inicia conversa;
    - `connections` → exige seguidores mútuos OU conversa já existente.

    Bloqueio em qualquer direção sempre impede.
    """
    if not me or not target or me.id == target.id:
        return False
    if is_blocked(me, target):
        return False
    policy = target.message_policy or 'connections'
    if policy == 'everyone':
        return True
    if policy == 'nobody':
        return False
    return (
        is_following(me, target) and is_following(target, me)
    ) or has_conversation_between(me, target)


def social_send_allowed(me, target):
    """
    Regra de envio de mensagem social já em andamento.

    Mais restritiva que `can_message_target`: exige seguidores mútuos, sem
    a exceção da conversa pré-existente.
    """
    if not me or not target or me.id == target.id:
        return False
    if is_blocked(me, target):
        return False
    policy = target.message_policy or 'connections'
    if policy == 'everyone':
        return True
    if policy == 'nobody':
        return False
    return is_following(me, target) and is_following(target, me)


# ---------------------------------------------------------------------------
# Notificações
# ---------------------------------------------------------------------------


def notify(user_id, kind, text, link=None):
    """Cria uma notificação persistida para o usuário."""
    from social.models import Notification

    if not user_id:
        return None
    return Notification.objects.create(
        user_id=user_id,
        kind=kind,
        text=text,
        link=link,
        created_at=now_ms(),
    )


def unread_notifications(user_id):
    """Quantidade de notificações não lidas."""
    from social.models import Notification

    return Notification.objects.filter(user_id=user_id, read_at__isnull=True).count()


def accept_follow_request_row(request_row):
    """Aceita uma solicitação de seguimento e notifica o solicitante."""
    from social.models import Follow

    timestamp = now_ms()
    Follow.objects.get_or_create(
        follower_id=request_row.requester_id,
        following_id=request_row.target_id,
        defaults={'created_at': timestamp},
    )
    request_row.delete()

    from accounts.models import User

    requester = User.objects.filter(id=request_row.requester_id).first()
    target = User.objects.filter(id=request_row.target_id).first()
    if requester and target:
        notify(
            requester.id,
            'follow_accept',
            f'{target.name} aceitou sua solicitação de seguir.',
            f'/?profile={target.username}',
        )


def block_relationships(blocker, blocked):
    """Quebra todos os vínculos ao bloquear alguém."""
    from dating.models import Match
    from social.models import Follow, FollowRequest

    Follow.objects.filter(
        Q(follower_id=blocker.id, following_id=blocked.id)
        | Q(follower_id=blocked.id, following_id=blocker.id)
    ).delete()
    FollowRequest.objects.filter(
        Q(requester_id=blocker.id, target_id=blocked.id)
        | Q(requester_id=blocked.id, target_id=blocker.id)
    ).delete()

    matches = Match.objects.filter(
        Q(user_a=blocker.id, user_b=blocked.id)
        | Q(user_a=blocked.id, user_b=blocker.id),
        ended_at__isnull=True,
    )
    for match in matches:
        match.ended_at = now_ms()
        match.ended_by = blocker
        match.save(update_fields=['ended_at', 'ended_by'])
        match.location_consents.all().delete()
