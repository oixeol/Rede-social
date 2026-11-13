'use strict';

/**
 * Domínio de namoro do Vibra.
 *
 * Regras centrais:
- Nenhuma rota de namoro funciona sem verificação aprovada e idade >= 18.
- Interesses, objetivos e respostas ficam separados do perfil social.
- Radar só compartilha distância aproximada com consentimento dos dois lados.
- Coordenadas nunca saem pela API.
- A pontuação de afinidade é uma estimativa declarada, não uma medida científica.
 * - Nenhuma rota de namoro funciona sem verificação aprovada e idade >= 18.
 * - Interesses, objetivos e respostas ficam separados do perfil social.
 * - Radar só compartilha distância aproximada com consentimento dos dois lados.
 * - Coordenadas nunca saem pela API.
 *
 * A pontuação de afinidade é uma estimativa declarada, não uma medida científica.
 */

/* ------------------------------------------------------------------ */
/* Constantes e helpers de serialização                                 */
/* ------------------------------------------------------------------ */
const GOALS = [
  { id: 'amizade', label: 'Amizade' },
  { id: 'paquera', label: 'Paquera' },
  { id: 'relacionamento', label: 'Relacionamento sério' },
  { id: 'interesses', label: 'Conhecer pessoas com interesses semelhantes' },
  { id: 'hobbies', label: 'Hobbies e atividades' },
  { id: 'aberto', label: 'Sem objetivo definido' },
];

/* O catálogo de objetivos é a fonte de verdade para validar os IDs usados
   no perfil e nas respostas do questionário. */
const GOAL_IDS = new Set(GOALS.map((item) => item.id));

const QUESTIONS = [
  {
    id: 'q_objetivos',
    category: 'Objetivos',
    prompt: 'O que você busca por aqui?',
    type: 'multi',
    required: true,
    options: GOALS,
  },
  {
    id: 'q_interesses',
    category: 'Interesses',
    prompt: 'Quais temas têm a sua cara?',
    type: 'multi',
    required: true,
    options: null, // catálogo de interesses
  },
  {
    id: 'q_fim_de_semana',
    category: 'Estilo de vida',
    prompt: 'Um fim de semana ideal é...',
    type: 'single',
    required: true,
    options: [
      { id: 'casa', label: 'Ficar em casa, sem pressa' },
      { id: 'rua', label: 'Sair, ver gente e descobrir lugares' },
      { id: 'natureza', label: 'Ar livre, trilha ou praia' },
      { id: 'cultura', label: 'Cinema, show, museu ou livro' },
    ],
  },
  {
    id: 'q_conversa',
    category: 'Personalidade',
    prompt: 'Que tipo de conversa prende você?',
    type: 'scale',
    required: true,
    left: 'Leve e descontraída',
    right: 'Profunda e demorada',
  },
  {
    id: 'q_planejamento',
    category: 'Personalidade',
    prompt: 'Como você organiza a vida?',
    type: 'scale',
    required: true,
    left: 'Improviso sempre',
    right: 'Planejo cada detalhe',
  },
  {
    id: 'q_grupos',
    category: 'Preferências sociais',
    prompt: 'Seu grupo favorito é...',
    type: 'single',
    required: true,
    options: [
      { id: 'intimo', label: 'Poucas pessoas, bem próximas' },
      { id: 'medio', label: 'Um grupo pequeno e variado' },
      { id: 'grande', label: 'Festa grande, muita energia' },
    ],
  },
  {
    id: 'q_pessoas_novas',
    category: 'Preferências sociais',
    prompt: 'Conhecer pessoas novas é...',
    type: 'scale',
    required: false,
    left: 'Algo raro para mim',
    right: 'Uma das minhas coisas favoritas',
  },
  {
    id: 'q_rotina',
    category: 'Estilo de vida',
    prompt: 'Sua rotina ideal pende mais para...',
    type: 'single',
    required: false,
    options: [
      { id: 'calma', label: 'Ritmo calmo e previsível' },
      { id: 'equilibrada', label: 'Um pouco de cada coisa' },
      { id: 'agitada', label: 'Agenda cheia e movimento' },
    ],
  },
  {
    id: 'q_atividade',
    category: 'Estilo de vida',
    prompt: 'Movimento no dia a dia?',
    type: 'single',
    required: false,
    options: [
      { id: 'sedentario', label: 'Prefiro algo mais tranquilo' },
      { id: 'leve', label: 'Caminhadas e atividades leves' },
      { id: 'frequente', label: 'Treino ou esporte com frequência' },
    ],
  },
  {
    id: 'q_viagem',
    category: 'Estilo de vida',
    prompt: 'Uma viagem perfeita seria...',
    type: 'single',
    required: false,
    options: [
      { id: 'praia', label: 'Praia e descanso' },
      { id: 'cidade', label: 'Cidade grande e cultura' },
      { id: 'natureza', label: 'Natureza e aventura' },
      { id: 'perto', label: 'Qualquer lugar, com boa companhia' },
    ],
  },
];

/* Índices derivados do catálogo permitem validar rapidamente as respostas.
   MIN_ANSWES combina com as perguntas obrigatórias para liberar a descoberta. */
const QUESTION_BY_ID = new Map(QUESTIONS.map((question) => [question.id, question]));
const REQUIRED_QUESTIONS = QUESTIONS.filter((question) => question.required).map((question) => question.id);
const MIN_ANSWERS = 6;
const FRESH_LOCATION_MS = 2 * 60 * 60 * 1000;
const MAX_DISTANCE_KM = 400;
const MIN_DISTANCE_KM = 10;
const ALERT_THRESHOLDS = [500, 1000, 5000, 10000];

/**
 * Converte um valor textual JSON em array, tolerando dados ausentes ou corrompidos.
 * @param {*} value Texto JSON possivelmente vazio ou inválido.
 * @returns {Array} Array vazio quando o valor não puder ser interpretado.
 */
/**
 * Converte um valor JSON em array, retornando [] quando falha.
 * @param {*} value Texto JSON ou valor vazio.
 * @returns {Array} Array de valores.
 */
function jsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Busca todas respostas do questionário de namoro de um usuário.
 * @param {object} db Conexão SQLite.
 * @param {string|number} userId ID do usuário.
 * @returns {Map} Mapa question_id -> resposta (já JSON). Respostas corrompidas são ignoradas.
 */
function answersFor(db, userId) {
  const rows = db.prepare('SELECT question_id, answer FROM compatibility_answers WHERE user_id = ?').all(userId);
  const map = new Map();
  for (const row of rows) {
    try {
      map.set(row.question_id, JSON.parse(row.answer));
    } catch {
      /* resposta corrompida é ignorada */
    }
  }
  return map;
}

/**
 * Calcula o progresso das respostas do questionário.
 * @param {object} db Conexão SQLite.
 * @param {string|number} userId ID do usuário.
 * @returns {object} Contagens de respostas e flag `complete`.
 */
function answersProgress(db, userId) {
  const answers = answersFor(db, userId);
  const answered = [...answers.keys()].filter((id) => QUESTION_BY_ID.has(id)).length;
  const requiredAnswered = REQUIRED_QUESTIONS.filter((id) => answers.has(id)).length;
  return {
    answered,
    total: QUESTIONS.length,
    requiredAnswered,
    requiredTotal: REQUIRED_QUESTIONS.length,
    minimum: MIN_ANSWERS,
    complete: requiredAnswered === REQUIRED_QUESTIONS.length && answered >= MIN_ANSWERS,
  };
}

