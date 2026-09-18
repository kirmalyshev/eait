// The thread's WORDS that are not the model's, in every language the product speaks.
//
// `chat.ts` keeps the RULES — which line a first verdict takes, when the arithmetic is spoken as
// its own sentence rather than after a dash, what a client may put in Spud's mouth — and the
// wording of each of them is here. Same split as `onboarding-chat-copy.ts`, same reason.
//
// ONE TABLE THAT IS NOT `Localized` AND MUST NOT BECOME ONE: `SCRIPTED_LINES`'s KEYS. A client names
// a line by id and the server owns the words, so the id set is a contract between two binaries and
// is the same in every language. What varies is what each id says.
//
// THE ARITHMETIC HAS TWO FORMS PER BRANCH, and that is not redundancy. English says "First one in.
// 520 kcal — that leaves 930 of your 1,450" after a dash and "That leaves…" as its own sentence,
// and the old code got the second by running a regex over the first. A regex over prose is a rule
// about English grammar hiding in a string operation; four more strings are cheaper than eight
// languages' worth of capitalisation quirks, and the seven translations are free to make the pair
// identical where their language lets them.

import { t, type Localized } from "./lang.ts";
import type { Lang } from "./types.ts";

/** The four branches of the running arithmetic: the goal, crossed with whether the day is spent. */
export interface ArithmeticCopy {
  gainLeft: string;
  gainOver: string;
  otherLeft: string;
  otherOver: string;
}

export interface ThreadCopy {
  /** Keyed by `ScriptedLineId`. `{price}` on `trial-started` is the one parameter any of them takes. */
  scripted: Record<string, string>;
  meetGabie: string;
  coachStarters: string[];
  /**
   * WHOLE SENTENCES, never fragments joined by code.
   *
   * `{left}`, `{over}`, `{plan}`, `{protein}` and `{proteinTarget}` are bare figures; everything
   * around them — "of your", "g protein", the word order — is in the template. The earlier shape
   * built "930 of your 1,450" in TypeScript and handed it over as one parameter, which is an
   * English genitive compiled into the code and unreachable by any translation.
   */
  running: { left: string; over: string };
  /** `{kcal}` is the meal's own, `{day}` the sentence above. */
  correction: string;
  firstVerdict: {
    /** After a dash, so English leads lowercase. */
    arithmetic: ArithmeticCopy;
    /** The same four as a sentence of their own. */
    arithmeticAlone: ArithmeticCopy;
    /** `{kcal}` — a typed meal, where the portions are a guess. */
    typed: string;
    /** `{kcal}` — the analyzer could not read the plate. */
    lowConfidence: string;
    /** The rough-but-it-counts follow-up, per goal and per side of the plan. */
    lowOverGain: string;
    lowOverOther: string;
    lowLeftGain: string;
    lowLeftOther: string;
    /** `{kcal}` and `{arithmetic}`. */
    firstIn: string;
    fixHint: string;
    sodium: string;
    satfat: string;
    /** `{note}` — the camera caption, quoted back. */
    noted: string;
  };
}

const EN: ThreadCopy = {
  scripted: {
    "camera-closed": "No rush. The plan is on your diary — photograph the next meal when it happens. That's the whole habit, and I'll say so once tomorrow if it hasn't.",
    "trial-started": "Trial's on. Seven days, then {price} unless you stop it — I'll remind you on day five and the day before it ends, never the day after.",
    "trial-day-one": "Your first day is started. At 20:30 you get one line — today against the plan, and one concrete thing for tomorrow. Nothing before that.",
    "notify-primer": "One more thing iOS is about to ask about: notifications. One a day and never more — the 20:30 line, plus two reminders before the free week ends if you're on it. Nothing else, ever.",
    "restored": "Restored — you're in. A photo or a sentence both log a meal.",
    "camera-primer": "One thing first: iOS will ask for the camera. I use it for the plate and nothing else — the photo is kept with the meal so you can see it in your diary, and erased with your account.",
    "fix-prompt": "Tell me what's off — \"half the rice\", \"no avocado\", \"it was 500\" all work. Or open the card and edit the grams yourself.",
    "already-in": "Good. I'm here in Chat whenever — a photo or a sentence both log a meal.",
    "camera-denied": "No camera, no problem. Pick a photo from your library, or just tell me what you ate — both get a verdict.",
    "onboarding-done": "Good — that's onboarding done, and the first day started. One more thing before you go, and it's the only time I'll ask.",
    "dropped": "Dropped it.",
  },
  meetGabie: "Questions go to Gabie, the nutritionist here — what to eat tonight, how the week's going. Same chat; she reads your diary before she answers. I log, she advises.",
  coachStarters: [
    "How's my week going?",
    "What should I eat tonight?",
    "Am I getting enough protein?",
  ],
  running: {
    left: "{left} of your {plan} left today, {protein} of the {proteinTarget} g protein.",
    over: "{over} over your {plan} today, {protein} of the {proteinTarget} g protein.",
  },
  correction: "Updated — {kcal} kcal. {day}",
  firstVerdict: {
    arithmetic: {
      gainLeft: "{left} of your {plan} still to fill today, and {protein} of the {proteinTarget} g protein. Keep going.",
      gainOver: "{over} over your {plan} today, and {protein} of the {proteinTarget} g protein. Past it is the point on a gain plan; tomorrow is a fresh number.",
      otherLeft: "that leaves {left} of your {plan} for the rest of today, and {protein} of the {proteinTarget} g protein. On plan.",
      otherOver: "that puts you {over} over your {plan} for today, and {protein} of the {proteinTarget} g protein. Tomorrow is a fresh number.",
    },
    arithmeticAlone: {
      gainLeft: "{left} of your {plan} still to fill today, and {protein} of the {proteinTarget} g protein. Keep going.",
      gainOver: "{over} over your {plan} today, and {protein} of the {proteinTarget} g protein. Past it is the point on a gain plan; tomorrow is a fresh number.",
      otherLeft: "That leaves {left} of your {plan} for the rest of today, and {protein} of the {proteinTarget} g protein. On plan.",
      otherOver: "That puts you {over} over your {plan} for today, and {protein} of the {proteinTarget} g protein. Tomorrow is a fresh number.",
    },
    typed: "Typed, not photographed — so the portions are my guess. Take {kcal} as rough; if you know the grams, say so and I'll fix it.",
    lowConfidence: "Honest answer: I couldn't read that plate well. Take {kcal} as a rough guess and check the grams before you trust the total. A second angle next time helps.",
    lowOverGain: "Even rough, it counts: about {over} over your {plan} today.",
    lowOverOther: "Even rough, it counts: about {over} over your {plan} today. Tomorrow is a fresh number.",
    lowLeftGain: "Even rough, it counts: about {left} of your {plan} still to fill today.",
    lowLeftOther: "Even rough, it counts: about {left} of your {plan} left today.",
    firstIn: "First one in. {kcal} kcal — {arithmetic}",
    fixHint: "If anything's off, say so — \"half the rice\", \"no avocado\" — or tap the card and change the grams.",
    sodium: "Sodium runs high on this one. Scored only because you asked me to.",
    satfat: "Saturated fat runs high on this one. Scored only because you asked me to.",
    noted: "“{note}” — noted, it's in the numbers.",
  },
};

