// "Iespējamie nevainīgie skaidrojumi" — obligāts pretsvars katram karogam.
// Ētika "karogs nav pierādījums" kā produkta īpašība: platforma pati rāda, kāpēc pazīme
// var būt pilnīgi likumīga. Tas ir gan godīgums, gan juridiska aizsardzība.
const NOTES: Record<string, string[]> = {
  b1: [
    'Šaurs vai augsti specializēts tirgus, kur objektīvi ir maz spējīgu piegādātāju',
    'Stingras (bet pamatotas) kvalifikācijas vai tehniskās prasības',
    'Nišas produkts ar vienu izplatītāju Latvijā',
    'Steidzams vai neizdevīgs izpildes termiņš, kas attur pretendentus',
  ],
  b2: [
    'Mazs specializēts tirgus ar dabiski nedaudziem spējīgiem uzvarētājiem',
    'Liels ietvara līgums, kas koncentrē vērtību pie viena izpildītāja',
    'Ģeogrāfiski ierobežots tirgus (reģionā maz piegādātāju)',
  ],
  a: [
    'Objektīvi atsevišķi projekti, objekti vai budžeta gadi',
    'Atšķirīgas tehniskās vajadzības, ko dabiski iepērk atsevišķi',
    'Likumīga iepirkuma dalīšana daļās (PIL to pieļauj, ja pamatoti)',
  ],
  c: [
    'Patiešām lielāks, sarežģītāks vai ilgāks iepirkums nekā vidējais',
    'Ietvara vai daudzgadu līgums (kopvērtība sedz vairākus gadus)',
    'Specializēti materiāli vai reģionālās cenu atšķirības',
    'Rādītājs mēra vērtību, ne vienības cenu — augsta vērtība ≠ pārmaksa',
  ],
  e: [
    'Likumīgi pamatoti izņēmumi (ekskluzīvas tiesības, tehnisku iemeslu dēļ viens piegādātājs)',
    'Ārkārtas situācija vai neparedzama steidzamība',
    'Iepriekšēja atklāta konkursa neizdošanās (nav derīgu piedāvājumu)',
  ],
  d: [
    'Jauns, pilnīgi leģitīms uzņēmums vai nozares jaunpienācējs',
    'Grupas reorganizācija vai jaunas juridiskās personas izveide likumīgu iemeslu dēļ',
    'Pieredzējusi komanda, kas nodibina jaunu firmu',
  ],
  g: [
    'Objektīvi neparedzēti apstākļi (īpaši būvniecībā)',
    'Likumīgi papildu darbi PIL 61. panta ietvaros',
    'Cenu indeksācija vai termiņa pagarinājums bez apjoma pieauguma',
  ],
  homeadv: [
    'Piegādātājs objektīvi ir tuvākais vai vienīgais reģionā',
    'Ilgstoša leģitīma sadarbība ar pierādītu kvalitāti',
    'Specializācija tieši šī pasūtītāja vajadzībās',
  ],
  capgap: [
    'Finanšu pārskati novēloti (jaunām firmām UR datu var nebūt ~1,5 gadu)',
    'Uzņēmums strauji audzis pēc pēdējā pārskata gada',
    'Darbs galvenokārt ar apakšuzņēmējiem vai nomātiem resursiem',
  ],
  phoenix: [
    'Likumīga pārņemšana vai reorganizācija ar to pašu komandu',
    'Vecais uzņēmums beidza darbību neatkarīgu iemeslu dēļ',
  ],
};

export function InnocentNote({ k }: { k: string }) {
  const items = NOTES[k];
  if (!items || !items.length) return null;
  return (
    <details className="innocent">
      <summary>Iespējamie nevainīgie skaidrojumi</summary>
      <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
        {items.map((t, i) => <li key={i} className="small" style={{ marginBottom: 2 }}>{t}</li>)}
      </ul>
      <p className="muted small" style={{ margin: '6px 0 0' }}>
        Šī pazīme ir norāde izpētei, ne pārkāpuma pierādījums. Pirms secinājumiem pārbaudi konkrētos paziņojumus.
      </p>
    </details>
  );
}