/* ------------------------------------------------------------------ */
/* Perfil de namoro (dados e manipulação)                           */
/* ------------------------------------------------------------------ */
function profileRow(db, userId) {
  return db.prepare('SELECT * FROM dating_profiles WHERE user_id = ?').get(userId) || null;
}

/**
 * Garante a existência de um perfil de namoro com valores padrão.
 * @param {object} db Conexão SQLite.
 * @param {string|number} userId ID do usuário.
 * @param {number} timestamp Momento atual.
 * @returns {object} Perfil criado ou já existente.
 */
function ensureProfile(db, userId, timestamp) {
  db.prepare(
    `INSERT OR IGNORE INTO dating_profiles
     (user_id, bio, photos, interests, goals, age_min, age_max, distance_km, active, paused, radar_enabled, created_at, updated_at)
     VALUES (?, '', '[]', '[]', '[]', 24, 45, 50, 1, 0, 0, ?, ?)`
  ).run(userId, timestamp, timestamp);
  return profileRow(db, userId);
}

/**
 * Garante a existência de um perfil de namoro com valores padrão.
 * @param {object} db Conexão SQLite.
 * @param {string|number} userId ID do usuário.
 * @param {number} timestamp Momento atual.
 * @returns {object} Perfil criado ou já existente.
 */
/**
 * Converte a linha do perfil de namoro em um objeto seguro para a API.
 * @param {object} ctx Contexto da aplicação.
 * @param {object|null} row Linha bruta do perfil.
 * @param {object} user Usuário dono do perfil.
 * @returns {object|null} DTO do perfil ou null.
 */
