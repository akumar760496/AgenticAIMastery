/** EU AI Act classification (dates per the Digital Omnibus, in force since 27 July 2026). Simplified for learning. */
export type EuUse = 'chatbot' | 'credit' | 'insurance' | 'fraud' | 'code' | 'emotion' | 'manip';
export type EuRole = 'provider' | 'deployer';
export type EuTier = 'out' | 'prohibited' | 'high' | 'transparency' | 'minimal';
export const EU_USES: Readonly<Record<EuUse, readonly [string, Exclude<EuTier, 'out'>]>> = {
  chatbot: ['Customer-support chatbot', 'transparency'], credit: ['Creditworthiness scoring of individuals', 'high'],
  insurance: ['Life or health insurance pricing', 'high'], fraud: ['Fraud detection on payments', 'minimal'],
  code: ['Internal coding assistant', 'minimal'], emotion: ['Emotion recognition of call-centre staff', 'prohibited'],
  manip: ['Nudging vulnerable users into high-risk products', 'prohibited'],
};
export interface EuAiActState { readonly use: EuUse; readonly inEu: boolean; readonly role: EuRole }
export interface EuAiActResult { readonly tier: EuTier; readonly label: string; readonly appliesFrom: string; readonly maxFine: string; readonly duties: readonly string[] }

export function simulateEuAiAct(s: EuAiActState): EuAiActResult {
  if (!s.inEu) return { tier: 'out', label: 'Out of scope', appliesFrom: '—', maxFine: '—', duties: ['None under the Act for this system; check again if EU users are added'] };
  const tier = EU_USES[s.use][1];
  const provider = s.role === 'provider';
  if (tier === 'prohibited') return { tier, label: 'Prohibited', appliesFrom: '2 Feb 2025', maxFine: '€35m or 7% of turnover', duties: ['Do not deploy it in the EU'] };
  if (tier === 'high') {
    return {
      tier, label: 'High-risk (Annex III)', appliesFrom: '2 Dec 2027', maxFine: '€15m or 3% of turnover',
      duties: provider ? ['Risk management system', 'Data governance', 'Technical documentation', 'Automatic logging', 'Accuracy and robustness', 'Conformity assessment and registration']
        : ['Use as instructed; assign human oversight', 'Keep automatically generated logs', 'Inform affected people', 'Fundamental-rights impact assessment (banks and insurers)'],
    };
  }
  if (tier === 'transparency') {
    return {
      tier, label: 'Transparency duties', appliesFrom: '2 Aug 2026', maxFine: '€15m or 3% of turnover',
      duties: provider ? ['Design it so people know they are talking to AI', 'Mark generated content as AI-generated'] : ['Keep the AI disclosure switched on', 'Disclose AI-generated text published on public-interest matters'],
    };
  }
  return { tier: 'minimal', label: 'Minimal risk', appliesFrom: '2 Feb 2025', maxFine: '—', duties: ['AI literacy for staff who use it (Article 4)'] };
}