const FR: ThreadCopy = {
  scripted: {
    "camera-closed": "Rien ne presse. Le plan est dans ton journal — photographie le prochain repas quand il arrive. C'est toute l'habitude, et je te le rappellerai une fois demain si ce n'est pas fait.",
    "trial-started": "L'essai est lancé. Sept jours, puis {price} sauf si tu l'arrêtes — je te préviendrai au cinquième jour et la veille de la fin, jamais le lendemain.",
    "trial-day-one": "Ton premier jour est lancé. À 20h30 tu reçois une ligne — la journée face au plan, et une chose concrète pour demain. Rien avant ça.",
    "notify-primer": "Encore une chose qu'iOS va demander : les notifications. Une par jour, jamais plus — la ligne de 20h30, plus deux rappels avant la fin de la semaine gratuite si tu y es. Rien d'autre, jamais.",
    "restored": "Restauré — tu es dedans. Une photo ou une phrase, les deux enregistrent un repas.",
    "camera-primer": "Une chose d'abord : iOS va demander l'accès à l'appareil photo. Je m'en sers pour l'assiette et rien d'autre — la photo reste avec le repas pour que tu la revoies dans ton journal, et disparaît avec ton compte.",
    "fix-prompt": "Dis-moi ce qui cloche — \"la moitié du riz\", \"pas d'avocat\", \"c'était 500\" marchent tous. Ou ouvre la fiche et corrige les grammes toi-même.",
    "already-in": "Bien. Je suis dans le chat quand tu veux — une photo ou une phrase, les deux enregistrent un repas.",
    "camera-denied": "Pas d'appareil photo, pas de problème. Choisis une photo dans ta galerie, ou dis-moi simplement ce que tu as mangé — les deux donnent un verdict.",
    "onboarding-done": "Bien — la mise en route est finie, et le premier jour est lancé. Encore une chose avant que tu files, et c'est la seule fois que je demande.",
    "dropped": "Laissé tomber.",
  },
  meetGabie: "Les questions vont à Gabie, la nutritionniste ici — quoi manger ce soir, comment se passe la semaine. Même chat ; elle lit ton journal avant de répondre. Moi j'enregistre, elle conseille.",
  coachStarters: [
    "Ma semaine, elle donne quoi ?",
    "Je mange quoi ce soir ?",
    "J'ai assez de protéines ?",
  ],
  running: {
    left: "Il te reste {left} sur tes {plan} aujourd'hui, {protein} des {proteinTarget} g de protéines.",
    over: "{over} au-dessus de tes {plan} aujourd'hui, {protein} des {proteinTarget} g de protéines.",
  },
  correction: "Corrigé — {kcal} kcal. {day}",
  firstVerdict: {
    arithmetic: {
      gainLeft: "il te reste {left} sur tes {plan} à remplir aujourd'hui, et {protein} des {proteinTarget} g de protéines. Continue.",
      gainOver: "{over} au-dessus de tes {plan} aujourd'hui, et {protein} des {proteinTarget} g de protéines. Dépasser, c'est le but sur un plan de prise ; demain repart à zéro.",
      otherLeft: "il te reste {left} sur tes {plan} pour le reste de la journée, et {protein} des {proteinTarget} g de protéines. Dans le plan.",
      otherOver: "ça te met {over} au-dessus de tes {plan} pour aujourd'hui, et {protein} des {proteinTarget} g de protéines. Demain repart à zéro.",
    },
    arithmeticAlone: {
      gainLeft: "Il te reste {left} sur tes {plan} à remplir aujourd'hui, et {protein} des {proteinTarget} g de protéines. Continue.",
      gainOver: "{over} au-dessus de tes {plan} aujourd'hui, et {protein} des {proteinTarget} g de protéines. Dépasser, c'est le but sur un plan de prise ; demain repart à zéro.",
      otherLeft: "Il te reste {left} sur tes {plan} pour le reste de la journée, et {protein} des {proteinTarget} g de protéines. Dans le plan.",
      otherOver: "Ça te met {over} au-dessus de tes {plan} pour aujourd'hui, et {protein} des {proteinTarget} g de protéines. Demain repart à zéro.",
    },
    typed: "Écrit, pas photographié — les portions sont donc mon estimation. Prends {kcal} pour un ordre de grandeur ; si tu connais les grammes, dis-le et je corrige.",
    lowConfidence: "Réponse honnête : je n'ai pas bien lu cette assiette. Prends {kcal} pour une estimation grossière et vérifie les grammes avant de faire confiance au total. Un deuxième angle aide, la prochaine fois.",
    lowOverGain: "Même approximatif, ça compte : environ {over} au-dessus de tes {plan} aujourd'hui.",
    lowOverOther: "Même approximatif, ça compte : environ {over} au-dessus de tes {plan} aujourd'hui. Demain repart à zéro.",
    lowLeftGain: "Même approximatif, ça compte : il te reste environ {left} sur tes {plan} à remplir aujourd'hui.",
    lowLeftOther: "Même approximatif, ça compte : il te reste environ {left} sur tes {plan} aujourd'hui.",
    firstIn: "Premier repas enregistré. {kcal} kcal — {arithmetic}",
    fixHint: "Si quelque chose cloche, dis-le — \"la moitié du riz\", \"pas d'avocat\" — ou touche la fiche et change les grammes.",
    sodium: "Le sodium est élevé sur celui-ci. Noté uniquement parce que tu me l'as demandé.",
    satfat: "Les graisses saturées sont élevées sur celui-ci. Noté uniquement parce que tu me l'as demandé.",
    noted: "« {note} » — noté, c'est dans les chiffres.",
  },
};