function profileDTO(ctx, row, user) {
  if (!row) return null;
  const age = ctx.publicAge(user.birth_date);
  return {
    userId: row.user_id,
    bio: row.bio,
    photos: jsonArray(row.photos),
    interestIds: jsonArray(row.interests),
    interests: ctx.interestLabels(jsonArray(row.interests)),
    goals: jsonArray(row.goals).filter((id) => GOAL_IDS.has(id)),
    goalLabels: jsonArray(row.goals)
      .filter((id) => GOAL_IDS.has(id))
      .map((id) => GOALS.find((goal) => goal.id === id)?.label)
      .filter(Boolean),
    age,
    ageMin: row.age_min,
    ageMax: row.age_max,
    distanceKm: row.distance_km,
    active: !!row.active,
    paused: !!row.paused,
    radarEnabled: !!row.radar_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Lista IDs com verificação de identidade aprovada e ainda válida.
 * @param {object} db Conexão SQLite.
 * @returns {Set<string|number>} Conjunto de IDs verificados.
 */
function verifiedUserIds(db) {
  const timestamp = Date.now();
  const rows = db
    .prepare(
      `SELECT user_id FROM identity_verifications
       WHERE status = 'approved' AND (expires_at IS NULL OR expires_at > ?)`
    )
    .all(timestamp);
  return new Set(rows.map((row) => row.user_id));
}

/**
 * Extrai os objetivos válidos de um perfil de namoro.
 * @param {object|null} profile Linha do perfil.
 * @returns {Array<string>} IDs de objetivos reconhecidos.
 */
function goalsFor(profile) {
  return profile ? jsonArray(profile.goals).filter((id) => GOAL_IDS.has(id)) : [];
}

/**
 * Extrai as áreas de interesse de um perfil.
 * @param {object|null} profile Linha do perfil.
 * @returns {Array<string>} IDs de interesses.
 */
function interestsFor(profile) {
  return profile ? jsonArray(profile.interests) : [];
}

/**
 * Recupera o snapshot de localização do usuário.
 * @param {object} db Conexão SQLite.
 * @param {string|number} userId ID do usuário.
 * @returns {object|null} Snapshot de localização ou null.
 */
function locationFor(db, userId) {
  return db.prepare('SELECT * FROM location_snapshots WHERE user_id = ?').get(userId) || null;
}

function locationIsFresh(snapshot, timestamp) {
  return !!snapshot && timestamp - snapshot.updated_at <= FRESH_LOCATION_MS;
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const rad = (value) => (value * Math.PI) / 180;
  const earth = 6371000;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function formatDistance(meters) {
  if (meters < 100) return 'a menos de 100 m';
  if (meters < 1000) return `a aproximadamente ${Math.max(100, Math.round(meters / 100) * 100)} m`;
  if (meters < 10000) {
    const value = Math.round(meters / 100) / 10;
    return `a aproximadamente ${String(value).replace('.', ',')} km`;
  }
  return `a aproximadamente ${Math.round(meters / 1000)} km`;
}

function ageInRange(age, min, max) {
  return Number.isInteger(age) && age >= min && age <= max;
}

function sharedCount(a, b) {
  return a.filter((item) => b.includes(item)).length;
}

function similarity(a, b, max = 4) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return 1 - Math.abs(a - b) / max;
}

function compatibility(ctx, me, myProfile, candidateUser, candidateProfile) {
  const timestamp = ctx.now();
  const myAnswers = answersFor(ctx.db, me.id);
  const theirAnswers = answersFor(ctx.db, candidateUser.id);
  const myInterests = interestsFor(myProfile);
  const theirInterests = interestsFor(candidateProfile);
  const myGoals = goalsFor(myProfile);
  const theirGoals = goalsFor(candidateProfile);
  const sharedInterests = myInterests.filter((id) => theirInterests.includes(id));
  const sharedGoals = myGoals.filter((id) => theirGoals.includes(id));

  let score = 0;
  score += Math.min(32, sharedInterests.length * 8);
  if (sharedGoals.length) score += 18;

  const scales = ['q_conversa', 'q_planejamento', 'q_pessoas_novas'];
  const scaleScores = scales
    .map((id) => similarity(myAnswers.get(id), theirAnswers.get(id)))
    .filter((value) => value !== null);
  if (scaleScores.length) {
    score += Math.round((scaleScores.reduce((sum, value) => sum + value, 0) / scaleScores.length) * 12);
  }

  for (const id of ['q_fim_de_semana', 'q_grupos']) {
    if (myAnswers.get(id) && myAnswers.get(id) === theirAnswers.get(id)) score += 5;
  }
  for (const id of ['q_rotina', 'q_atividade', 'q_viagem']) {
    if (myAnswers.get(id) && myAnswers.get(id) === theirAnswers.get(id)) score += 3;
  }

  /* Nenhuma distância é calculada ou exibida antes do match. O Radar é um
     recurso exclusivo de matches com consentimento dos dois lados. */
  score += 4;

  const recentlyActive = candidateProfile.updated_at > timestamp - 30 * 24 * 60 * 60 * 1000;
  if (recentlyActive) score += 5;

  const reasons = [];
  if (sharedInterests.length) {
    reasons.push(
      `${sharedInterests.length} ${sharedInterests.length === 1 ? 'interesse em comum' : 'interesses em comum'}: ${ctx
        .interestLabels(sharedInterests)
        .slice(0, 4)
        .join(', ')}`
    );
  }
  if (sharedGoals.length) {
    reasons.push(
      `Objetivos em comum: ${sharedGoals
        .map((id) => GOALS.find((goal) => goal.id === id)?.label)
        .filter(Boolean)
        .join(', ')}`
    );
  }
  if (scaleScores.length && scaleScores.reduce((sum, value) => sum + value, 0) / scaleScores.length >= 0.65) {
    reasons.push('Ritmo de conversa e sociabilidade parecidos');
  }
  if (myAnswers.get('q_fim_de_semana') && myAnswers.get('q_fim_de_semana') === theirAnswers.get('q_fim_de_semana')) {
    reasons.push('Vocês imaginam o fim de semana de forma parecida');
  }
  if (recentlyActive) reasons.push('Perfil ativo recentemente');

  return {
    score: Math.max(0, Math.min(99, Math.round(score))),
    sharedInterests,
    sharedGoals,
    distanceMeters: null,
    distanceLabel: 'Distância privada até o match',
    reasons: reasons.slice(0, 4),
  };
}

function eligiblePair(ctx, me, myProfile, targetUser, targetProfile) {
  if (me.id === targetUser.id) return false;
  if (ctx.isBlocked(me.id, targetUser.id)) return false;
  if (!targetProfile || !targetProfile.active || targetProfile.paused) return false;
  if (!ctx.isAdult(targetUser.birth_date) || !ctx.isAdult(me.birth_date)) return false;
  const verified = verifiedUserIds(ctx.db);
  if (!verified.has(targetUser.id) || !verified.has(me.id)) return false;
  const myAge = ctx.publicAge(me.birth_date);
  const theirAge = ctx.publicAge(targetUser.birth_date);
  if (!ageInRange(theirAge, myProfile.age_min, myProfile.age_max)) return false;
  if (!ageInRange(myAge, targetProfile.age_min, targetProfile.age_max)) return false;
  const myGoals = goalsFor(myProfile);
  const theirGoals = goalsFor(targetProfile);
  if (myGoals.length && theirGoals.length && !myGoals.some((goal) => theirGoals.includes(goal))) return false;

  /* A preferência de distância é aplicada apenas quando as duas pessoas
     compartilham uma localização aproximada e recente. O valor nunca é
     devolvido na descoberta; a distância só aparece após um match com
     consentimento bilateral no Radar. */
  const timestamp = ctx.now();
  const myLocation = locationFor(ctx.db, me.id);
  const theirLocation = locationFor(ctx.db, targetUser.id);
  if (
    myProfile.radar_enabled &&
    targetProfile.radar_enabled &&
    locationIsFresh(myLocation, timestamp) &&
    locationIsFresh(theirLocation, timestamp) &&
    myLocation.accuracy <= 2000 &&
    theirLocation.accuracy <= 2000
  ) {
    const meters = haversineMeters(myLocation.lat, myLocation.lng, theirLocation.lat, theirLocation.lng);
    if (meters > myProfile.distance_km * 1000) return false;
    if (meters > targetProfile.distance_km * 1000) return false;
  }
  return true;
}

function currentMatch(db, a, b) {
  const [userA, userB] = a < b ? [a, b] : [b, a];
  return db
    .prepare('SELECT * FROM matches WHERE user_a = ? AND user_b = ? AND ended_at IS NULL')
    .get(userA, userB);
}

function matchForUser(db, matchId, userId) {
  const match = db.prepare('SELECT * FROM matches WHERE id = ? AND ended_at IS NULL').get(matchId);
  if (!match || (match.user_a !== userId && match.user_b !== userId)) return null;
  return match;
}

function otherUser(db, match, userId) {
  const otherId = match.user_a === userId ? match.user_b : match.user_a;
  return db.prepare('SELECT * FROM users WHERE id = ?').get(otherId);
}

function radarState(ctx, match, me, other) {
  const myConsent = ctx.db
    .prepare('SELECT enabled FROM location_consents WHERE match_id = ? AND user_id = ?')
    .get(match.id, me.id);
  const theirConsent = ctx.db
    .prepare('SELECT enabled FROM location_consents WHERE match_id = ? AND user_id = ?')
    .get(match.id, other.id);
  const myProfile = profileRow(ctx.db, me.id);
  const theirProfile = profileRow(ctx.db, other.id);
  const myLocation = locationFor(ctx.db, me.id);
  const theirLocation = locationFor(ctx.db, other.id);
  const timestamp = ctx.now();
  const globalEnabled = !!myProfile?.radar_enabled;
  const theirGlobalEnabled = !!theirProfile?.radar_enabled;
  const myFresh = locationIsFresh(myLocation, timestamp) && myLocation.accuracy <= 2000;
  const theirFresh = locationIsFresh(theirLocation, timestamp) && theirLocation.accuracy <= 2000;
  const bothConsent = !!myConsent?.enabled && !!theirConsent?.enabled;
  let available = false;
  let reason = null;
  let distanceLabel = 'Distância indisponível';
  if (!globalEnabled) reason = 'radar_off';
  else if (!theirGlobalEnabled) reason = 'their_radar_off';
  else if (!myConsent?.enabled) reason = 'my_consent_missing';
  else if (!theirConsent?.enabled) reason = 'their_consent_missing';
  else if (!myFresh || !theirFresh) reason = 'location_stale';
  else {
    available = true;
    const meters = haversineMeters(myLocation.lat, myLocation.lng, theirLocation.lat, theirLocation.lng);
    distanceLabel = formatDistance(meters);
  }
  return {
    globalEnabled,
    myConsent: !!myConsent?.enabled,
    theirConsent: !!theirConsent?.enabled,
    bothConsent,
    available,
    reason,
    distanceLabel,
    myLocationUpdatedAt: myLocation ? myLocation.updated_at : null,
    theirLocationUpdatedAt: available && theirLocation ? theirLocation.updated_at : null,
  };
}

function matchDTO(ctx, match, me, other, myProfile) {
  const profile = profileRow(ctx.db, other.id);
  const age = ctx.publicAge(other.birth_date);
  const conversation = ctx.db.prepare('SELECT id FROM conversations WHERE match_id = ?').get(match.id);
  const radar = radarState(ctx, match, me, other);
  return {
    id: match.id,
    createdAt: match.created_at,
    user: ctx.userDTO(other),
    age,
    profile: profile
      ? {
          bio: profile.bio,
          photos: jsonArray(profile.photos),
          interests: ctx.interestLabels(interestsFor(profile)),
          goals: goalsFor(profile)
            .map((id) => GOALS.find((goal) => goal.id === id)?.label)
            .filter(Boolean),
        }
      : null,
    conversationId: conversation ? conversation.id : null,
    distanceLabel: radar.available ? radar.distanceLabel : 'Distância indisponível',
    distanceKnown: radar.available,
    radar,
    alerts: (() => {
      const prefs = ctx.db.prepare('SELECT * FROM radar_prefs WHERE user_id = ?').get(me.id);
      return { enabled: !!prefs?.alerts_enabled, thresholdM: prefs?.threshold_m || 1000 };
    })(),
  };
}

function access(ctx, me) {
  const status = ctx.datingStatusFor(me);
  if (!status.allowed) {
    throw new (ctx.HttpError || Error)(403, 'O Namoro exige verificação de identidade e idade aprovada.', 'dating_locked', {
      status: status.status,
      reason: status.reason,
    });
  }
  return status;
}

function normalizeAnswers(ctx, raw) {
  for (const [questionId, value] of Object.entries(raw)) {
    const question = QUESTION_BY_ID.get(questionId);
    if (!question) throw new Error(`Pergunta desconhecida: ${questionId}`);
    if (value === null) continue;
    if (question.type === 'scale') {
      if (!Number.isInteger(value) || value < 1 || value > 5) {
        throw new Error('Resposta de escala inválida.');
      }
    } else if (question.type === 'single') {
      if (typeof value !== 'string' || !question.options.some((option) => option.id === value)) {
        throw new Error('Alternativa inválida.');
      }
    } else if (question.type === 'multi') {
      if (!Array.isArray(value)) throw new Error('Selecione uma lista de opções.');
      const allowed = question.options ? new Set(question.options.map((option) => option.id)) : ctx.INTEREST_IDS;
      if (!value.every((item) => typeof item === 'string' && allowed.has(item))) {
        throw new Error('Uma das opções selecionadas é inválida.');
      }
      if (value.length > 12) throw new Error('Selecione no máximo 12 opções.');
      if (question.id === 'q_objetivos' && value.length === 0) {
        throw new Error('Escolha pelo menos um objetivo.');
      }
    }
  }
}

async function handle({ req, res, pathname, url, me, ctx }) {
  const method = req.method;
  const HttpError = ctx.HttpError || Error;

  // --- status (acessível sem verificação) ---------------------------
  if (method === 'GET' && pathname === '/api/dating/status') {
    const verification = ctx.datingStatusFor(me);
    const timestamp = ctx.now();
    const profile = profileRow(ctx.db, me.id);
    const quiz = answersProgress(ctx.db, me.id);
    const location = locationFor(ctx.db, me.id);
    const prefs = ctx.db.prepare('SELECT * FROM radar_prefs WHERE user_id = ?').get(me.id);
    const matchCount = ctx.db
      .prepare('SELECT COUNT(*) AS n FROM matches WHERE ended_at IS NULL AND (user_a = ? OR user_b = ?)')
      .get(me.id, me.id).n;
    const profileComplete =
      !!profile &&
      !!profile.active &&
      profile.bio.trim().length >= 10 &&
      interestsFor(profile).length >= 3 &&
      goalsFor(profile).length >= 1 &&
      quiz.complete;
    return jsonResponse(ctx, res, 200, {
      verification,
      age: ctx.publicAge(me.birth_date),
      profile: profileDTO(ctx, profile, me),
      quiz,
      profileComplete,
      discoveryReady: verification.allowed && profileComplete,
      matchCount,
      location: {
        shared: !!location,
        updatedAt: location ? location.updated_at : null,
        stale: location ? timestamp - location.updated_at > FRESH_LOCATION_MS : null,
      },
      radar: {
        alertsEnabled: !!prefs?.alerts_enabled,
        thresholdM: prefs?.threshold_m || 1000,
      },
      questions: QUESTIONS.map((question) => ({
        id: question.id,
        category: question.category,
        prompt: question.prompt,
        type: question.type,
        required: !!question.required,
        options:
          question.id === 'q_interesses'
            ? ctx.INTERESTS.map((interest) => ({ id: interest.id, label: interest.label }))
            : question.options || undefined,
        left: question.left,
        right: question.right,
      })),
      goals: GOALS,
      scoring: {
        note: 'A afinidade é uma estimativa baseada em interesses, objetivos, respostas e distância. Não é uma medida científica.',
      },
    });
  }

  // --- verificação ---------------------------------------------------
  if (method === 'POST' && pathname === '/api/dating/verification') {
    ctx.rateLimit(req, 'verification', 8, 60 * 60 * 1000);
    const body = await ctx.readBody(req);
    const birthDate = ctx.cleanText(body.birthDate, 'Data de nascimento', { min: 10, max: 10, required: true });
    const age = ctx.ageFromBirthDate(birthDate);
    if (age === null) throw new HttpError(400, 'Data de nascimento inválida.');
    if (age < 18) {
      throw new HttpError(403, 'O Namoro é exclusivo para pessoas com 18 anos ou mais.', 'not_adult');
    }
    if (body.consent !== true) {
      throw new HttpError(400, 'É necessário autorizar a verificação de idade e identidade.');
    }
    const fullName = ctx.cleanText(body.fullName, 'Nome completo', { min: 5, max: 120, required: true });
    if (!/\s/.test(fullName.trim())) {
      throw new HttpError(400, 'Informe nome e sobrenome.');
    }
    if (body.documentId !== undefined && String(body.documentId).length > 120) {
      throw new HttpError(400, 'Documento inválido.');
    }
    if (ctx.IDENTITY_MODE === 'disabled') {
      throw new HttpError(503, 'A verificação de identidade não está configurada neste ambiente.', 'provider_disabled');
    }
    const existing = ctx.db.prepare('SELECT * FROM identity_verifications WHERE user_id = ?').get(me.id);
    if (existing && existing.status === 'approved') {
      throw new HttpError(409, 'Sua identidade já está verificada.', 'already_verified');
    }
    /* A data da conta é imutável por aqui: sem isso, uma pessoa menor de idade
       poderia informar outra data e ser aprovada em modo de simulação. */
    if (me.birth_date && birthDate !== me.birth_date) {
      throw new HttpError(
        409,
        'A data de nascimento já registrada na conta não pode ser alterada pela verificação. Fale com o suporte se ela estiver incorreta.',
        'birth_date_locked'
      );
    }
    if (!me.birth_date) {
      ctx.db.prepare('UPDATE users SET birth_date = ? WHERE id = ?').run(birthDate, me.id);
    }
    const timestamp = ctx.now();
    const ref = `dev_${ctx.db.prepare('SELECT lower(hex(randomblob(8))) AS v').get().v}`;
    if (existing) {
      ctx.db
        .prepare(
          `UPDATE identity_verifications
           SET provider = ?, status = 'in_review', is_simulation = ?, provider_ref = ?,
               submitted_at = ?, reviewed_at = NULL, expires_at = NULL, reason = NULL
           WHERE user_id = ?`
        )
        .run(
          ctx.IDENTITY_MODE === 'dev' ? 'dev-simulation' : 'webhook',
          ctx.IDENTITY_MODE === 'dev' ? 1 : 0,
          ref,
          timestamp,
          me.id
        );
    } else {
      ctx.db
        .prepare(
          `INSERT INTO identity_verifications
           (user_id, provider, status, is_simulation, provider_ref, submitted_at)
           VALUES (?, ?, 'in_review', ?, ?, ?)`
        )
        .run(me.id, ctx.IDENTITY_MODE === 'dev' ? 'dev-simulation' : 'webhook', ctx.IDENTITY_MODE === 'dev' ? 1 : 0, ref, timestamp);
    }
    ctx.notify(me.id, 'verification', 'Sua verificação de identidade está em análise.', null);
    return jsonResponse(ctx, res, 200, {
      verification: ctx.datingStatusFor({ ...me, birth_date: birthDate }),
      simulation: ctx.IDENTITY_MODE === 'dev',
    });
  }

  if (method === 'POST' && pathname === '/api/dating/verification/dev-approve') {
    if (ctx.IDENTITY_MODE !== 'dev') {
      throw new HttpError(403, 'Aprovação simulada disponível apenas no ambiente de desenvolvimento.', 'dev_only');
    }
    ctx.rateLimit(req, 'dev-approve', 20, 60 * 60 * 1000);
    const existing = ctx.db.prepare('SELECT * FROM identity_verifications WHERE user_id = ?').get(me.id);
    if (!existing) throw new HttpError(409, 'Inicie a verificação antes.', 'not_started');
    if (!ctx.isAdult(me.birth_date)) {
      throw new HttpError(403, 'A verificação não pode ser aprovada para menores de 18 anos.', 'not_adult');
    }
    const timestamp = ctx.now();
    ctx.db
      .prepare(
        `UPDATE identity_verifications
         SET status = 'approved', is_simulation = 1, reviewed_at = ?, expires_at = ?, reason = NULL
         WHERE user_id = ?`
      )
      .run(timestamp, timestamp + 365 * 24 * 60 * 60 * 1000, me.id);
    ctx.notify(me.id, 'verification', 'Verificação aprovada em modo de simulação local.', null);
    return jsonResponse(ctx, res, 200, {
      verification: ctx.datingStatusFor(me),
      warning: 'Aprovação simulada apenas para desenvolvimento. Não é uma verificação real.',
    });
  }

  // A partir daqui, tudo exige verificação aprovada e 18+.
  access(ctx, me);

  if (method === 'GET' && pathname === '/api/dating/profile') {
    const row = profileRow(ctx.db, me.id);
    return jsonResponse(ctx, res, 200, {
      profile: profileDTO(ctx, row, me),
      quiz: answersProgress(ctx.db, me.id),
      questions: QUESTIONS,
      goals: GOALS,
    });
  }

  if (method === 'PUT' && pathname === '/api/dating/profile') {
    const body = await ctx.readBody(req);
    const timestamp = ctx.now();
    const row = ensureProfile(ctx.db, me.id, timestamp);
    const bio = body.bio === undefined ? row.bio : ctx.cleanText(body.bio, 'Bio do namoro', { max: 400 });
    let photos = jsonArray(row.photos);
    if (Array.isArray(body.photos)) {
      /* Fotos só entram pelo endpoint de upload validado. Aqui é permitido
         apenas remover/reordenar fotos que já pertencem a este perfil. */
      const allowed = new Set(photos);
      const requested = body.photos.filter((item) => typeof item === 'string' && allowed.has(item));
      if (requested.length !== body.photos.length) {
        throw new HttpError(400, 'Use o envio de fotos para adicionar novas imagens ao perfil.', 'invalid_photo');
      }
      photos = [...new Set(requested)].slice(0, 6);
    }
    const ageMin = body.ageMin === undefined ? row.age_min : Number(body.ageMin);
    const ageMax = body.ageMax === undefined ? row.age_max : Number(body.ageMax);
    if (!Number.isInteger(ageMin) || !Number.isInteger(ageMax) || ageMin < 18 || ageMax > 99 || ageMin > ageMax) {
      throw new HttpError(400, 'Faixa etária inválida. Use valores entre 18 e 99.');
    }
    const distanceKm = body.distanceKm === undefined ? row.distance_km : Number(body.distanceKm);
    if (!Number.isInteger(distanceKm) || distanceKm < MIN_DISTANCE_KM || distanceKm > MAX_DISTANCE_KM) {
      throw new HttpError(400, 'Distância de descoberta deve ficar entre 10 km e 400 km.');
    }
    const active = body.active === undefined ? !!row.active : body.active === true;
    const paused = body.paused === undefined ? !!row.paused : body.paused === true;
    const radarEnabled = body.radarEnabled === undefined ? !!row.radar_enabled : body.radarEnabled === true;
    ctx.db
      .prepare(
        `UPDATE dating_profiles SET bio = ?, photos = ?, age_min = ?, age_max = ?, distance_km = ?,
         active = ?, paused = ?, radar_enabled = ?, updated_at = ? WHERE user_id = ?`
      )
      .run(bio, JSON.stringify(photos), ageMin, ageMax, distanceKm, active ? 1 : 0, paused ? 1 : 0, radarEnabled ? 1 : 0, timestamp, me.id);
    if (!active || paused || !radarEnabled) {
      ctx.db.prepare('DELETE FROM location_snapshots WHERE user_id = ?').run(me.id);
      ctx.db
        .prepare(
          `DELETE FROM location_consents
           WHERE user_id = ? AND match_id IN (
             SELECT id FROM matches WHERE user_a = ? OR user_b = ?
           )`
        )
        .run(me.id, me.id, me.id);
    }
    const oldPhotos = jsonArray(row.photos);
    for (const photo of oldPhotos) {
      if (!photos.includes(photo)) ctx.removeUploadIfUnused(photo);
    }
    return jsonResponse(ctx, res, 200, { profile: profileDTO(ctx, profileRow(ctx.db, me.id), me) });
  }

  if (method === 'DELETE' && pathname === '/api/dating/profile') {
    const row = profileRow(ctx.db, me.id);
    if (!row) return jsonResponse(ctx, res, 200, { ok: true });
    ctx.db.prepare('UPDATE dating_profiles SET active = 0, paused = 0, radar_enabled = 0, updated_at = ? WHERE user_id = ?').run(
      ctx.now(),
      me.id
    );
    ctx.db.prepare('DELETE FROM location_snapshots WHERE user_id = ?').run(me.id);
    ctx.db.prepare('DELETE FROM location_consents WHERE user_id = ?').run(me.id);
    return jsonResponse(ctx, res, 200, { ok: true });
  }

  function socialPhotoUrls(userId) {
    const urls = new Set();
    const postRows = ctx.db.prepare('SELECT image FROM posts WHERE user_id = ?').all(userId);
    const mediaRows = ctx.db
      .prepare('SELECT pm.url FROM post_media pm JOIN posts p ON p.id = pm.post_id WHERE p.user_id = ?')
      .all(userId);
    const user = ctx.db.prepare('SELECT avatar FROM users WHERE id = ?').get(userId);
    for (const row of postRows) if (row.image) urls.add(row.image);
    for (const row of mediaRows) if (row.url) urls.add(row.url);
    if (user && user.avatar) urls.add(user.avatar);
    return [...urls];
  }

  if (method === 'GET' && pathname === '/api/dating/photo-options') {
    return jsonResponse(ctx, res, 200, { photos: socialPhotoUrls(me.id) });
  }

  if (method === 'PUT' && pathname === '/api/dating/photos') {
    const body = await ctx.readBody(req);
    const requested = Array.isArray(body.urls) ? body.urls.filter((value) => typeof value === 'string') : [];
    const allowed = new Set(socialPhotoUrls(me.id));
    const unique = [...new Set(requested.filter((url) => allowed.has(url)))].slice(0, 6);
    const timestamp = ctx.now();
    const row = ensureProfile(ctx.db, me.id, timestamp);
    ctx.db.prepare('UPDATE dating_profiles SET photos = ?, updated_at = ? WHERE user_id = ?').run(
      JSON.stringify(unique),
      timestamp,
      me.id
    );
    return jsonResponse(ctx, res, 200, { photos: unique });
  }

  if (method === 'POST' && pathname === '/api/dating/photos') {
    ctx.rateLimit(req, 'dating-photos', 30, 60 * 60 * 1000);
    const body = await ctx.readBody(req);
    const timestamp = ctx.now();
    const row = ensureProfile(ctx.db, me.id, timestamp);
    const photos = jsonArray(row.photos);
    if (photos.length >= 6) throw new HttpError(400, 'Limite de 6 fotos atingido.');
    const url = ctx.saveImage(body.image, 'dating');
    photos.push(url);
    ctx.db.prepare('UPDATE dating_profiles SET photos = ?, updated_at = ? WHERE user_id = ?').run(
      JSON.stringify(photos),
      timestamp,
      me.id
    );
    return jsonResponse(ctx, res, 201, { photo: url, photos });
  }

  if (method === 'DELETE' && pathname === '/api/dating/photos') {
    const body = await ctx.readBody(req);
    const row = profileRow(ctx.db, me.id);
    if (!row) throw new HttpError(404, 'Perfil de namoro não encontrado.');
    const photos = jsonArray(row.photos);
    const url = typeof body.url === 'string' ? body.url : '';
    if (!photos.includes(url)) throw new HttpError(404, 'Foto não encontrada.');
    const updated = photos.filter((photo) => photo !== url);
    ctx.db.prepare('UPDATE dating_profiles SET photos = ?, updated_at = ? WHERE user_id = ?').run(
      JSON.stringify(updated),
      ctx.now(),
      me.id
    );
    ctx.removeUploadIfUnused(url);
    return jsonResponse(ctx, res, 200, { photos: updated });
  }

  // --- questionário / respostas --------------------------------------
  if (method === 'GET' && pathname === '/api/dating/answers') {
    const answers = answersFor(ctx.db, me.id);
    return jsonResponse(ctx, res, 200, {
      answers: Object.fromEntries(answers),
      progress: answersProgress(ctx.db, me.id),
    });
  }

  if (method === 'PUT' && pathname === '/api/dating/answers') {
    const body = await ctx.readBody(req);
    if (!body.answers || typeof body.answers !== 'object' || Array.isArray(body.answers)) {
      throw new HttpError(400, 'Respostas inválidas.');
    }
    try {
      normalizeAnswers(ctx, body.answers);
    } catch (error) {
      throw new HttpError(400, error.message);
    }
    const timestamp = ctx.now();
    try {
      ctx.db.exec('BEGIN IMMEDIATE');
      const row = ensureProfile(ctx.db, me.id, timestamp);
      const upsert = ctx.db.prepare(
        `INSERT INTO compatibility_answers (user_id, question_id, answer, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, question_id) DO UPDATE SET answer = excluded.answer, updated_at = excluded.updated_at`
      );
      const remove = ctx.db.prepare('DELETE FROM compatibility_answers WHERE user_id = ? AND question_id = ?');
      for (const [questionId, value] of Object.entries(body.answers)) {
        if (value === null) {
          remove.run(me.id, questionId);
        } else {
          upsert.run(me.id, questionId, JSON.stringify(value), timestamp);
        }
      }
      if (body.answers.q_objetivos !== undefined) {
        const goals = Array.isArray(body.answers.q_objetivos)
          ? body.answers.q_objetivos.filter((id) => GOAL_IDS.has(id))
          : [];
        ctx.db.prepare('UPDATE dating_profiles SET goals = ?, updated_at = ? WHERE user_id = ?').run(
          JSON.stringify(goals),
          timestamp,
          me.id
        );
      }
      if (body.answers.q_interesses !== undefined) {
        const interests = Array.isArray(body.answers.q_interesses)
          ? body.answers.q_interesses.filter((id) => ctx.INTEREST_IDS.has(id))
          : [];
        ctx.db.prepare('UPDATE dating_profiles SET interests = ?, updated_at = ? WHERE user_id = ?').run(
          JSON.stringify(interests),
          timestamp,
          me.id
        );
      }
      ctx.db.exec('COMMIT');
    } catch (error) {
      try {
        ctx.db.exec('ROLLBACK');
      } catch {
        /* sem transação aberta */
      }
      throw error;
    }
    return jsonResponse(ctx, res, 200, {
      answers: Object.fromEntries(answersFor(ctx.db, me.id)),
      progress: answersProgress(ctx.db, me.id),
    });
  }

  // --- descoberta -----------------------------------------------------
  if (method === 'GET' && pathname === '/api/dating/discover') {
    const myProfile = profileRow(ctx.db, me.id);
    const quiz = answersProgress(ctx.db, me.id);
    if (!myProfile) {
      throw new HttpError(409, 'Configure seu perfil de namoro primeiro.', 'profile_required');
    }
    if (!myProfile.active || myProfile.paused) {
      throw new HttpError(409, 'Seu perfil de namoro está pausado.', 'profile_paused');
    }
    if (!quiz.complete) {
      throw new HttpError(409, 'Conclua pelo menos 6 respostas do questionário para ver recomendações.', 'quiz_required', {
        progress: quiz,
      });
    }
    const timestamp = ctx.now();
    const myAge = ctx.publicAge(me.birth_date);
    const rows = ctx.db
      .prepare(
        `SELECT dp.*, u.id AS u_id, u.username, u.name, u.avatar, u.birth_date, u.bio AS social_bio
         FROM dating_profiles dp JOIN users u ON u.id = dp.user_id
         WHERE dp.user_id != ? AND dp.active = 1 AND dp.paused = 0`
      )
      .all(me.id);
    const verified = verifiedUserIds(ctx.db);
    const acted = new Set(
      ctx.db.prepare('SELECT to_user_id FROM dating_likes WHERE from_user_id = ?').all(me.id).map((row) => row.to_user_id)
    );
    const activeMatches = new Set(
      ctx.db
        .prepare(
          `SELECT CASE WHEN user_a = ? THEN user_b ELSE user_a END AS other_id
           FROM matches WHERE ended_at IS NULL AND (user_a = ? OR user_b = ?)`
        )
        .all(me.id, me.id, me.id)
        .map((row) => row.other_id)
    );
    const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit')) || 12));
    const profiles = [];
    for (const row of rows) {
      if (acted.has(row.user_id) || activeMatches.has(row.user_id)) continue;
      if (!verified.has(row.user_id)) continue;
      if (!ctx.isAdult(row.birth_date)) continue;
      const targetUser = {
        id: row.user_id,
        username: row.username,
        name: row.name,
        avatar: row.avatar,
        birth_date: row.birth_date,
        interests: row.interests,
      };
      if (!eligiblePair(ctx, me, myProfile, targetUser, row)) continue;
      const result = compatibility(ctx, me, myProfile, targetUser, row);
      profiles.push({
        user: ctx.userDTO(targetUser),
        age: ctx.publicAge(row.birth_date),
        bio: row.bio,
        photos: jsonArray(row.photos),
        interests: ctx.interestLabels(interestsFor(row)),
        goals: goalsFor(row)
          .map((id) => GOALS.find((goal) => goal.id === id)?.label)
          .filter(Boolean),
        sharedInterests: ctx.interestLabels(result.sharedInterests),
        sharedGoals: result.sharedGoals
          .map((id) => GOALS.find((goal) => goal.id === id)?.label)
          .filter(Boolean),
        distanceLabel: result.distanceLabel,
        distanceKnown: result.distanceMeters !== null,
        score: result.score,
        reasons: result.reasons,
      });
    }
    profiles.sort((a, b) => b.score - a.score || a.user.username.localeCompare(b.user.username));
    return jsonResponse(ctx, res, 200, {
      profiles: profiles.slice(0, limit),
      total: profiles.length,
      filters: {
        ageMin: myProfile.age_min,
        ageMax: myProfile.age_max,
        distanceKm: myProfile.distance_km,
      },
      myAge,
      scoring: {
        note: 'A porcentagem é uma estimativa de afinidade baseada nos dados declarados, não um diagnóstico ou previsão.',
      },
    });
  }

  // --- curtidas / matches --------------------------------------------
  const datingLikeMatch = ctx.matchRoute(pathname, '/api/dating/likes/:username');
  if (method === 'POST' && datingLikeMatch) {
    ctx.rateLimit(req, 'dating-likes', 120, 10 * 60 * 1000);
    const body = await ctx.readBody(req);
    const action = body.action === 'pass' ? 'pass' : body.action === 'like' ? 'like' : null;
    if (!action) throw new HttpError(400, 'Ação inválida.');
    const targetUser = ctx.db.prepare('SELECT * FROM users WHERE username = ?').get(datingLikeMatch.username);
    if (!targetUser) throw new HttpError(404, 'Perfil não encontrado.');
    const myProfile = profileRow(ctx.db, me.id);
    const targetProfile = profileRow(ctx.db, targetUser.id);
    if (!myProfile) throw new HttpError(409, 'Configure seu perfil de namoro primeiro.', 'profile_required');
    if (!eligiblePair(ctx, me, myProfile, targetUser, targetProfile)) {
      throw new HttpError(403, 'Este perfil não está dentro das preferências de vocês.', 'not_eligible');
    }
    const existingMatch = currentMatch(ctx.db, me.id, targetUser.id);
    if (existingMatch) {
      const conversation = ctx.conversationForMatch(existingMatch.id);
      return jsonResponse(ctx, res, 200, {
        liked: true,
        matched: true,
        match: { id: existingMatch.id, conversationId: conversation.id },
      });
    }
    const timestamp = ctx.now();
    const [userA, userB] = me.id < targetUser.id ? [me.id, targetUser.id] : [targetUser.id, me.id];
    let match = null;
    try {
      ctx.db.exec('BEGIN IMMEDIATE');
      ctx.db
        .prepare(
          `INSERT INTO dating_likes (from_user_id, to_user_id, action, created_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(from_user_id, to_user_id)
           DO UPDATE SET action = excluded.action, created_at = excluded.created_at`
        )
        .run(me.id, targetUser.id, action, timestamp);
      if (action === 'like') {
        const reciprocal = ctx.db
          .prepare("SELECT 1 AS ok FROM dating_likes WHERE from_user_id = ? AND to_user_id = ? AND action = 'like'")
          .get(targetUser.id, me.id);
        if (reciprocal) {
          const result = ctx.db
            .prepare('INSERT INTO matches (user_a, user_b, created_at) VALUES (?, ?, ?)')
            .run(userA, userB, timestamp);
          match = ctx.db.prepare('SELECT * FROM matches WHERE id = ?').get(Number(result.lastInsertRowid));
          const conversation = ctx.conversationForMatch(match.id);
          ctx.addConversationMember(conversation.id, me.id);
          ctx.addConversationMember(conversation.id, targetUser.id);
          ctx.notify(
            targetUser.id,
            'match',
            `Você e ${me.name} deram match. A conversa está aberta.`,
            `/mensagens?conversa=${conversation.id}`
          );
          ctx.notify(me.id, 'match', `Você e ${targetUser.name} deram match.`, `/mensagens?conversa=${conversation.id}`);
        }
      }
      ctx.db.exec('COMMIT');
    } catch (error) {
      try {
        ctx.db.exec('ROLLBACK');
      } catch {
        /* sem transação aberta */
      }
      if (String(error.message).includes('UNIQUE')) {
        match = currentMatch(ctx.db, me.id, targetUser.id);
      } else {
        throw error;
      }
    }
    if (match) {
      const conversation = ctx.conversationForMatch(match.id);
      ctx.addConversationMember(conversation.id, me.id);
      ctx.addConversationMember(conversation.id, targetUser.id);
      return jsonResponse(ctx, res, 200, {
        liked: true,
        matched: true,
        match: { id: match.id, conversationId: conversation.id },
      });
    }
    return jsonResponse(ctx, res, 200, { liked: action === 'like', matched: false });
  }

  if (method === 'GET' && pathname === '/api/dating/matches') {
    const rows = ctx.db
      .prepare(
        `SELECT * FROM matches
         WHERE ended_at IS NULL AND (user_a = ? OR user_b = ?)
         ORDER BY created_at DESC LIMIT 100`
      )
      .all(me.id, me.id);
    const matches = [];
    for (const match of rows) {
      const other = otherUser(ctx.db, match, me.id);
      if (!other || ctx.isBlocked(me.id, other.id)) continue;
      const myProfile = profileRow(ctx.db, me.id);
      matches.push(matchDTO(ctx, match, me, other, myProfile));
    }
    return jsonResponse(ctx, res, 200, { matches });
  }

  const datingMatchRoute = ctx.matchRoute(pathname, '/api/dating/matches/:id');
  if (method === 'DELETE' && datingMatchRoute) {
    const match = matchForUser(ctx.db, Number(datingMatchRoute.id), me.id);
    if (!match) throw new HttpError(404, 'Match não encontrado.');
    const other = otherUser(ctx.db, match, me.id);
    ctx.db.prepare('UPDATE matches SET ended_at = ?, ended_by = ? WHERE id = ?').run(ctx.now(), me.id, match.id);
    ctx.db.prepare('DELETE FROM location_consents WHERE match_id = ?').run(match.id);
    if (other) ctx.notify(other.id, 'match', `O match com ${me.name} foi encerrado.`, null);
    return jsonResponse(ctx, res, 200, { ok: true });
  }

  // --- radar ----------------------------------------------------------
  if (method === 'GET' && pathname === '/api/dating/radar') {
    const profile = profileRow(ctx.db, me.id);
    const prefs = ctx.db.prepare('SELECT * FROM radar_prefs WHERE user_id = ?').get(me.id);
    const location = locationFor(ctx.db, me.id);
    const rows = ctx.db
      .prepare(
        `SELECT * FROM matches WHERE ended_at IS NULL AND (user_a = ? OR user_b = ?)
         ORDER BY created_at DESC LIMIT 100`
      )
      .all(me.id, me.id);
    const matches = [];
    for (const match of rows) {
      const other = otherUser(ctx.db, match, me.id);
      if (!other || ctx.isBlocked(me.id, other.id)) continue;
      matches.push(matchDTO(ctx, match, me, other, profile));
    }
    return jsonResponse(ctx, res, 200, {
      enabled: !!profile?.radar_enabled,
      hasLocation: !!location,
      locationUpdatedAt: location ? location.updated_at : null,
      locationStale: location ? ctx.now() - location.updated_at > FRESH_LOCATION_MS : null,
      alerts: { enabled: !!prefs?.alerts_enabled, thresholdM: prefs?.threshold_m || 1000 },
      thresholds: ALERT_THRESHOLDS,
      matches,
    });
  }

  if (method === 'PUT' && pathname === '/api/dating/radar/prefs') {
    const body = await ctx.readBody(req);
    const timestamp = ctx.now();
    const profile = ensureProfile(ctx.db, me.id, timestamp);
    const enabled = body.enabled === undefined ? !!profile.radar_enabled : body.enabled === true;
    let alertsEnabled = false;
    let thresholdM = 1000;
    const prefs = ctx.db.prepare('SELECT * FROM radar_prefs WHERE user_id = ?').get(me.id);
    if (prefs) {
      alertsEnabled = !!prefs.alerts_enabled;
      thresholdM = prefs.threshold_m;
    }
    if (body.alertsEnabled !== undefined) alertsEnabled = body.alertsEnabled === true;
    if (body.thresholdM !== undefined) {
      thresholdM = Number(body.thresholdM);
      if (!ALERT_THRESHOLDS.includes(thresholdM)) {
        throw new HttpError(400, 'Limite de alerta inválido.');
      }
    }
    ctx.db.prepare('UPDATE dating_profiles SET radar_enabled = ?, updated_at = ? WHERE user_id = ?').run(
      enabled ? 1 : 0,
      timestamp,
      me.id
    );
    ctx.db
      .prepare(
        `INSERT INTO radar_prefs (user_id, alerts_enabled, threshold_m, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET alerts_enabled = excluded.alerts_enabled,
           threshold_m = excluded.threshold_m, updated_at = excluded.updated_at`
      )
      .run(me.id, alertsEnabled ? 1 : 0, thresholdM, timestamp);
    if (!enabled) {
      ctx.db.prepare('DELETE FROM location_snapshots WHERE user_id = ?').run(me.id);
      ctx.db.prepare('DELETE FROM location_consents WHERE user_id = ?').run(me.id);
    }
    return jsonResponse(ctx, res, 200, {
      enabled,
      alerts: { enabled: alertsEnabled, thresholdM },
    });
  }

  if (method === 'PUT' && pathname === '/api/dating/location') {
    ctx.rateLimit(req, 'location', 60, 10 * 60 * 1000);
    const body = await ctx.readBody(req);
    const profile = profileRow(ctx.db, me.id);
    if (!profile || !profile.radar_enabled) {
      throw new HttpError(409, 'Ative o Radar antes de compartilhar sua localização.', 'radar_off');
    }
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const accuracy = Number(body.accuracy);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new HttpError(400, 'Coordenadas inválidas.');
    }
    if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 5000) {
      throw new HttpError(400, 'Precisão de localização inválida.');
    }
    const timestamp = ctx.now();
    ctx.db
      .prepare(
        `INSERT INTO location_snapshots (user_id, lat, lng, accuracy, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET lat = excluded.lat, lng = excluded.lng,
           accuracy = excluded.accuracy, updated_at = excluded.updated_at`
      )
      .run(me.id, lat, lng, accuracy, timestamp);
    return jsonResponse(ctx, res, 200, {
      shared: true,
      updatedAt: timestamp,
      accuracy,
    });
  }

  if (method === 'DELETE' && pathname === '/api/dating/location') {
    ctx.db.prepare('DELETE FROM location_snapshots WHERE user_id = ?').run(me.id);
    /* Apagar a localização também revoga o consentimento de Radar de cada
       match: se a pessoa voltar a compartilhar, precisará autorizar de novo. */
    ctx.db.prepare('UPDATE location_consents SET enabled = 0, updated_at = ? WHERE user_id = ?').run(ctx.now(), me.id);
    return jsonResponse(ctx, res, 200, { shared: false });
  }

  const radarConsentMatch = ctx.matchRoute(pathname, '/api/dating/matches/:id/radar');
  if (radarConsentMatch && (method === 'POST' || method === 'GET')) {
    const match = matchForUser(ctx.db, Number(radarConsentMatch.id), me.id);
    if (!match) throw new HttpError(404, 'Match não encontrado.');
    const other = otherUser(ctx.db, match, me.id);
    if (!other || ctx.isBlocked(me.id, other.id)) throw new HttpError(404, 'Match não encontrado.');
    if (method === 'GET') {
      return jsonResponse(ctx, res, 200, { radar: radarState(ctx, match, me, other) });
    }
    const body = await ctx.readBody(req);
    if (typeof body.enabled !== 'boolean') throw new HttpError(400, 'Informe enabled como booleano.');
    const profile = profileRow(ctx.db, me.id);
    if (body.enabled && (!profile || !profile.radar_enabled)) {
      throw new HttpError(409, 'Ative o Radar no seu perfil antes de compartilhar com este match.', 'radar_off');
    }
    ctx.db
      .prepare(
        `INSERT INTO location_consents (match_id, user_id, enabled, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(match_id, user_id) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at`
      )
      .run(match.id, me.id, body.enabled ? 1 : 0, ctx.now());
    return jsonResponse(ctx, res, 200, { radar: radarState(ctx, match, me, other) });
  }

  if (method === 'POST' && pathname === '/api/dating/radar/check') {
    ctx.rateLimit(req, 'radar-check', 12, 60 * 1000);
    const prefs = ctx.db.prepare('SELECT * FROM radar_prefs WHERE user_id = ?').get(me.id);
    if (!prefs?.alerts_enabled) {
      return jsonResponse(ctx, res, 200, { enabled: false, triggered: 0 });
    }
    const profile = profileRow(ctx.db, me.id);
    if (!profile?.radar_enabled) {
      return jsonResponse(ctx, res, 200, { enabled: false, triggered: 0 });
    }
    const timestamp = ctx.now();
    const rows = ctx.db
      .prepare('SELECT * FROM matches WHERE ended_at IS NULL AND (user_a = ? OR user_b = ?)')
      .all(me.id, me.id);
    let triggered = 0;
    const results = [];
    for (const match of rows) {
      const other = otherUser(ctx.db, match, me.id);
      if (!other || ctx.isBlocked(me.id, other.id)) continue;
      const state = radarState(ctx, match, me, other);
      if (!state.available) continue;
      const myLocation = locationFor(ctx.db, me.id);
      const theirLocation = locationFor(ctx.db, other.id);
      const meters = haversineMeters(myLocation.lat, myLocation.lng, theirLocation.lat, theirLocation.lng);
      if (meters > prefs.threshold_m) continue;
      const previous = ctx.db
        .prepare('SELECT last_notified_at FROM radar_alerts WHERE match_id = ? AND user_id = ?')
        .get(match.id, me.id);
      if (previous && timestamp - previous.last_notified_at < 6 * 60 * 60 * 1000) continue;
      ctx.db
        .prepare(
          `INSERT INTO radar_alerts (match_id, user_id, last_notified_at, distance_m)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(match_id, user_id) DO UPDATE SET last_notified_at = excluded.last_notified_at,
             distance_m = excluded.distance_m`
        )
        .run(match.id, me.id, timestamp, meters);
      ctx.notify(
        me.id,
        'radar',
        `${other.name} está ${formatDistance(meters)} de você.`,
        `/mensagens?conversa=${ctx.conversationForMatch(match.id).id}`
      );
      triggered += 1;
      results.push({ matchId: match.id, distanceLabel: formatDistance(meters) });
    }
    return jsonResponse(ctx, res, 200, { enabled: true, triggered, results });
  }

  return false;
}

function jsonResponse(ctx, res, status, body) {
  return ctx.json(res, status, body);
}

module.exports = {
  handle,
  QUESTIONS,
  GOALS,
  REQUIRED_QUESTIONS,
  MIN_ANSWERS,
};
