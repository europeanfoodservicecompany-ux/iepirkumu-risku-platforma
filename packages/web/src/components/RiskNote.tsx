// Vienota, vienmēr redzama atruna virs riska sarakstiem/tabulām — pamatprincips "karogs nav pierādījums".
// Liek tieši tur, kur lietotājs pirmoreiz redz sarkanos riskus (saraksti), pirms profila ar pilno atrunu.
export function RiskNote({ children }: { children?: React.ReactNode }) {
  return (
    <div className="risk-note" role="note">
      <strong>Karogs nav pierādījums.</strong> {children ?? 'Riska rādītāji ir signāli izpētei, nevis pierādījumi pārkāpumam. Katram ir saite uz oriģinālu pārbaudei.'}
    </div>
  );
}