const DE: ThreadCopy = {
  scripted: {
    "camera-closed": "Kein Stress. Der Plan steht in deinem Tagebuch — fotografier die nächste Mahlzeit, wenn sie kommt. Das ist die ganze Gewohnheit, und wenn nichts passiert, sage ich morgen einmal Bescheid.",
    "trial-started": "Test läuft. Sieben Tage, danach {price}, wenn du nicht stoppst — ich erinnere dich am fünften Tag und am Tag davor, nie am Tag danach.",
    "trial-day-one": "Dein erster Tag läuft. Um 20:30 bekommst du eine Zeile — der Tag gegen den Plan, und eine konkrete Sache für morgen. Vorher nichts.",
    "notify-primer": "Noch etwas, wonach iOS gleich fragt: Mitteilungen. Eine am Tag und nie mehr — die 20:30-Zeile, plus zwei Erinnerungen vor Ende der Gratiswoche, wenn du in ihr bist. Sonst nie etwas.",
    "restored": "Wiederhergestellt — du bist drin. Ein Foto oder ein Satz, beides trägt eine Mahlzeit ein.",
    "camera-primer": "Eins vorweg: iOS fragt gleich nach der Kamera. Ich nutze sie für den Teller und für nichts sonst — das Foto bleibt bei der Mahlzeit, damit du es im Tagebuch siehst, und wird mit deinem Konto gelöscht.",
    "fix-prompt": "Sag mir, was nicht stimmt — \"halber Reis\", \"keine Avocado\", \"es waren 500\" geht alles. Oder öffne die Karte und ändere die Gramm selbst.",
    "already-in": "Gut. Ich bin im Chat, wann immer du willst — ein Foto oder ein Satz, beides trägt eine Mahlzeit ein.",
    "camera-denied": "Keine Kamera, kein Problem. Nimm ein Foto aus deiner Mediathek oder sag mir einfach, was du gegessen hast — beides bekommt ein Urteil.",
    "onboarding-done": "Gut — der Einstieg ist geschafft, und der erste Tag läuft. Noch eine Sache, bevor du loslegst, und es ist das einzige Mal, dass ich frage.",
    "dropped": "Verworfen.",
  },
  meetGabie: "Fragen gehen an Gabie, die Ernährungsberaterin hier — was es heute Abend geben soll, wie die Woche läuft. Gleicher Chat; sie liest dein Tagebuch, bevor sie antwortet. Ich trage ein, sie berät.",
  coachStarters: [
    "Wie läuft meine Woche?",
    "Was soll ich heute Abend essen?",
    "Bekomme ich genug Eiweiß?",
  ],
  running: {
    left: "Heute bleiben dir {left} von deinen {plan}, {protein} von {proteinTarget} g Eiweiß.",
    over: "Heute {over} über deinen {plan}, {protein} von {proteinTarget} g Eiweiß.",
  },
  correction: "Aktualisiert — {kcal} kcal. {day}",
  firstVerdict: {
    arithmetic: {
      gainLeft: "heute sind noch {left} von deinen {plan} zu füllen, und {protein} von {proteinTarget} g Eiweiß. Weiter so.",
      gainOver: "heute {over} über deinen {plan}, und {protein} von {proteinTarget} g Eiweiß. Drüber zu sein ist bei einem Aufbauplan der Sinn der Sache; morgen ist eine frische Zahl.",
      otherLeft: "damit bleiben dir {left} von deinen {plan} für den Rest des Tages, und {protein} von {proteinTarget} g Eiweiß. Im Plan.",
      otherOver: "damit bist du heute {over} über deinen {plan}, und {protein} von {proteinTarget} g Eiweiß. Morgen ist eine frische Zahl.",
    },
    arithmeticAlone: {
      gainLeft: "Heute sind noch {left} von deinen {plan} zu füllen, und {protein} von {proteinTarget} g Eiweiß. Weiter so.",
      gainOver: "Heute {over} über deinen {plan}, und {protein} von {proteinTarget} g Eiweiß. Drüber zu sein ist bei einem Aufbauplan der Sinn der Sache; morgen ist eine frische Zahl.",
      otherLeft: "Damit bleiben dir {left} von deinen {plan} für den Rest des Tages, und {protein} von {proteinTarget} g Eiweiß. Im Plan.",
      otherOver: "Damit bist du heute {over} über deinen {plan}, und {protein} von {proteinTarget} g Eiweiß. Morgen ist eine frische Zahl.",
    },
    typed: "Getippt, nicht fotografiert — die Portionen sind also meine Schätzung. Nimm {kcal} als groben Wert; wenn du die Gramm kennst, sag es und ich korrigiere.",
    lowConfidence: "Ehrliche Antwort: den Teller konnte ich nicht gut lesen. Nimm {kcal} als groben Schätzwert und prüf die Gramm, bevor du der Summe traust. Beim nächsten Mal hilft ein zweiter Winkel.",
    lowOverGain: "Auch grob zählt es: heute etwa {over} über deinen {plan}.",
    lowOverOther: "Auch grob zählt es: heute etwa {over} über deinen {plan}. Morgen ist eine frische Zahl.",
    lowLeftGain: "Auch grob zählt es: heute noch etwa {left} von deinen {plan} zu füllen.",
    lowLeftOther: "Auch grob zählt es: heute bleiben dir etwa {left} von deinen {plan}.",
    firstIn: "Die erste ist drin. {kcal} kcal — {arithmetic}",
    fixHint: "Wenn etwas nicht stimmt, sag es — \"halber Reis\", \"keine Avocado\" — oder tipp auf die Karte und ändere die Gramm.",
    sodium: "Das Natrium läuft hier hoch. Bewertet nur, weil du mich darum gebeten hast.",
    satfat: "Die gesättigten Fette laufen hier hoch. Bewertet nur, weil du mich darum gebeten hast.",
    noted: "„{note}“ — notiert, es steckt in den Zahlen.",
  },
};

