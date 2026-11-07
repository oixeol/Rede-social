export type FeatureName =
  | 'premium'
  | 'communities'
  | 'reels'
  | 'highlights'
  | 'suggestions'
  | 'notifications';

/**
 * Flags somente de interface. Variáveis NEXT_PUBLIC são compiladas para o
 * bundle e não contêm segredos. Ausência da variável mantém recurso ativo;
 * valor "0" desliga recurso.
 */
export const featureFlags: Record<FeatureName, boolean> = {
  premium: process.env.NEXT_PUBLIC_VIBRA_FEATURE_PREMIUM !== '0',
  communities: process.env.NEXT_PUBLIC_VIBRA_FEATURE_COMMUNITIES !== '0',
  reels: process.env.NEXT_PUBLIC_VIBRA_FEATURE_REELS !== '0',
  highlights: process.env.NEXT_PUBLIC_VIBRA_FEATURE_HIGHLIGHTS !== '0',
  suggestions: process.env.NEXT_PUBLIC_VIBRA_FEATURE_SUGGESTIONS !== '0',
  notifications: process.env.NEXT_PUBLIC_VIBRA_FEATURE_NOTIFICATIONS !== '0',
};

export function isFeatureEnabled(feature: FeatureName): boolean {
  return featureFlags[feature];
}
