"""
Catálogos estáticos da plataforma.

Os identificadores são persistidos no banco, então alterar um `id` invalida
os registros já gravados. O formato é idêntico ao usado pelo servidor
Node.js para que o frontend continue interpretando os mesmos valores.
"""

# ---------------------------------------------------------------------------
# Identidade do produto
# ---------------------------------------------------------------------------
APP_NAME = 'Vibra'
APP_SLUG = 'vibra'
APP_TAGLINE = 'Conexões que fazem sentido.'
APP_DESCRIPTION = (
    'Rede social e descoberta de afinidades para adultos, com privacidade por padrão.'
)

# ---------------------------------------------------------------------------
# Interesses
# ---------------------------------------------------------------------------
INTERESTS = [
    {'id': 'games', 'label': 'Games', 'group': 'Cultura digital'},
    {'id': 'musica', 'label': 'Música', 'group': 'Cultura'},
    {'id': 'filmes', 'label': 'Filmes e séries', 'group': 'Cultura'},
    {'id': 'futebol', 'label': 'Futebol', 'group': 'Esportes'},
    {'id': 'academia', 'label': 'Academia', 'group': 'Esportes'},
    {'id': 'tecnologia', 'label': 'Tecnologia', 'group': 'Conhecimento'},
    {'id': 'viagens', 'label': 'Viagens', 'group': 'Experiências'},
    {'id': 'livros', 'label': 'Livros', 'group': 'Conhecimento'},
    {'id': 'arte', 'label': 'Arte', 'group': 'Cultura'},
    {'id': 'culinaria', 'label': 'Culinária', 'group': 'Sabores'},
    {'id': 'natureza', 'label': 'Natureza', 'group': 'Experiências'},
    {'id': 'humor', 'label': 'Humor', 'group': 'Cultura'},
    {'id': 'fotografia', 'label': 'Fotografia', 'group': 'Cultura'},
    {'id': 'corrida', 'label': 'Corrida', 'group': 'Esportes'},
    {'id': 'cafe', 'label': 'Café', 'group': 'Sabores'},
    {'id': 'design', 'label': 'Design', 'group': 'Cultura'},
    {'id': 'animais', 'label': 'Animais', 'group': 'Estilo de vida'},
    {'id': 'cozinhar', 'label': 'Cozinhar', 'group': 'Sabores'},
    {'id': 'cinema', 'label': 'Cinema', 'group': 'Cultura'},
    {'id': 'praia', 'label': 'Praia', 'group': 'Natureza'},
    {'id': 'trilhas', 'label': 'Trilhas', 'group': 'Natureza'},
    {'id': 'boardgames', 'label': 'Jogos de tabuleiro', 'group': 'Cultura digital'},
    {'id': 'podcasts', 'label': 'Podcasts', 'group': 'Cultura'},
    {'id': 'musica-ao-vivo', 'label': 'Shows', 'group': 'Cultura'},
]

# Conjunto de IDs válidos: usado para validar entrada de interesses.
INTEREST_IDS = {item['id'] for item in INTERESTS}

# Mapa `id -> label` para renderizar chips na interface.
INTEREST_LABELS = {item['id']: item['label'] for item in INTERESTS}

# ---------------------------------------------------------------------------
# Tópicos de publicação
# ---------------------------------------------------------------------------
POST_TOPICS = [
    'cotidiano',
    'fotografia',
    'natureza',
    'arte',
    'gastronomia',
    'tecnologia',
    'viagens',
    'esportes',
]

# ---------------------------------------------------------------------------
# Política de mensagens
# ---------------------------------------------------------------------------
MESSAGE_POLICIES = ('everyone', 'connections', 'nobody')

# ---------------------------------------------------------------------------
# Badges
# ---------------------------------------------------------------------------
BADGES = [
    {
        'id': 'first_post',
        'label': 'Primeira publicação',
        'icon': 'camera',
        'description': 'Publicou a primeira foto ou vídeo.',
    },
    {
        'id': 'creator',
        'label': 'Criador',
        'icon': 'image',
        'description': 'Publicou 5 ou mais publicações.',
    },
    {
        'id': 'prolific',
        'label': 'Prolítico',
        'icon': 'spark',
        'description': 'Publicou 10 ou mais publicações.',
    },
    {
        'id': 'first_follower',
        'label': 'Primeiro seguidor',
        'icon': 'users',
        'description': 'Ganhou o primeiro seguidor.',
    },
    {
        'id': 'popular',
        'label': 'Popular',
        'icon': 'heart',
        'description': 'Chegou a 10 seguidores.',
    },
    {
        'id': 'influencer',
        'label': 'Influente',
        'icon': 'spark',
        'description': 'Chegou a 50 seguidores.',
    },
    {
        'id': 'explorer',
        'label': 'Explorador',
        'icon': 'compass',
        'description': 'Começou a seguir outras pessoas.',
    },
    {
        'id': 'conversador',
        'label': 'Conversador',
        'icon': 'message',
        'description': 'Deixou 5 ou mais comentários.',
    },
    {
        'id': 'storyteller',
        'label': 'Storyteller',
        'icon': 'image',
        'description': 'Publicou o primeiro story.',
    },
    {
        'id': 'verified',
        'label': 'Verificado',
        'icon': 'shield',
        'description': 'Identidade verificada na área de namoro.',
    },
    {
        'id': 'veteran',
        'label': 'Veterano',
        'icon': 'check',
        'description': 'Conta ativa há mais de 7 dias.',
    },
]

# ---------------------------------------------------------------------------
# Moderação
# ---------------------------------------------------------------------------
PROBLEM_CATEGORIES = ('bug', 'layout', 'login', 'performance', 'moderation', 'other')
REPORT_TARGET_TYPES = ('user', 'post', 'story', 'message')
REPORT_STATUSES = ('open', 'reviewing', 'resolved', 'dismissed')

# ---------------------------------------------------------------------------
# Reações de story
# ---------------------------------------------------------------------------
STORY_REACTIONS = ('❤️', '😂', '😮', '😢', '👏', '🔥', '😍', '💯')