const IT: ThreadCopy = {
  scripted: {
    "camera-closed": "Nessuna fretta. Il piano è sul tuo diario — fotografa il prossimo pasto quando arriva. L'abitudine è tutta qui, e se non succede te lo ricordo una volta domani.",
    "trial-started": "Prova avviata. Sette giorni, poi {price} se non la fermi — te lo ricordo al quinto giorno e il giorno prima della fine, mai il giorno dopo.",
    "trial-day-one": "Il tuo primo giorno è partito. Alle 20:30 ricevi una riga — la giornata rispetto al piano, e una cosa concreta per domani. Prima di allora, niente.",
    "notify-primer": "Ancora una cosa che iOS sta per chiedere: le notifiche. Una al giorno e mai di più — la riga delle 20:30, più due promemoria prima che finisca la settimana gratis, se ci sei dentro. Nient'altro, mai.",
    "restored": "Ripristinato — ci sei. Una foto o una frase, entrambe registrano un pasto.",
    "camera-primer": "Prima una cosa: iOS chiederà la fotocamera. La uso per il piatto e per nient'altro — la foto resta con il pasto così la rivedi nel diario, e sparisce con il tuo account.",
    "fix-prompt": "Dimmi cosa non torna — \"metà del riso\", \"niente avocado\", \"erano 500\" vanno tutti bene. Oppure apri la scheda e correggi i grammi da te.",
    "already-in": "Bene. Sono in Chat quando vuoi — una foto o una frase, entrambe registrano un pasto.",
    "camera-denied": "Niente fotocamera, nessun problema. Scegli una foto dalla galleria, o dimmi solo cosa hai mangiato — entrambe ricevono un verdetto.",
    "onboarding-done": "Bene — la messa in moto è finita, e il primo giorno è partito. Ancora una cosa prima che tu vada, ed è l'unica volta che te lo chiedo.",
    "dropped": "Lasciato perdere.",
  },
  meetGabie: "Le domande vanno a Gabie, la nutrizionista qui — cosa mangiare stasera, come sta andando la settimana. Stessa chat; legge il tuo diario prima di rispondere. Io registro, lei consiglia.",
  coachStarters: [
    "Come sta andando la settimana?",
    "Cosa mangio stasera?",
    "Sto prendendo abbastanza proteine?",
  ],
  running: {
    left: "Oggi ti restano {left} delle tue {plan}, {protein} dei {proteinTarget} g di proteine.",
    over: "Oggi {over} sopra le tue {plan}, {protein} dei {proteinTarget} g di proteine.",
  },
  correction: "Aggiornato — {kcal} kcal. {day}",
  firstVerdict: {
    arithmetic: {
      gainLeft: "oggi restano {left} delle tue {plan} da riempire, e {protein} dei {proteinTarget} g di proteine. Vai avanti così.",
      gainOver: "oggi {over} sopra le tue {plan}, e {protein} dei {proteinTarget} g di proteine. Andare oltre è il punto di un piano di crescita; domani è un numero nuovo.",
      otherLeft: "così ti restano {left} delle tue {plan} per il resto della giornata, e {protein} dei {proteinTarget} g di proteine. Nel piano.",
      otherOver: "così sei a {over} sopra le tue {plan} per oggi, e {protein} dei {proteinTarget} g di proteine. Domani è un numero nuovo.",
    },
    arithmeticAlone: {
      gainLeft: "Oggi restano {left} delle tue {plan} da riempire, e {protein} dei {proteinTarget} g di proteine. Vai avanti così.",
      gainOver: "Oggi {over} sopra le tue {plan}, e {protein} dei {proteinTarget} g di proteine. Andare oltre è il punto di un piano di crescita; domani è un numero nuovo.",
      otherLeft: "Così ti restano {left} delle tue {plan} per il resto della giornata, e {protein} dei {proteinTarget} g di proteine. Nel piano.",
      otherOver: "Così sei a {over} sopra le tue {plan} per oggi, e {protein} dei {proteinTarget} g di proteine. Domani è un numero nuovo.",
    },
    typed: "Scritto, non fotografato — quindi le porzioni sono una mia stima. Prendi {kcal} come ordine di grandezza; se sai i grammi, dimmelo e correggo.",
    lowConfidence: "Risposta onesta: quel piatto non l'ho letto bene. Prendi {kcal} come stima grezza e controlla i grammi prima di fidarti del totale. La prossima volta una seconda angolazione aiuta.",
    lowOverGain: "Anche grezzo conta: oggi circa {over} sopra le tue {plan}.",
    lowOverOther: "Anche grezzo conta: oggi circa {over} sopra le tue {plan}. Domani è un numero nuovo.",
    lowLeftGain: "Anche grezzo conta: oggi restano circa {left} delle tue {plan} da riempire.",
    lowLeftOther: "Anche grezzo conta: oggi ti restano circa {left} delle tue {plan}.",
    firstIn: "Il primo è dentro. {kcal} kcal — {arithmetic}",
    fixHint: "Se qualcosa non torna, dimmelo — \"metà del riso\", \"niente avocado\" — oppure tocca la scheda e cambia i grammi.",
    sodium: "Su questo il sodio va alto. Valutato solo perché me l'hai chiesto tu.",
    satfat: "Su questo i grassi saturi vanno alti. Valutato solo perché me l'hai chiesto tu.",
    noted: "«{note}» — preso nota, è dentro ai numeri.",
  },
};

