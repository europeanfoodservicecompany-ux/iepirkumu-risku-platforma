import { Component, type ReactNode } from 'react';

// Kļūdu robeža: viens render-izņēmums (piem., negaidīta datu forma no jaunas IUB versijas)
// citādi nogāztu visu SPA baltā lapā. Šeit to noķeram un parādām draudzīgu ziņu latviski.
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Redzams kļūdu žurnālā (ne kluss), lai problēmu var atkļūdot.
    console.error('Neapstrādāta kļūda saskarnē:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ maxWidth: 620, margin: '80px auto', padding: '0 20px', textAlign: 'center', fontFamily: 'inherit' }}>
          <h1 style={{ fontSize: 22, marginBottom: 10 }}>Radās kļūda</h1>
          <p style={{ color: '#3c4a43', lineHeight: 1.55 }}>
            Saskarnē radās negaidīta kļūda. Dati ir droši — visbiežāk palīdz lapas pārlāde.
            Ja tā atkārtojas, lūdzu, ziņo mums.
          </p>
          <button onClick={() => window.location.reload()}
            style={{ marginTop: 16, padding: '10px 18px', borderRadius: 10, border: '1px solid #0e3b31', background: '#0e3b31', color: '#fff', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>
            Pārlādēt lapu
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
