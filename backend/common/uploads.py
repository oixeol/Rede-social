"""
Gravação e remoção de uploads (imagens e vídeos).

O servidor Node.js aceitava *data URLs* em base64 e gravava os arquivos em
`DATA_DIR/uploads`, expondo-os em `/uploads/<arquivo>`. O Django mantém o
mesmo contrato: as rotas de API recebem os mesmos campos e devolvem as mesmas
URLs, para que o frontend não precise mudar.
"""

import base64
import binascii
import os
import re
import uuid

from django.conf import settings

from common.errors import ApiError

# Formatos aceitos — espelham as expressões regulares do servidor Node.js.
IMAGE_RE = re.compile(r'^data:image/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=\s]+)$')
VIDEO_RE = re.compile(r'^data:video/(mp4|webm);base64,([A-Za-z0-9+/=\s]+)$')

# Limite de tamanho do *data URL* (string completa) e do arquivo decodificado.
MAX_DATA_URL_BYTES = 35 * 1024 * 1024
MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_VIDEO_BYTES = 25 * 1024 * 1024

# `video-<id do usuário>-<hash>.<ext>` — o Node gerava esse nome para validar
# que o vídeo pertence a quem está_publicando.
VIDEO_FILENAME_RE = re.compile(r'^video-(\d+)-[a-f0-9]+\.(mp4|webm)$')


def upload_dir():
    """Diretório onde os uploads são gravados."""
    path = getattr(settings, 'VIBRA_UPLOAD_DIR', None)
    if path:
        return str(path)
    media_root = getattr(settings, 'MEDIA_ROOT', None)
    if media_root:
        return os.path.join(str(media_root), 'uploads')
    return os.path.join(str(settings.BASE_DIR), 'uploads')


def ensure_upload_dir():
    """Cria o diretório de uploads se ainda não existir."""
    os.makedirs(upload_dir(), exist_ok=True)


def _decode_data_url(data_url, regex, video):
    """Valida o data URL e devolve `(buffer, extensão)`."""
    if not isinstance(data_url, str) or len(data_url) > MAX_DATA_URL_BYTES:
        raise ApiError(400, 'Vídeo inválido.' if video else 'Imagem inválida.')

    match = regex.match(data_url)
    if not match:
        if video:
            raise ApiError(400, 'Formato de vídeo não suportado. Use MP4 ou WEBM.')
        raise ApiError(400, 'Formato de imagem não suportado. Use PNG, JPG, WEBP ou GIF.')

    extension = match.group(1).lower()
    extension = 'jpg' if extension == 'jpeg' else extension
    try:
        buffer = base64.b64decode(re.sub(r'\s', '', match.group(2)), validate=False)
    except (binascii.Error, ValueError):
        raise ApiError(400, 'Arquivo vazio.')

    if not buffer:
        raise ApiError(400, 'Arquivo vazio.')

    limit = MAX_VIDEO_BYTES if video else MAX_IMAGE_BYTES
    if len(buffer) > limit:
        if video:
            raise ApiError(413, 'Vídeo muito grande (limite de 25 MB).')
        raise ApiError(413, 'Imagem muito grande (limite de 8 MB).')

    return buffer, extension


def save_upload(data_url, prefix, video=False):
    """Grava um data URL no disco e devolve a URL pública (`/uploads/...`)."""
    regex = VIDEO_RE if video else IMAGE_RE
    buffer, extension = _decode_data_url(data_url, regex, video)
    filename = f'{prefix}-{uuid.uuid4()}.{extension}'
    ensure_upload_dir()
    with open(os.path.join(upload_dir(), filename), 'wb') as handle:
        handle.write(buffer)
    return f'/uploads/{filename}'


def save_image(data_url, prefix):
    """Grava uma imagem recebida como data URL."""
    return save_upload(data_url, prefix, video=False)


def save_video(data_url, prefix):
    """Grava um vídeo recebido como data URL."""
    return save_upload(data_url, prefix, video=True)


def save_video_stream(uploaded_file, user_id, max_bytes=1024 * 1024 * 1024):
    """
    Grava um vídeo enviado em streaming (`POST /api/uploads/video`).

    Devolve o dicionário `{url, size}` no mesmo formato do Node.
    """
    if uploaded_file is None:
        raise ApiError(400, 'Vídeo inválido.')

    content_type = (getattr(uploaded_file, 'content_type', '') or '').lower()
    extension = 'webm' if content_type == 'video/webm' else 'mp4'
    filename = f'video-{user_id}-{uuid.uuid4().hex[:16]}.{extension}'
    ensure_upload_dir()

    size = 0
    chunks = []
    for chunk in uploaded_file.chunks():
        size += len(chunk)
        if size > max_bytes:
            raise ApiError(413, 'Vídeo muito grande (limite de 1 GB).')
        chunks.append(chunk)

    if not size:
        raise ApiError(400, 'Arquivo vazio.')

    with open(os.path.join(upload_dir(), filename), 'wb') as handle:
        for chunk in chunks:
            handle.write(chunk)

    return {'url': f'/uploads/{filename}', 'size': size}


def require_video_upload(value, user_id):
    """
    Valida a URL de um vídeo já enviado.

    O arquivo precisa existir e ter sido enviado pelo próprio usuário — é o que
    impede que alguém use o vídeo de outra pessoa.
    """
    if not isinstance(value, str):
        raise ApiError(400, 'Vídeo inválido.')
    url = value.strip()
    if not url.startswith('/uploads/'):
        raise ApiError(400, 'Vídeo inválido.')
    filename = url[len('/uploads/'):]
    match = VIDEO_FILENAME_RE.match(filename)
    if not match or int(match.group(1)) != int(user_id):
        raise ApiError(400, 'Vídeo inválido.')
    if not os.path.exists(os.path.join(upload_dir(), filename)):
        raise ApiError(400, 'Vídeo não encontrado. Envie novamente.')
    return url


def remove_upload_if_unused(url, is_used=None):
    """
    Remove o arquivo quando nenhuma referência o utiliza.

    `is_used` recebe uma função de consulta que devolve `True` quando o
    arquivo ainda é referenciado por alguma tabela.
    """
    if not isinstance(url, str) or not url.startswith('/uploads/'):
        return
    filename = url[len('/uploads/'):]
    if '/' in filename or '\\' in filename:
        return
    if is_used is not None and is_used(url):
        return
    try:
        os.remove(os.path.join(upload_dir(), filename))
    except OSError:
        pass