const ES: ThreadCopy = {
  scripted: {
    "camera-closed": "Sin prisa. El plan está en tu diario — fotografía la próxima comida cuando llegue. El hábito es eso, y si no pasa te lo recuerdo una vez mañana.",
    "trial-started": "Prueba activada. Siete días, luego {price} salvo que la pares — te aviso el quinto día y el día antes de que acabe, nunca el día después.",
    "trial-day-one": "Tu primer día está en marcha. A las 20:30 recibes una línea — el día frente al plan, y una cosa concreta para mañana. Antes de eso, nada.",
    "notify-primer": "Una cosa más que iOS va a preguntar: las notificaciones. Una al día y nunca más — la línea de las 20:30, más dos recordatorios antes de que acabe la semana gratis, si estás en ella. Nada más, nunca.",
    "restored": "Restaurado — estás dentro. Una foto o una frase, las dos registran una comida.",
    "camera-primer": "Una cosa primero: iOS va a pedir la cámara. La uso para el plato y para nada más — la foto se guarda con la comida para que la veas en tu diario, y se borra con tu cuenta.",
    "fix-prompt": "Dime qué falla — \"la mitad del arroz\", \"sin aguacate\", \"eran 500\" valen todas. O abre la ficha y corrige los gramos tú.",
    "already-in": "Bien. Estoy en el chat cuando quieras — una foto o una frase, las dos registran una comida.",
    "camera-denied": "Sin cámara, sin problema. Elige una foto de tu galería, o dime simplemente qué comiste — las dos reciben un veredicto.",
    "onboarding-done": "Bien — la puesta en marcha está hecha, y el primer día empezado. Una cosa más antes de que te vayas, y es la única vez que la pido.",
    "dropped": "Descartado.",
  },
  meetGabie: "Las preguntas van a Gabie, la nutricionista de aquí — qué cenar hoy, cómo va la semana. El mismo chat; lee tu diario antes de responder. Yo registro, ella aconseja.",
  coachStarters: [
    "¿Cómo va mi semana?",
    "¿Qué ceno hoy?",
    "¿Estoy tomando suficiente proteína?",
  ],
  running: {
    left: "Hoy te quedan {left} de tus {plan}, {protein} de los {proteinTarget} g de proteína.",
    over: "Hoy {over} por encima de tus {plan}, {protein} de los {proteinTarget} g de proteína.",
  },
  correction: "Actualizado — {kcal} kcal. {day}",
  firstVerdict: {
    arithmetic: {
      gainLeft: "hoy quedan {left} de tus {plan} por llenar, y {protein} de los {proteinTarget} g de proteína. Sigue así.",
      gainOver: "hoy {over} por encima de tus {plan}, y {protein} de los {proteinTarget} g de proteína. Pasarse es el objetivo en un plan de ganancia; mañana es un número nuevo.",
      otherLeft: "eso te deja {left} de tus {plan} para el resto del día, y {protein} de los {proteinTarget} g de proteína. En el plan.",
      otherOver: "eso te pone {over} por encima de tus {plan} hoy, y {protein} de los {proteinTarget} g de proteína. Mañana es un número nuevo.",
    },
    arithmeticAlone: {
      gainLeft: "Hoy quedan {left} de tus {plan} por llenar, y {protein} de los {proteinTarget} g de proteína. Sigue así.",
      gainOver: "Hoy {over} por encima de tus {plan}, y {protein} de los {proteinTarget} g de proteína. Pasarse es el objetivo en un plan de ganancia; mañana es un número nuevo.",
      otherLeft: "Eso te deja {left} de tus {plan} para el resto del día, y {protein} de los {proteinTarget} g de proteína. En el plan.",
      otherOver: "Eso te pone {over} por encima de tus {plan} hoy, y {protein} de los {proteinTarget} g de proteína. Mañana es un número nuevo.",
    },
    typed: "Escrito, no fotografiado — así que las porciones son mi estimación. Toma {kcal} como orden de magnitud; si sabes los gramos, dilo y lo corrijo.",
    lowConfidence: "Respuesta honesta: ese plato no lo leí bien. Toma {kcal} como estimación aproximada y comprueba los gramos antes de fiarte del total. Un segundo ángulo ayuda la próxima vez.",
    lowOverGain: "Aun aproximado, cuenta: hoy unas {over} por encima de tus {plan}.",
    lowOverOther: "Aun aproximado, cuenta: hoy unas {over} por encima de tus {plan}. Mañana es un número nuevo.",
    lowLeftGain: "Aun aproximado, cuenta: hoy quedan unas {left} de tus {plan} por llenar.",
    lowLeftOther: "Aun aproximado, cuenta: hoy te quedan unas {left} de tus {plan}.",
    firstIn: "La primera está dentro. {kcal} kcal — {arithmetic}",
    fixHint: "Si algo falla, dilo — \"la mitad del arroz\", \"sin aguacate\" — o toca la ficha y cambia los gramos.",
    sodium: "El sodio sale alto en esta. Puntuado solo porque me lo pediste.",
    satfat: "Las grasas saturadas salen altas en esta. Puntuado solo porque me lo pediste.",
    noted: "«{note}» — anotado, está en los números.",
  },
};

const VI: ThreadCopy = {
  scripted: {
    "camera-closed": "Không vội. Kế hoạch đã nằm trong nhật ký của bạn — bữa sau tới thì chụp. Thói quen chỉ có vậy, và nếu chưa có gì thì mai mình nhắc đúng một lần.",
    "trial-started": "Đã bật bản dùng thử. Bảy ngày, sau đó {price} trừ khi bạn dừng lại — mình sẽ nhắc vào ngày thứ năm và ngày trước khi kết thúc, không bao giờ nhắc sau khi đã hết.",
    "trial-day-one": "Ngày đầu tiên của bạn đã bắt đầu. 20:30 bạn nhận một dòng — hôm nay so với kế hoạch, và một việc cụ thể cho ngày mai. Trước đó thì không gì cả.",
    "notify-primer": "Còn một thứ iOS sắp hỏi: thông báo. Mỗi ngày một cái và không bao giờ nhiều hơn — dòng 20:30, cộng hai lời nhắc trước khi tuần miễn phí kết thúc nếu bạn đang trong tuần đó. Ngoài ra không có gì, không bao giờ.",
    "restored": "Đã khôi phục — bạn vào rồi. Một tấm ảnh hay một câu, cả hai đều ghi được một bữa.",
    "camera-primer": "Một điều trước đã: iOS sẽ hỏi quyền camera. Mình dùng nó cho cái đĩa và không cho gì khác — ảnh được giữ cùng bữa ăn để bạn xem lại trong nhật ký, và xoá cùng tài khoản của bạn.",
    "fix-prompt": "Nói mình biết chỗ nào sai — \"một nửa cơm thôi\", \"không có bơ\", \"hồi nãy là 500\" đều được. Hoặc mở thẻ ra và tự sửa số gam.",
    "already-in": "Tốt. Mình ở trong Chat bất cứ lúc nào — một tấm ảnh hay một câu, cả hai đều ghi được một bữa.",
    "camera-denied": "Không có camera cũng không sao. Chọn ảnh từ thư viện, hoặc cứ kể mình nghe bạn đã ăn gì — cả hai đều có nhận xét.",
    "onboarding-done": "Tốt — phần thiết lập xong rồi, và ngày đầu tiên đã bắt đầu. Còn một chuyện trước khi bạn đi, và đây là lần duy nhất mình hỏi.",
    "dropped": "Bỏ qua rồi.",
  },
  meetGabie: "Câu hỏi thì gửi cho Gabie, chuyên gia dinh dưỡng ở đây — tối nay ăn gì, tuần này ra sao. Vẫn chat này; cô ấy đọc nhật ký của bạn trước khi trả lời. Mình ghi chép, cô ấy tư vấn.",
  coachStarters: [
    "Tuần này của mình thế nào?",
    "Tối nay mình nên ăn gì?",
    "Mình đã đủ đạm chưa?",
  ],
  running: {
    left: "Hôm nay bạn còn {left} trên {plan}, {protein} trên {proteinTarget} g đạm.",
    over: "Hôm nay vượt {over} so với {plan}, {protein} trên {proteinTarget} g đạm.",
  },
  correction: "Đã cập nhật — {kcal} kcal. {day}",
  firstVerdict: {
    arithmetic: {
      gainLeft: "hôm nay còn {left} trên {plan} cần nạp thêm, và {protein} trên {proteinTarget} g đạm. Cứ tiếp tục nhé.",
      gainOver: "hôm nay vượt {over} so với {plan}, và {protein} trên {proteinTarget} g đạm. Với kế hoạch tăng cân thì vượt là đúng ý; mai lại là một con số mới.",
      otherLeft: "vậy là còn {left} trên {plan} cho phần còn lại của hôm nay, và {protein} trên {proteinTarget} g đạm. Đúng kế hoạch.",
      otherOver: "vậy là hôm nay bạn vượt {over} so với {plan}, và {protein} trên {proteinTarget} g đạm. Mai lại là một con số mới.",
    },
    arithmeticAlone: {
      gainLeft: "Hôm nay còn {left} trên {plan} cần nạp thêm, và {protein} trên {proteinTarget} g đạm. Cứ tiếp tục nhé.",
      gainOver: "Hôm nay vượt {over} so với {plan}, và {protein} trên {proteinTarget} g đạm. Với kế hoạch tăng cân thì vượt là đúng ý; mai lại là một con số mới.",
      otherLeft: "Vậy là còn {left} trên {plan} cho phần còn lại của hôm nay, và {protein} trên {proteinTarget} g đạm. Đúng kế hoạch.",
      otherOver: "Vậy là hôm nay bạn vượt {over} so với {plan}, và {protein} trên {proteinTarget} g đạm. Mai lại là một con số mới.",
    },
    typed: "Bạn gõ chứ không chụp — nên phần khẩu phần là mình đoán. Cứ xem {kcal} là con số áng chừng; nếu bạn biết số gam thì nói, mình sửa.",
    lowConfidence: "Nói thật: đĩa đó mình đọc không rõ. Cứ xem {kcal} là ước lượng thô và kiểm lại số gam trước khi tin vào tổng. Lần sau chụp thêm một góc nữa sẽ dễ hơn.",
    lowOverGain: "Dù thô thì vẫn tính: hôm nay vượt khoảng {over} so với {plan}.",
    lowOverOther: "Dù thô thì vẫn tính: hôm nay vượt khoảng {over} so với {plan}. Mai lại là một con số mới.",
    lowLeftGain: "Dù thô thì vẫn tính: hôm nay còn khoảng {left} trên {plan} cần nạp thêm.",
    lowLeftOther: "Dù thô thì vẫn tính: hôm nay bạn còn khoảng {left} trên {plan}.",
    firstIn: "Bữa đầu tiên đã vào. {kcal} kcal — {arithmetic}",
    fixHint: "Có gì sai thì cứ nói — \"một nửa cơm thôi\", \"không có bơ\" — hoặc chạm vào thẻ và đổi số gam.",
    sodium: "Bữa này natri hơi cao. Được chấm chỉ vì bạn yêu cầu.",
    satfat: "Bữa này chất béo bão hoà hơi cao. Được chấm chỉ vì bạn yêu cầu.",
    noted: "“{note}” — đã ghi nhận, nó nằm trong các con số rồi.",
  },
};

const ID: ThreadCopy = {
  scripted: {
    "camera-closed": "Santai saja. Rencananya sudah ada di buku harianmu — foto makanan berikutnya saat waktunya tiba. Kebiasaannya cuma itu, dan kalau belum terjadi aku ingatkan sekali besok.",
    "trial-started": "Masa coba jalan. Tujuh hari, lalu {price} kecuali kamu hentikan — aku ingatkan di hari kelima dan sehari sebelum berakhir, tidak pernah sehari sesudahnya.",
    "trial-day-one": "Hari pertamamu sudah dimulai. Pukul 20:30 kamu dapat satu baris — hari ini dibanding rencana, dan satu hal konkret untuk besok. Sebelum itu tidak ada apa-apa.",
    "notify-primer": "Satu hal lagi yang sebentar lagi ditanyakan iOS: notifikasi. Sehari satu dan tidak pernah lebih — baris pukul 20:30, plus dua pengingat sebelum minggu gratisnya habis kalau kamu sedang menjalaninya. Selain itu tidak pernah ada.",
    "restored": "Dipulihkan — kamu sudah masuk. Satu foto atau satu kalimat, dua-duanya mencatat satu makanan.",
    "camera-primer": "Satu hal dulu: iOS akan minta izin kamera. Aku memakainya untuk piringnya dan tidak untuk apa pun lagi — fotonya disimpan bersama makanannya supaya bisa kamu lihat di buku harian, dan terhapus bersama akunmu.",
    "fix-prompt": "Bilang apa yang meleset — \"nasinya setengah\", \"tanpa alpukat\", \"tadi 500\" semuanya bisa. Atau buka kartunya dan ubah gramnya sendiri.",
    "already-in": "Bagus. Aku ada di Chat kapan saja — satu foto atau satu kalimat, dua-duanya mencatat satu makanan.",
    "camera-denied": "Tidak ada kamera, tidak masalah. Pilih foto dari galerimu, atau cukup ceritakan apa yang kamu makan — dua-duanya dapat penilaian.",
    "onboarding-done": "Bagus — persiapannya selesai, dan hari pertama sudah dimulai. Satu hal lagi sebelum kamu pergi, dan ini satu-satunya kali aku memintanya.",
    "dropped": "Dibatalkan.",
  },
  meetGabie: "Pertanyaan diarahkan ke Gabie, ahli gizi di sini — malam ini makan apa, minggu ini bagaimana. Chat yang sama; dia membaca buku harianmu sebelum menjawab. Aku mencatat, dia memberi saran.",
  coachStarters: [
    "Bagaimana mingguku?",
    "Malam ini sebaiknya makan apa?",
    "Proteinku sudah cukup belum?",
  ],
  running: {
    left: "Hari ini kamu masih punya {left} dari {plan}, {protein} dari {proteinTarget} g protein.",
    over: "Hari ini lebih {over} dari {plan}, {protein} dari {proteinTarget} g protein.",
  },
  correction: "Diperbarui — {kcal} kcal. {day}",
  firstVerdict: {
    arithmetic: {
      gainLeft: "hari ini masih ada {left} dari {plan} yang perlu diisi, dan {protein} dari {proteinTarget} g protein. Lanjutkan.",
      gainOver: "hari ini lebih {over} dari {plan}, dan {protein} dari {proteinTarget} g protein. Melewatinya justru tujuannya di rencana menaikkan berat badan; besok angkanya baru lagi.",
      otherLeft: "jadi tersisa {left} dari {plan} untuk sisa hari ini, dan {protein} dari {proteinTarget} g protein. Sesuai rencana.",
      otherOver: "jadi hari ini kamu lebih {over} dari {plan}, dan {protein} dari {proteinTarget} g protein. Besok angkanya baru lagi.",
    },
    arithmeticAlone: {
      gainLeft: "Hari ini masih ada {left} dari {plan} yang perlu diisi, dan {protein} dari {proteinTarget} g protein. Lanjutkan.",
      gainOver: "Hari ini lebih {over} dari {plan}, dan {protein} dari {proteinTarget} g protein. Melewatinya justru tujuannya di rencana menaikkan berat badan; besok angkanya baru lagi.",
      otherLeft: "Jadi tersisa {left} dari {plan} untuk sisa hari ini, dan {protein} dari {proteinTarget} g protein. Sesuai rencana.",
      otherOver: "Jadi hari ini kamu lebih {over} dari {plan}, dan {protein} dari {proteinTarget} g protein. Besok angkanya baru lagi.",
    },
    typed: "Diketik, bukan difoto — jadi porsinya tebakanku. Anggap {kcal} sebagai angka kasar; kalau kamu tahu gramnya, bilang saja dan aku perbaiki.",
    lowConfidence: "Jawaban jujur: piring itu tidak terbaca dengan baik olehku. Anggap {kcal} sebagai perkiraan kasar dan periksa gramnya sebelum percaya pada totalnya. Lain kali satu sudut tambahan sangat membantu.",
    lowOverGain: "Meski kasar, tetap dihitung: hari ini sekitar {over} di atas {plan}.",
    lowOverOther: "Meski kasar, tetap dihitung: hari ini sekitar {over} di atas {plan}. Besok angkanya baru lagi.",
    lowLeftGain: "Meski kasar, tetap dihitung: hari ini masih sekitar {left} dari {plan} yang perlu diisi.",
    lowLeftOther: "Meski kasar, tetap dihitung: hari ini kamu masih punya sekitar {left} dari {plan}.",
    firstIn: "Yang pertama masuk. {kcal} kcal — {arithmetic}",
    fixHint: "Kalau ada yang meleset, bilang saja — \"nasinya setengah\", \"tanpa alpukat\" — atau ketuk kartunya dan ubah gramnya.",
    sodium: "Natrium di yang ini tinggi. Dinilai hanya karena kamu memintanya.",
    satfat: "Lemak jenuh di yang ini tinggi. Dinilai hanya karena kamu memintanya.",
    noted: "“{note}” — dicatat, sudah masuk ke angkanya.",
  },
};

const RU: ThreadCopy = {
  scripted: {
    "camera-closed": "Не торопись. План уже в дневнике — сфотографируй следующий приём, когда он случится. В этом вся привычка, и если ничего не будет, завтра я напомню один раз.",
    "trial-started": "Пробный период запущен. Семь дней, дальше {price}, если не остановишь, — напомню на пятый день и накануне окончания, и никогда на следующий день после.",
    "trial-day-one": "Первый день пошёл. В 20:30 придёт одна строка — день против плана и одна конкретная вещь на завтра. До этого ничего.",
    "notify-primer": "Ещё одно, о чём сейчас спросит iOS: уведомления. Одно в день и не больше — строка в 20:30 плюс два напоминания перед концом бесплатной недели, если ты в ней. Больше ничего и никогда.",
    "restored": "Восстановлено — ты внутри. Фото или фраза — и то, и другое записывает приём пищи.",
    "camera-primer": "Сначала одно: iOS попросит доступ к камере. Я использую её для тарелки и больше ни для чего — фото хранится вместе с приёмом пищи, чтобы ты видел его в дневнике, и стирается вместе с аккаунтом.",
    "fix-prompt": "Скажи, что не так — «риса половина», «без авокадо», «там было 500» — подойдёт любое. Или открой карточку и поправь граммы сам.",
    "already-in": "Хорошо. Я в чате в любой момент — фото или фраза, и то, и другое записывает приём пищи.",
    "camera-denied": "Нет камеры — не беда. Выбери фото из галереи или просто скажи, что ты ел, — вердикт будет в обоих случаях.",
    "onboarding-done": "Хорошо — знакомство закончено, первый день начался. Ещё одно, прежде чем ты уйдёшь, и это единственный раз, когда я об этом прошу.",
    "dropped": "Убрал.",
  },
  meetGabie: "Вопросы — к Gabie, здешнему нутрициологу: что съесть вечером, как идёт неделя. Тот же чат; перед ответом она читает твой дневник. Я записываю, она советует.",
  coachStarters: [
    "Как у меня идёт неделя?",
    "Что съесть сегодня вечером?",
    "Мне хватает белка?",
  ],
  running: {
    left: "Сегодня осталось {left} из {plan}, белка {protein} из {proteinTarget} г.",
    over: "Сегодня {over} сверх {plan}, белка {protein} из {proteinTarget} г.",
  },
  correction: "Обновил — {kcal} ккал. {day}",
  firstVerdict: {
    arithmetic: {
      gainLeft: "сегодня ещё {left} из {plan} нужно добрать, и белка {protein} из {proteinTarget} г. Продолжай.",
      gainOver: "сегодня {over} сверх {plan}, и белка {protein} из {proteinTarget} г. На наборе перебор — это и есть смысл; завтра цифра свежая.",
      otherLeft: "остаётся {left} из {plan} на остаток дня, и белка {protein} из {proteinTarget} г. В плане.",
      otherOver: "получается {over} сверх {plan} за сегодня, и белка {protein} из {proteinTarget} г. Завтра цифра свежая.",
    },
    arithmeticAlone: {
      gainLeft: "Сегодня ещё {left} из {plan} нужно добрать, и белка {protein} из {proteinTarget} г. Продолжай.",
      gainOver: "Сегодня {over} сверх {plan}, и белка {protein} из {proteinTarget} г. На наборе перебор — это и есть смысл; завтра цифра свежая.",
      otherLeft: "Остаётся {left} из {plan} на остаток дня, и белка {protein} из {proteinTarget} г. В плане.",
      otherOver: "Получается {over} сверх {plan} за сегодня, и белка {protein} из {proteinTarget} г. Завтра цифра свежая.",
    },
    typed: "Это текст, а не фото — значит, порции я прикинул. Считай {kcal} грубой оценкой; знаешь граммы — скажи, и я поправлю.",
    lowConfidence: "Честно: тарелку я прочитал плохо. Считай {kcal} грубой прикидкой и проверь граммы, прежде чем доверять сумме. В следующий раз поможет второй ракурс.",
    lowOverGain: "Даже грубо это считается: сегодня примерно {over} сверх {plan}.",
    lowOverOther: "Даже грубо это считается: сегодня примерно {over} сверх {plan}. Завтра цифра свежая.",
    lowLeftGain: "Даже грубо это считается: сегодня ещё примерно {left} из {plan} нужно добрать.",
    lowLeftOther: "Даже грубо это считается: сегодня осталось примерно {left} из {plan}.",
    firstIn: "Первый записан. {kcal} ккал — {arithmetic}",
    fixHint: "Если что-то не так, скажи — «риса половина», «без авокадо» — или нажми на карточку и поменяй граммы.",
    sodium: "Натрия здесь много. Оценено только потому, что ты об этом попросил.",
    satfat: "Насыщенных жиров здесь много. Оценено только потому, что ты об этом попросил.",
    noted: "«{note}» — записал, это в цифрах.",
  },
};

export const THREAD_COPY: Localized<ThreadCopy> = { en: EN, fr: FR, de: DE, it: IT, es: ES, vi: VI, id: ID, ru: RU };

/** The thread's fixed words, in one language. English for one nobody has written yet. */
export const threadCopyFor = (lang: Lang): ThreadCopy => t(lang)(THREAD_COPY);

/** `{placeholder}` per declared key; a key with nothing to fill it is left alone, never blanked. */
export const fillCopy = (template: string, params: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (whole, key: string) => params[key] ?? whole);
