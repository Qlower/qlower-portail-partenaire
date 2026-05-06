// Calendrier fiscal Qlower — données extraites du sheet
// "CALENDRIER FISCAL - BtoB 2026 2027.xlsx" (Coline Sinquin, mai 2026).
//
// Structure :
// - urgence : couleur d'alerte affichée sur la fiche mois
// - regimes : régimes / contribuables concernés (LMNP, foncier réel, IFI…)
// - intro / aSavoir / bonnesPratiques / nouveautes : sections de la fiche détaillée
//
// Mise à jour : la source est un Google Sheet partagé par Coline. Pour mettre
// à jour le contenu, ré-extraire le xlsx et reformuler ces blocs.

export type Urgence = "prioritaire" | "important" | "modere" | "planification";

export interface MoisFiscal {
  /** ex: "mars-2026" — utilisé comme id d'ancre */
  slug: string;
  /** ex: "Mars 2026" */
  mois: string;
  annee: 2026 | 2027;
  /** ex: "Préparation de la liasse" */
  themePrincipal: string;
  /** Multiline, séparé par "\n" */
  datesCles: string;
  urgence: Urgence;
  /** ex: "Foncier, LMNP, SCI IR" */
  regimes: string;
  /** Phrase d'intro ~3-5 lignes */
  intro: string;
  /** Bullets "À savoir" — chacune une ligne (sans leading bullet) */
  aSavoir?: string[];
  /** Bullets "Bonnes pratiques" — chacune une ligne (sans leading bullet) */
  bonnesPratiques: string[];
  /** Bullets "Nouveautés fiscales" */
  nouveautes?: string[];
}

export interface Dispositif {
  nom: string;
  type: string;
  avantage: string;
  plafond: string;
  conditions: string[];
  isNouveau?: boolean;
}

export const URGENCE_LABEL: Record<Urgence, { label: string; bg: string; text: string; border: string; emoji: string }> = {
  prioritaire: { label: "Prioritaire", bg: "bg-red-50", text: "text-red-700", border: "border-red-200", emoji: "🔴" },
  important: { label: "Important", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", emoji: "🟠" },
  modere: { label: "Modéré", bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", emoji: "🟡" },
  planification: { label: "Planification", bg: "bg-green-50", text: "text-green-700", border: "border-green-200", emoji: "🟢" },
};

export const CALENDRIER: MoisFiscal[] = [
  {
    slug: "mars-2026",
    mois: "Mars 2026",
    annee: 2026,
    themePrincipal: "Préparation déclarative — Revenus fonciers, LMNP & SCI",
    datesCles: "Collecte des justificatifs\nOuverture campagne : 9 avril",
    urgence: "important",
    regimes: "Foncier, LMNP, SCI IR",
    intro:
      "Mars est le mois de la préparation active avant l'ouverture de la campagne déclarative du 9 avril. Investisseurs en location nue, LMNP ou via une SCI à l'IR : encore quelques semaines pour rassembler les documents, calculer les charges déductibles et, le cas échéant, choisir entre régime micro et régime réel. C'est aussi le moment de valider les stratégies de déficit foncier et d'amortissement avant la clôture de l'exercice comptable pour les LMNP au réel.",
    aSavoir: [
      "En location nue au régime réel, sont déductibles : intérêts d'emprunt, taxe foncière, charges de copropriété non récupérables, primes d'assurance, travaux d'entretien et de réparation, frais de gestion. Les travaux de construction ou d'agrandissement ne sont pas déductibles.",
      "Le déficit foncier imputable sur le revenu global est plafonné à 10 700 € par an (21 400 € si travaux de rénovation énergétique permettant de sortir d'une passoire thermique).",
      "En LMNP au réel, l'amortissement du bien (composants) et du mobilier réduit le résultat BIC. Attention : depuis le 1er janvier 2025, les amortissements pratiqués sont réintégrés dans la plus-value lors de la cession.",
      "Les déclarations papier peuvent être envoyées entre le 27 mars et le 17 avril 2026.",
    ],
    bonnesPratiques: [
      "Seuil micro-foncier : si les revenus bruts fonciers sont inférieurs à 15 000 €, le régime micro s'applique automatiquement (abattement de 30 %). À comparer avec le réel si les charges dépassent 30 % des recettes.",
      "Pour les LMNP, transmettre au comptable le récapitulatif des loyers perçus, des charges et de la valeur vénale du bien pour la révision du tableau d'amortissement.",
      "Anticiper l'impact de la réintégration des amortissements sur une éventuelle cession : simuler la plus-value nette avant toute décision de vente.",
      "Vérifier l'éligibilité des biens au nouveau dispositif Jeanbrun pour les acquisitions en cours de négociation.",
    ],
    nouveautes: [
      "Le nouveau statut du bailleur privé (Jeanbrun) introduit l'amortissement en location nue : une révolution pour les investisseurs en foncier pur qui souhaitent réduire leur base imposable.",
      "MaPrimeRénov' reprend après une interruption début 2026 liée au retard du budget. Les dossiers 2025 non validés peuvent être déposés. Cumul possible avec le déficit foncier bonifié pour les rénovations énergétiques lourdes.",
      "Le barème IR 2026 est revalorisé de 0,9 % : vérifier l'impact sur la tranche marginale d'imposition avant de finaliser la stratégie de déduction.",
    ],
  },
  {
    slug: "avril-2026",
    mois: "Avril 2026",
    annee: 2026,
    themePrincipal: "Ouverture de la campagne déclarative — IR 2025 & IFI 2026",
    datesCles: "9 avr : ouverture en ligne\n19 mai : limite papier",
    urgence: "prioritaire",
    regimes: "Tous régimes + IFI (patrimoine > 1,3 M€)",
    intro:
      "Le 9 avril 2026, l'administration fiscale ouvre officiellement la campagne de déclaration des revenus 2025 et de l'IFI 2026. Tous les contribuables peuvent accéder à leur déclaration préremplie sur impots.gouv.fr. Pour les investisseurs immobiliers, c'est le moment critique : revenus fonciers, BIC meublés, SCI, déficits, amortissements et, pour les patrimoines supérieurs à 1,3 million d'euros, la déclaration IFI via l'annexe 2042-IFI.",
    aSavoir: [
      "La déclaration en ligne est obligatoire pour tout foyer dont la résidence principale dispose d'un accès internet. La déclaration papier n'est possible que dans des cas très limités.",
      "L'IFI se déclare en même temps que les revenus, via l'annexe 2042-IFI. La valeur retenue est celle du patrimoine immobilier net taxable au 1er janvier 2026.",
      "Les dons ouvrant droit à réduction d'IFI (75 %) doivent avoir été réalisés avant la date limite de dépôt de la zone concernée.",
      "Pour l'IFI, déduire les dettes immobilières : emprunts en cours, travaux à payer, taxe foncière exigible et non encore acquittée au 1er janvier.",
      "Contribuables soumis à l'IFI : la déclaration automatique n'est PAS possible, une démarche active est obligatoire.",
    ],
    bonnesPratiques: [
      "Ne pas se fier aux données préremplies : vérifier systématiquement les revenus fonciers, les BIC, les charges et les déficits reportés mentionnés sur le dernier avis d'imposition.",
      "Pour l'IFI, évaluer chaque bien à sa valeur vénale réelle au 1er janvier 2026. Une expertise ou des comparaisons de marché peuvent être utiles en cas de patrimoine important.",
      "Vérifier les reports de déficits fonciers des années antérieures et les imputer sur les résultats fonciers 2025.",
      "Si un bien a été acquis via le dispositif Jeanbrun depuis le 21 février 2026, joindre l'engagement de location lors de la déclaration pour activer le dispositif de façon irrévocable.",
    ],
    nouveautes: [
      "Pour les contribuables ayant acquis un bien sous le dispositif Relance Logement (Jeanbrun) entre le 21 février et le 31 décembre 2026, la première déduction d'amortissement peut être activée sur la déclaration 2026 (revenus de l'année d'acquisition).",
      "La contribution différentielle sur les hauts revenus (CDHR, 20 % minimum) est prorogée : si le RFR dépasse 250 000 €, vérifier le taux effectif d'imposition combiné.",
      "L'IFI est maintenu sans modification en 2026, malgré les débats parlementaires sur un retour à l'ISF. Les modalités d'évaluation et de déduction restent identiques à 2025.",
    ],
  },
  {
    slug: "mai-2026",
    mois: "Mai 2026",
    annee: 2026,
    themePrincipal: "Clôture déclaration IR / IFI & Liasse fiscale LMNP",
    datesCles: "15 mai : liasse LMNP réel\n19-21 mai : limite papier / zone 1\n28 mai : zone 2",
    urgence: "prioritaire",
    regimes: "LMNP réel, foncier réel, IFI",
    intro:
      "Mai concentre les dates butoirs les plus importantes de l'année pour les investisseurs immobiliers. La liasse fiscale des LMNP au régime réel doit être déposée avant le 15 mai. Les déclarations de revenus ont leurs premières dates limites : le 19 mai pour les déclarants papier, le 21 mai pour les zones 1 (départements 1 à 19 et non-résidents). C'est aussi le dernier moment pour corriger une erreur ou ajouter un document oublié.",
    aSavoir: [
      "Dates limites déclaration en ligne 2026 : Zone 1 (dép. 01–19 + non-résidents) jeudi 21 mai 2026 à 23h59. Zone 2 (dép. 20–54) jeudi 28 mai 2026. Zone 3 (dép. 55–976) jeudi 4 juin 2026.",
      "LMNP au régime réel : la liasse 2031 + annexes doit être déposée par voie électronique avant le 15 mai 2026 (via la procédure EDI-TDFC ou partenaire). Un retard entraîne une amende forfaitaire de 150 € minimum.",
      "En cas d'erreur constatée après validation, une déclaration rectificative reste possible jusqu'en décembre 2026.",
    ],
    bonnesPratiques: [
      "Vérifier que la case 4BE (déficit foncier imputable sur le revenu global) et la case 4BB (revenus fonciers) sont correctement renseignées.",
      "Pour les LMNP, contrôler que la réintégration des amortissements en cas de cession est bien prise en compte dans le tableau de plus-value si un bien a été vendu en 2025.",
      "Penser à déclarer les revenus de SCPI dans la bonne case (revenus fonciers si SCPI classique, BIC si SCPI meublée).",
      "Pour les parts de SCI à l'IR, la déclaration de la SCI (formulaire 2072) conditionne la quote-part de revenus ou déficits à reporter sur la 2042.",
    ],
    nouveautes: [
      "Première déclaration intégrant les nouvelles règles de plus-value LMNP : les amortissements pratiqués depuis le 1er janvier 2025 (loi n°2024-1039) sont réintégrés dans le calcul de la plus-value imposable pour les cessions réalisées en 2025.",
      "Pour les meublés de tourisme non classés, les nouvelles limites micro-BIC s'appliquent aux revenus 2025 : plafond de 15 000 € (au lieu de 77 700 €) et abattement de 30 % seulement (au lieu de 50 % ou 71 %).",
      "Le dispositif Jeanbrun étant entré en vigueur le 21 février 2026, les premières déductions s'appliqueront à partir de la déclaration 2027 (revenus 2026), sauf acquisition en 2026.",
    ],
  },
  {
    slug: "juin-2026",
    mois: "Juin 2026",
    annee: 2026,
    themePrincipal: "Dernière limite déclarative — Biens vacants & TVLH",
    datesCles: "4 juin : limite zone 3 (dépts 55-976)\n30 juin : déclaration biens vacants",
    urgence: "prioritaire",
    regimes: "LMNP, foncier réel, TVLH/TLV",
    intro:
      "Juin clôture définitivement la campagne déclarative 2026 avec la dernière date limite pour les départements 55 à 976 (zone 3), le 4 juin à 23h59. C'est aussi l'échéance pour déclarer les logements vacants ou les résidences secondaires soumises à la nouvelle Taxe sur la Vacance des Logements Habituels (TVLH). Les propriétaires de logements vides doivent être particulièrement vigilants à cette nouvelle obligation.",
    aSavoir: [
      "Date limite zone 3 (dép. 55–976) : jeudi 4 juin 2026 à 23h59.",
      "La nouvelle TVLH (Taxe sur la Vacance des Logements Habituels), instaurée par la LF 2026, remplace la TLV et la THLV. Elle s'applique aux logements vacants depuis plus de 12 mois dans des zones tendues et dans certaines communes hors zones tendues (selon délibération).",
      "La déclaration des biens immobiliers (logements vacants, résidences secondaires) doit être effectuée ou mise à jour avant le 30 juin sur impots.gouv.fr (rubrique Gérer mes biens immobiliers).",
      "Le déficit foncier est imputable sur 10 ans sur les revenus fonciers futurs en cas de résultat non imputable sur le revenu global.",
    ],
    bonnesPratiques: [
      "Pour les logements vacants, déclarer leur situation exacte avant le 30 juin : motif de vacance (travaux, mise en vente), durée, usage. Cela peut exonérer de TVLH.",
      "Si des travaux ont permis de sortir un logement G ou F de la liste des passoires thermiques, conserver toutes les attestations pour bénéficier du déficit foncier bonifié à 21 400 €.",
      "Profiter de la clôture de campagne pour faire un premier bilan fiscal de mi-année et anticiper les investissements ou travaux du second semestre.",
      "Pour les SCPI, vérifier les attestations fiscales reçues et leur correcte intégration dans la déclaration déjà soumise.",
    ],
    nouveautes: [
      "La TVLH remplace la TLV et la THLV : les taux sont revus à la hausse pour décourager la rétention de logements vacants dans les zones en tension. Les communes peuvent délibérer pour l'appliquer sur leur territoire, y compris hors zones tendues.",
      "La taxe d'aménagement est ajustée rétroactivement au 1er janvier 2026 : certaines exonérations sont étendues aux annexes et équipements spécifiques, et les règles de recouvrement pour travaux sans autorisation sont clarifiées.",
      "La conversion de locaux non résidentiels en habitation bénéficie d'un régime fiscal clarifié dans le cadre de la taxe d'aménagement.",
    ],
  },
  {
    slug: "juillet-2026",
    mois: "Juillet 2026",
    annee: 2026,
    themePrincipal: "Remboursements fiscaux & bilan mi-année",
    datesCles: "24-31 juil : remboursements IR\nFin juil : solde crédits/réd. d'impôt",
    urgence: "modere",
    regimes: "Tous, en particulier LMNP & foncier",
    intro:
      "Juillet est le mois des remboursements : l'administration fiscale verse les trop-perçus de prélèvement à la source et le solde des crédits et réductions d'impôt. Pour les investisseurs immobiliers, c'est un moment stratégique pour analyser la situation fiscale réelle, comparer le résultat avec les anticipations et préparer les investissements ou les arbitrages patrimoniaux du second semestre.",
    aSavoir: [
      "Les remboursements d'impôt sur le revenu (trop-perçu de PAS) sont effectués le 24 ou le 31 juillet 2026 selon les cas.",
      "Le solde des crédits et réductions d'impôt (60 % restants après l'acompte de janvier) est versé fin juillet.",
      "L'avis d'imposition est disponible entre le 24 et le 31 juillet sur l'espace Finances publiques. Il précise le taux de PAS actualisé applicable dès septembre.",
      "Un solde à payer (IR insuffisamment prélevé en 2025) sera prélevé le 25 septembre si ≤ 300 €, ou en 4 mensualités de septembre à décembre.",
      "Vérifier l'avis d'IFI : le montant dû figure sur cet avis et sera prélevé en septembre ou novembre selon le montant.",
    ],
    bonnesPratiques: [
      "À réception de l'avis d'imposition, comparer le taux d'imposition réel des revenus immobiliers avec l'anticipation : ajuster les acomptes PAS si nécessaire.",
      "Si un remboursement important est attendu, vérifier que les coordonnées bancaires sont à jour sur impots.gouv.fr.",
      "Profiter du bilan mi-année pour simuler l'impact fiscal d'un investissement en Jeanbrun, d'un apport en SCPI ou d'une rénovation énergétique avant la fin d'année.",
      "Pour les SCI à l'IS, réfléchir à une distribution de dividendes ou à un réinvestissement du bénéfice en tenant compte de la flat tax (30 %) sur les dividendes.",
    ],
    nouveautes: [
      "Les investisseurs ayant opté pour le dispositif Jeanbrun sur une acquisition 2026 doivent vérifier que leur engagement de location a bien été pris en compte dans la déclaration déposée en mai/juin et que l'amortissement est correctement calculé.",
      "Avec la réintégration des amortissements LMNP (applicable depuis janvier 2025), les remboursements d'impôt peuvent être inférieurs aux années passées pour les contribuables ayant cédé des meublés en 2025 : la plus-value imposable a été augmentée.",
      "La contribution différentielle sur les hauts revenus (CDHR) peut générer un solde à payer plus important que prévu pour les hauts patrimoines : anticiper en juillet.",
    ],
  },
  {
    slug: "aout-2026",
    mois: "Août 2026",
    annee: 2026,
    themePrincipal: "Stratégie estivale — SCI & location saisonnière",
    datesCles: "Période propice à l'audit fiscal\nAnticipation travaux Q4",
    urgence: "planification",
    regimes: "SCI IS/IR, meublés tourisme, Airbnb",
    intro:
      "Août est souvent sous-estimé dans le calendrier fiscal, mais c'est une période idéale pour les investisseurs immobiliers afin de mener leur audit patrimonial sans urgence déclarative. La période estivale est propice à la réflexion sur la structuration (SCI, holding, LMNP, nu), à l'optimisation des meublés de tourisme et à la planification des travaux de rénovation énergétique avant la fin d'année.",
    aSavoir: [
      "Les SCI à l'IS permettent d'amortir les biens immobiliers et de limiter l'IS grâce aux charges. Le taux d'IS est de 15 % jusqu'à 42 500 € de bénéfice, puis 25 %. Attention : l'option IS est irrévocable pendant 15 ans minimum.",
      "Les meublés de tourisme classés bénéficient encore d'un abattement de 71 % au micro-BIC (plafond 188 700 €) contre seulement 30 % pour les non classés (plafond 15 000 €) après la réforme 2025-2026.",
      "La taxe de séjour, collectée par les plateformes (Airbnb, Booking), doit être vérifiée dans les déclarations en cas d'encaissement direct.",
      "Pour une location saisonnière avec CA > 37 500 € et 3 services para-hôteliers, la TVA au taux de 10 % s'applique désormais.",
    ],
    bonnesPratiques: [
      "Faire réaliser un bilan patrimonial complet : valeur des biens, endettement, fiscalité actuelle et optimisable, transmission.",
      "Pour des travaux de rénovation énergétique, les planifier maintenant pour les réaliser avant le 31 décembre et les déduire sur les revenus 2026.",
      "Pour les meublés non classés, engager une procédure de classement auprès d'un organisme accrédité pour bénéficier du régime fiscal favorable dès 2026.",
      "Évaluer l'opportunité de transformer un meublé touristique en location longue durée pour bénéficier du dispositif Jeanbrun en cas de restructuration.",
    ],
    nouveautes: [
      "La réforme de la location saisonnière de 2025-2026 rend les meublés non classés beaucoup moins attractifs fiscalement. Un classement officiel (1 à 5 étoiles) devient indispensable pour préserver la rentabilité nette.",
      "La taxe sur les holdings patrimoniales (20 % sur les actifs somptuaires) s'applique aux exercices clos à compter du 31 décembre 2026 : c'est le moment d'auditer les structures patrimoniales et de distinguer actifs opérationnels et actifs de jouissance.",
      "MaPrimeRénov' est à nouveau opérationnelle après la pause du début 2026 : déposer les dossiers pour les travaux d'été, cumulables avec le déficit foncier bonifié.",
    ],
  },
  {
    slug: "septembre-2026",
    mois: "Septembre 2026",
    annee: 2026,
    themePrincipal: "Paiement solde IR & mise à jour PAS",
    datesCles: "25 sep : prélèvement solde IR\n(ou 4 mensualités si > 300 €)",
    urgence: "prioritaire",
    regimes: "Tous régimes",
    intro:
      "Septembre est le mois du règlement du solde d'imposition sur les revenus 2025 et du recalibrage du taux de prélèvement à la source pour l'année en cours. Pour les investisseurs immobiliers, le montant prélevé peut être significatif si les revenus fonciers ou BIC ont augmenté par rapport aux anticipations. C'est également le moment de vérifier l'avis d'IFI et de préparer le paiement de la taxe foncière.",
    aSavoir: [
      "Le solde IR est prélevé le 25 septembre 2026 si ≤ 300 €, ou réparti en 4 mensualités (25 sept., oct., nov., déc.) si > 300 €.",
      "Le taux de PAS est automatiquement actualisé en septembre sur la base de la déclaration 2026. Modulation possible à la hausse ou à la baisse sur impots.gouv.fr en cas de changement de situation (cession d'un bien, variation de loyers).",
      "L'avis de taxe foncière est généralement disponible mi-septembre. La date limite de paiement est le 15 octobre (chèque) ou le 20 octobre (paiement en ligne).",
      "L'IFI peut faire l'objet d'un prélèvement en septembre selon le montant dû (indiqué sur l'avis d'imposition reçu en juillet-août).",
    ],
    bonnesPratiques: [
      "En cas d'anticipation d'une hausse des revenus fonciers 2026 (nouveaux loyers, fin de vacance), moduler le taux de PAS à la hausse pour éviter un solde élevé en septembre 2027.",
      "Contester la valeur locative cadastrale servant de base à la taxe foncière si elle semble surévaluée (réclamation avant le 31 décembre auprès du centre des Impôts).",
      "Pour les SCI à l'IS, vérifier les acomptes IS (15 mars, 15 juin, 15 septembre, 15 décembre) et ajuster si le résultat annuel diffère des estimations.",
      "Planifier les travaux déductibles avant le 31 décembre pour les imputer sur les revenus 2026.",
    ],
    nouveautes: [
      "L'actualisation du PAS intègre désormais les nouveaux régimes (Jeanbrun notamment) : si ce dispositif a été activé sur une acquisition 2026, l'administration fiscale ne le prend pas encore en compte dans le taux de PAS. Modifier manuellement.",
      "Le barème IR revalorisé de 0,9 % pour les revenus 2025 peut créer un écart entre le taux PAS et le taux réel : vérifier l'alignement sur l'avis de juillet.",
      "Pour les contribuables soumis à la CDHR (hauts revenus), le taux de PAS peut avoir été ajusté. S'assurer que la régularisation de septembre est cohérente avec la situation.",
    ],
  },
  {
    slug: "octobre-2026",
    mois: "Octobre 2026",
    annee: 2026,
    themePrincipal: "Taxe foncière & optimisation travaux de fin d'année",
    datesCles: "15 oct : limite paiement TF (chèque)\n20 oct : limite TF (en ligne)",
    urgence: "important",
    regimes: "Propriétaires bailleurs",
    intro:
      "Octobre concentre le paiement de la taxe foncière et marque le lancement de la période d'optimisation fiscale de fin d'année. Pour les investisseurs immobiliers, c'est le moment stratégique pour planifier les travaux déductibles, les acquisitions sous le dispositif Jeanbrun et les arbitrages patrimoniaux avant le 31 décembre. Deux mois restent pour réduire l'imposition sur les revenus 2026.",
    aSavoir: [
      "La taxe foncière est due par le propriétaire au 1er janvier de l'année. Elle est intégralement déductible des revenus fonciers en régime réel ou en LMNP au réel.",
      "Date limite de paiement : 15 octobre 2026 par chèque ou TIP SEPA, 20 octobre en ligne.",
      "Si des travaux importants modifiant la surface ou la consistance d'un bien ont été réalisés en 2025, les déclarer à l'administration pour une mise à jour de la valeur locative cadastrale (formulaire H1, H2 ou IL).",
      "Les logements bénéficiant du dispositif Jeanbrun peuvent, sous conditions, être exonérés partiellement de taxe foncière pendant 2 ans (biens neufs en zone éligible).",
    ],
    bonnesPratiques: [
      "Vérifier le droit à une exonération de taxe foncière (logements neufs, personnes âgées de plus de 75 ans, logements économes en énergie selon les délibérations communales).",
      "Engager les travaux déductibles avant le 31 décembre : l'appel de fonds ou la facture encaissée en 2026 permet la déduction sur les revenus de cette année.",
      "Pour le dispositif Jeanbrun, s'assurer que les acquisitions en cours atteignent les critères d'éligibilité (DPE, loyer plafonné, engagement) avant signature définitive.",
      "Réévaluer la stratégie entre régime micro et régime réel si la situation locative a évolué en 2026 (nouveaux biens, hausse des charges).",
    ],
    nouveautes: [
      "La nouvelle TVLH peut s'appliquer dès 2026 dans les communes qui ont délibéré en ce sens. Pour un logement inoccupé depuis plus d'un an, anticiper cette charge supplémentaire dans le calcul de rentabilité.",
      "La réforme de la taxe d'aménagement (ajustements rétroactifs au 1er janvier 2026) peut impacter les projets de construction ou de division parcellaire en cours : vérifier avec le notaire ou l'architecte.",
      "MaPrimeRénov' : les dossiers déposés avant fin octobre pour des travaux réalisés en 2026 bénéficient du calendrier de traitement prioritaire de fin d'année.",
    ],
  },
  {
    slug: "novembre-2026",
    mois: "Novembre 2026",
    annee: 2026,
    themePrincipal: "Taxe d'habitation (résidences secondaires) & TVLH",
    datesCles: "15 nov : TH résidences secondaires\nNouvelle TVLH (remplace TLV/THLV)",
    urgence: "important",
    regimes: "Résidences secondaires, logements vacants",
    intro:
      "Novembre marque l'échéance de la taxe d'habitation sur les résidences secondaires et les logements vacants, ainsi que la mise en application de la nouvelle TVLH. Pour les investisseurs possédant plusieurs biens, ce mois est aussi l'occasion de préparer les dernières optimisations fiscales de l'année : versements sur un PER immobilier, dons IFI, arbitrages de portefeuille et déduction des dernières charges avant le 31 décembre.",
    aSavoir: [
      "La taxe d'habitation sur les résidences secondaires reste due (la suppression ne concerne que les résidences principales). Date limite de paiement : 15 novembre 2026.",
      "Les communes peuvent appliquer une majoration de la TH sur les résidences secondaires dans les zones tendues (jusqu'à 60 % de majoration).",
      "La TVLH (logements vacants depuis plus de 12 mois) est calculée sur la valeur locative cadastrale brute : 17 % la 1ère année, 34 % la 2ème année et au-delà dans les zones concernées (taux à confirmer par décret).",
      "Pour les dons permettant de réduire l'IFI (réduction de 75 % dans la limite de 50 000 € par an), effectuer les versements avant la date limite déclarative 2027.",
    ],
    bonnesPratiques: [
      "Si un logement vacant a été remis en location entre juillet et novembre 2026, le signaler à l'administration pour ne pas être redevable de la TVLH ou de la TLV.",
      "Envisager un versement sur un Plan d'Épargne Retraite (PER) avant le 31 décembre pour déduire les versements du revenu global imposable 2026.",
      "Pour les gros contribuables (IFI), effectuer les dons aux organismes éligibles avant la clôture de l'année pour les imputer sur l'IFI 2027.",
      "Faire le point sur les charges foncières restant à engager (entretien, petites réparations) et accélérer leur réalisation avant fin décembre.",
    ],
    nouveautes: [
      "La TVLH remplace la TLV et la THLV avec un champ d'application potentiellement élargi : les communes hors zones tendues peuvent désormais l'instaurer par délibération. Vérifier l'état des délibérations des communes d'investissement.",
      "La taxe sur les holdings patrimoniales s'applique aux exercices clos à compter du 31 décembre 2026 : pour les biens détenus via une holding, anticiper dès novembre l'impact de cette taxe de 20 % sur les actifs non opérationnels.",
      "La suppression du caractère irrévocable de l'option PFU/barème progressif pour les plus-values et gains s'applique aux revenus 2026 : choix possible en 2027 lors de la déclaration de l'option la plus avantageuse.",
    ],
  },
  {
    slug: "decembre-2026",
    mois: "Décembre 2026",
    annee: 2026,
    themePrincipal: "Optimisation fiscale fin d'année & préparation 2027",
    datesCles: "31 déc : dernière chance déductions/investissements N\nModulation acompte janvier 2027",
    urgence: "prioritaire",
    regimes: "Tous régimes",
    intro:
      "Décembre est le dernier mois pour agir fiscalement sur l'exercice 2026. C'est la période la plus stratégique de l'année pour les investisseurs immobiliers : dernier appel de fonds SCPI, travaux à facturer, versements PER, acquisitions sous le dispositif Jeanbrun, ajustement du taux de PAS pour janvier 2027 et modulation de l'acompte de crédits d'impôt versé en janvier. Chaque décision prise avant le 31 décembre peut avoir un impact fiscal significatif l'année suivante.",
    aSavoir: [
      "Tout paiement effectué (charges, intérêts, travaux) avant le 31 décembre 2026 est déductible sur les revenus 2026. Le critère est la date d'encaissement par le prestataire, non la date de facturation.",
      "Les versements sur un PER individuel sont déductibles du revenu global dans la limite de 10 % du revenu net professionnel de N-1, avec des plafonds spécifiques.",
      "Les acomptes SCPI souscrits en décembre ne génèrent pas forcément de revenus fiscaux sur 2026 : vérifier les délais de jouissance de chaque SCPI.",
      "Avant le 31 décembre, modifier si besoin le taux de PAS pour 2027 et ajuster l'acompte de crédits d'impôt à verser en janvier 2027.",
    ],
    bonnesPratiques: [
      "Engager et payer les travaux déductibles (entretien, réparation, isolation) avant le 31 décembre. Un devis et un chèque encaissé suffisent pour l'imputation sur 2026.",
      "Pour activer le dispositif Jeanbrun sur une acquisition, l'acte authentique doit être signé avant le 31 décembre 2026 (date d'acquisition retenue).",
      "Vérifier que les loyers de décembre perçus en 2026 sont bien inclus dans le calcul de revenus fonciers ou BIC 2026, notamment en cas de virement tardif.",
      "Préparer un dossier fiscal complet pour le bilan N+1 : tableau des loyers, factures de travaux, attestations d'intérêts d'emprunt, taxe foncière, charges de copropriété.",
    ],
    nouveautes: [
      "Le dispositif Jeanbrun (Relance Logement) est ouvert jusqu'au 31 décembre 2028 : profiter des derniers mois de 2026 pour sécuriser une acquisition éligible.",
      "La taxe sur les holdings patrimoniales s'applique aux exercices clôturant au 31 décembre 2026 : si une holding détient des actifs non opérationnels, consulter un conseil en gestion de patrimoine pour adapter la structuration avant la clôture.",
      "Suppression de l'irrévocabilité de l'option PFU : à partir de la déclaration 2027 (revenus 2026), choix annuel possible entre la flat tax (30 %) et le barème progressif pour les plus-values et revenus mobiliers. Simuler dès maintenant l'option optimale selon la tranche marginale d'imposition.",
    ],
  },
  {
    slug: "janvier-2027",
    mois: "Janvier 2027",
    annee: 2027,
    themePrincipal: "Acompte crédits d'impôt & Bilan an 1 dispositif Jeanbrun",
    datesCles: "15 jan : acompte 60 % crédits/réd. d'impôt 2026\nPremier bilan Jeanbrun",
    urgence: "modere",
    regimes: "Tous régimes — Jeanbrun (1ère année pleine)",
    intro:
      "Janvier 2027 marque la première échéance fiscale de l'année et le début du premier bilan du dispositif Jeanbrun (Relance Logement) pour les investisseurs ayant acquis un bien entre le 21 février et le 31 décembre 2026. L'administration verse le 15 janvier l'acompte de 60 % sur les crédits et réductions d'impôt calculés d'après les dépenses de 2025. C'est aussi le moment de préparer la première déclaration intégrant les nouvelles déductions d'amortissement Jeanbrun, qui sera déposée au printemps.",
    aSavoir: [
      "L'acompte de 60 % est calculé sur la base des crédits et réductions d'impôt 2025 (déclaration faite en 2026). Si les dépenses 2026 sont inférieures à 2025, signaler à l'administration avant le 1er décembre 2026 pour éviter un trop-versé.",
      "Le taux de prélèvement à la source en vigueur de septembre 2026 à août 2027 est celui calculé sur les revenus 2025. Ce taux sera actualisé en septembre 2027 sur la base de la déclaration de printemps 2027 (revenus 2026).",
      "Pour les investisseurs Jeanbrun : la première déduction d'amortissement (3,5 % à 5,5 % selon le secteur, sur 80 % du prix d'acquisition) s'impute sur les revenus fonciers 2026, déclarés en 2027. Vérifier que le comptable ou Qlower a bien calculé le montant.",
      "La taxe sur les holdings patrimoniales (20 % sur actifs somptuaires) est due pour les exercices clos au 31 décembre 2026 : première échéance de paiement en 2027.",
    ],
    bonnesPratiques: [
      "Rassembler dès janvier tous les justificatifs 2026 : loyers perçus, charges déductibles, intérêts d'emprunt, taxe foncière, factures de travaux, attestations d'amortissement.",
      "Pour un bien acquis sous le dispositif Jeanbrun en 2026, préparer le tableau d'amortissement détaillé (assiette = 80 % du prix HFI, taux selon secteur de loyer) à transmettre au conseiller fiscal en vue de la déclaration d'avril.",
      "Pour les LMNP, contacter l'expert-comptable pour lancer la préparation de la liasse fiscale 2031 (date limite : 15 mai 2027).",
      "Pour une holding patrimoniale détenant des actifs non opérationnels, préparer la déclaration de la nouvelle taxe avec un conseil : première obligation déclarative en 2027.",
    ],
    nouveautes: [
      "Première année pleine d'application du dispositif Relance Logement (Jeanbrun) : les investisseurs ayant acquis en 2026 déclarent pour la première fois leur amortissement déductible en 2027. Un jalon fiscal historique pour la location nue.",
      "Première application de la taxe sur les holdings patrimoniales (exercices clos au 31 décembre 2026) : les holdings détenant des actifs somptuaires (résidences de prestige, yachts, œuvres d'art) sont taxées à 20 % de leur valeur vénale nette.",
      "Nouveau choix PFU/barème : à partir de la déclaration 2027 (revenus 2026), choix annuel libre entre la flat tax (30 %) ou le barème progressif sur les plus-values et revenus mobiliers — le choix n'est plus irrévocable.",
    ],
  },
  {
    slug: "fevrier-2027",
    mois: "Février 2027",
    annee: 2027,
    themePrincipal: "Préparation comptable LMNP & Clôture exercice SCI/IS",
    datesCles: "Clôture exercice comptable SCI IS (31 déc.)\nLiasse SCI IS : dépôt avant 15 mai",
    urgence: "important",
    regimes: "LMNP réel, SCI IS, Jeanbrun",
    intro:
      "Février 2027 est le mois de la préparation comptable intense pour les structures assujetties à l'impôt sur les sociétés (SCI IS, SARL de famille IS). L'exercice clos au 31 décembre 2026 doit être clôturé et la liasse fiscale préparée en vue du dépôt obligatoire avant le 15 mai. Pour les LMNP au régime réel, c'est aussi le moment de finaliser le bilan comptable 2026 avec l'expert-comptable afin d'établir les tableaux d'amortissement mis à jour.",
    aSavoir: [
      "Les SCI à l'IS et les SARL de famille soumises à l'IS doivent déposer leur liasse fiscale (formulaires 2065 et annexes) par voie dématérialisée au plus tard le 15 mai 2027.",
      "Le taux d'IS reste fixé à 15 % sur les 42 500 premiers euros de bénéfice, puis 25 % au-delà. Pas de modification annoncée pour 2027 à ce stade.",
      "Pour les LMNP au régime réel, la liasse 2031 doit également être déposée au 15 mai 2027. La réintégration des amortissements dans le calcul des plus-values (applicable depuis jan. 2025) doit être parfaitement intégrée dans le tableau de suivi des amortissements.",
      "Les acomptes d'IS trimestriels (15 mars, 15 juin, 15 septembre, 15 décembre) doivent être provisionnés dès février sur la base du résultat estimé de l'exercice 2027.",
    ],
    bonnesPratiques: [
      "Remettre à l'expert-comptable l'intégralité des pièces comptables 2026 en février pour respecter les délais de production de la liasse et éviter les pénalités (150 € minimum).",
      "Pour les SCI IS, évaluer si une distribution de dividendes (flat tax 30 %) ou un maintien des bénéfices en réserve est plus avantageux au regard de la stratégie patrimoniale globale.",
      "Vérifier que les tableaux d'amortissement des biens Jeanbrun acquis en 2026 sont correctement intégrés dans la comptabilité et distincts des amortissements LMNP.",
      "En cas de cession envisagée d'un bien meublé en 2027, simuler dès maintenant la plus-value nette avec réintégration des amortissements depuis 2025.",
    ],
    nouveautes: [
      "Première clôture d'exercice intégrant la taxe sur les holdings patrimoniales (actifs somptuaires, 20 %) : les structures concernées doivent provisionner cette charge dans leurs comptes 2026 et anticiper la déclaration 2027.",
      "Les décrets d'application du dispositif Jeanbrun (publiés courant 2026) précisent les plafonds de loyers définitifs par zone géographique et les modalités de cumul avec le déficit foncier. Vérifier la conformité des biens avec le comptable.",
      "Pour les SCI IS, le régime d'apport-cession (art. 150-0 B ter CGI) est durci : les conditions de remploi des plus-values en report d'imposition excluent désormais les investissements immobiliers non productifs. Revoir les schémas d'apport si concerné.",
    ],
  },
  {
    slug: "mars-2027",
    mois: "Mars 2027",
    annee: 2027,
    themePrincipal: "Collecte justificatifs — 1ère déclaration revenus Jeanbrun",
    datesCles: "Collecte pièces justificatives\nPremière déduction amortissement Jeanbrun (revenus 2026)",
    urgence: "important",
    regimes: "Jeanbrun, foncier réel, LMNP",
    intro:
      "Mars 2027 est un mois charnière : c'est la première fois que les investisseurs ayant souscrit au dispositif Jeanbrun en 2026 préparent leur déclaration de revenus avec une déduction d'amortissement sur un bien en location nue. Une nouveauté fiscale majeure qui nécessite une préparation rigoureuse. Par ailleurs, les investisseurs en location meublée déclarent pour la troisième année consécutive avec la règle de réintégration des amortissements sur les plus-values.",
    aSavoir: [
      "Pour les biens Jeanbrun acquis en 2026 : la déduction s'opère sur le résultat foncier via le formulaire 2044. L'assiette est de 80 % du prix d'acquisition, le taux variant de 3 % (ancien, loyer intermédiaire) à 5,5 % (neuf, loyer très social).",
      "Exemple : bien neuf acquis 250 000 €, loyer social → assiette 200 000 €, déduction annuelle = 200 000 × 4,5 % = 9 000 € (dans la limite du plafond 10 000 €).",
      "L'engagement de location de 9 ans doit être respecté : toute rupture (vente, changement d'usage) entraîne la reprise de l'avantage fiscal avec intérêts de retard.",
      "En micro-foncier (recettes < 15 000 €), le dispositif Jeanbrun n'est PAS applicable : il faut impérativement opter pour le régime réel pour en bénéficier.",
    ],
    bonnesPratiques: [
      "Vérifier que l'option pour le régime réel foncier a bien été exercée : sans cette option, le dispositif Jeanbrun n'est pas accessible et l'abattement micro-foncier s'applique.",
      "Rassembler l'acte d'acquisition (prix, date, nature du bien), l'engagement de location signé, le bail en cours et les quittances de loyer pour justifier les plafonds respectés.",
      "Comparer le résultat foncier 2026 avant et après déduction Jeanbrun pour vérifier que l'avantage fiscal est réel compte tenu de la tranche marginale d'imposition.",
      "Pour les LMNP, préparer le récapitulatif des amortissements 2026 (bien, mobilier, frais d'acquisition) et le bilan des charges réelles pour transmission au comptable.",
    ],
    nouveautes: [
      "Première déclaration des déductions Jeanbrun (amortissement location nue) sur les revenus fonciers 2026 : une nouveauté absolue dans le paysage fiscal français. L'impact peut être significatif (jusqu'à 12 000 € de déduction annuelle) selon le profil.",
      "Nouveau choix PFU/barème progressif librement réversible dès la déclaration 2027 : analyser quelle option est optimale pour les plus-values de cession immobilière et les dividendes de SCI IS réalisés en 2026.",
      "MaPrimeRénov' 2027 : les conditions et plafonds pour l'année 2027 seront précisés dans la loi de finances 2027 (attendue début 2027). Consulter l'ANAH pour les dossiers en cours et les nouvelles enveloppes disponibles.",
    ],
  },
  {
    slug: "avril-2027",
    mois: "Avril 2027",
    annee: 2027,
    themePrincipal: "Ouverture campagne déclarative IR 2026 & IFI 2027",
    datesCles: "~8 avr : ouverture service en ligne\nNouveau choix PFU/barème progressif librement réversible",
    urgence: "prioritaire",
    regimes: "Tous régimes + IFI (patrimoine > 1,3 M€)",
    intro:
      "L'ouverture de la campagne déclarative 2027 (revenus 2026) est attendue autour du 8 avril. C'est la première année intégrant pleinement les déductions Jeanbrun, le nouveau libre choix PFU/barème progressif, et la déclaration de la taxe holdings pour les structures concernées. Pour les investisseurs soumis à l'IFI, la valorisation du patrimoine au 1er janvier 2027 doit intégrer les nouveaux biens acquis en 2026 et l'impact du dispositif Jeanbrun sur leur valeur.",
    aSavoir: [
      "Dates exactes par zone publiées par la DGFIP au printemps 2027. Estimations par analogie : Zone 1 (dép. 01–19 + non-résidents) ~jeudi 20 mai 2027, Zone 2 (dép. 20–54) ~jeudi 27 mai 2027, Zone 3 (dép. 55–976) ~jeudi 3 juin 2027.",
      "Nouveau en 2027 : l'option PFU (30 %) ou barème progressif pour plus-values et revenus mobiliers est désormais librement réversible chaque année. Simuler les deux options.",
      "IFI 2027 : les biens acquis via le dispositif Jeanbrun font partie du patrimoine taxable à l'IFI. Vérifier si les dettes d'acquisition sont déductibles (emprunt immobilier).",
      "La CDHR (20 % minimum) est maintenue pour les RFR > 250 000 € (célibataire) ou 500 000 € (couple) tant que le déficit public reste au-dessus de 3 % du PIB.",
    ],
    bonnesPratiques: [
      "Simuler les deux options fiscales (PFU vs barème) pour les revenus mobiliers et plus-values 2026 avant de valider la déclaration. L'option la plus avantageuse dépend de la tranche marginale d'imposition.",
      "Pour la déclaration Jeanbrun, joindre si demandé : la copie de l'acte de vente, l'engagement de location, le justificatif du niveau de loyer (intermédiaire/social/très social) et l'attestation DPE du logement.",
      "Pour l'IFI, actualiser la valorisation de chaque bien immobilier. Les biens loués via Jeanbrun peuvent bénéficier d'une décote de valorisation (bien occupé à loyer modéré).",
      "Vérifier les reports de déficits fonciers antérieurs sur l'avis 2026 et les imputer prioritairement sur les résultats fonciers 2026 avant d'activer la déduction Jeanbrun.",
    ],
    nouveautes: [
      "Première déclaration avec le libre choix PFU/barème progressif non irrévocable : pour les investisseurs ayant des dividendes de SCI IS et des plus-values mobilières significatifs en 2026, cela peut générer une économie d'impôt substantielle.",
      "Première déclaration IFI intégrant les biens acquis sous Jeanbrun : vérifier si les biens loués à loyer intermédiaire ou social peuvent bénéficier d'une exonération partielle d'IFI (biens affectés à une activité, selon la doctrine fiscale applicable).",
      "La loi de finances 2027 (si adoptée avant avril) peut introduire de nouvelles mesures : rester attentif aux annonces budgétaires et actualités Qlower.",
    ],
  },
  {
    slug: "mai-2027",
    mois: "Mai 2027",
    annee: 2027,
    themePrincipal: "Clôture déclaration IR / IFI — Première déduction Jeanbrun",
    datesCles: "~15 mai : liasse LMNP réel\n~20 mai : zone 1 / ~27 mai : zone 2",
    urgence: "prioritaire",
    regimes: "LMNP réel, Jeanbrun, IFI, foncier réel",
    intro:
      "Mai 2027 marque la clôture de la campagne déclarative avec les premières déductions Jeanbrun officiellement inscrites dans les déclarations de revenus fonciers de millions d'investisseurs. La liasse fiscale des LMNP au régime réel doit être impérativement déposée avant le 15 mai. C'est aussi un mois de vigilance particulière : la complexité des nouveaux dispositifs (Jeanbrun, PFU libre, taxe holdings) multiplie les risques d'erreurs déclaratives à corriger avant la date butoir.",
    aSavoir: [
      "Dates limites estimées pour la déclaration en ligne 2027 : Zone 1 (dép. 01–19 + non-résidents) ~jeudi 20 mai 2027, Zone 2 (dép. 20–54) ~jeudi 27 mai 2027, Zone 3 (dép. 55–976) ~jeudi 3 juin 2027.",
      "Liasse LMNP au régime réel : dépôt avant le 15 mai 2027 via EDI-TDFC. Le résultat BIC net (après amortissements) vient s'imputer sur le revenu global si déficitaire (sous conditions LMP) ou génère un report BIC pour les LMNP.",
      "Les cessions de biens meublés réalisées en 2026 avec réintégration des amortissements doivent être déclarées : la plus-value majorée est imposable à l'IR + prélèvements sociaux (17,2 %). Vérifier le calcul établi par le notaire.",
      "Un oubli de la déduction Jeanbrun dans la déclaration n'est pas perdu : une déclaration rectificative reste possible jusqu'en décembre 2027.",
    ],
    bonnesPratiques: [
      "Pour le dispositif Jeanbrun, vérifier la cohérence entre le montant déclaré case 4BE (ou la nouvelle case dédiée à l'amortissement Jeanbrun, selon les instructions DGFIP 2027) et le tableau d'amortissement préparé par le comptable.",
      "Contrôler le plafond annuel de déduction selon le secteur : 8 000 € (intermédiaire), 10 000 € (social), 12 000 € (très social). L'excédent n'est pas reportable.",
      "Pour des biens en location nue ET des biens Jeanbrun, distinguer clairement les résultats fonciers : le régime réel classique et le régime Jeanbrun sont des sous-régimes du foncier réel, mais leurs déductions suivent des règles différentes.",
      "Vérifier l'option PFU/barème pour les dividendes de SCI IS : comparer systématiquement les deux options avant validation.",
    ],
    nouveautes: [
      "Premières déductions Jeanbrun officialisées à grande échelle sur les déclarations 2027 : c'est la consécration d'une réforme historique pour la location nue, qui aligne partiellement sa fiscalité sur celle de la location meublée.",
      "Pour les investisseurs ayant plusieurs biens Jeanbrun (dans la limite de 2 biens selon les conditions du dispositif), la déduction peut atteindre jusqu'à 24 000 € par an, générant un déficit foncier imputable sur le revenu global dans certains cas.",
      "La TVLH (Taxe sur la Vacance des Logements Habituels) est en pleine application : les propriétaires de logements vacants depuis plus d'un an reçoivent leurs premiers avis de taxe. Vérifier les situations de vacance et contester si nécessaire.",
    ],
  },
  {
    slug: "juin-2027",
    mois: "Juin 2027",
    annee: 2027,
    themePrincipal: "Dernière limite déclarative & Point mi-parcours Jeanbrun",
    datesCles: "~3 juin : zone 3\n30 juin : déclaration biens vacants (TVLH)",
    urgence: "prioritaire",
    regimes: "Zone 3, TVLH, Jeanbrun (suivi engagement 9 ans)",
    intro:
      "Juin 2027 ferme définitivement la campagne déclarative et marque la fin de la première année complète de mise en œuvre du dispositif Jeanbrun. C'est le moment d'effectuer un premier suivi de conformité : les loyers pratiqués respectent-ils les plafonds d'engagement ? Le locataire répond-il aux conditions de ressources ? La TVLH est pleinement opérationnelle et les premières contestations éventuelles doivent être formulées avant le 31 décembre 2027.",
    aSavoir: [
      "Date limite zone 3 (dép. 55–976) : ~jeudi 3 juin 2027 à 23h59 (date exacte confirmée par la DGFIP au printemps 2027).",
      "La déclaration ou mise à jour des biens immobiliers (logements vacants, résidences secondaires, changements d'usage) doit être effectuée avant le 30 juin sur impots.gouv.fr.",
      "Suivi Jeanbrun — Conformité annuelle à vérifier : (1) le loyer annuel ne dépasse pas le plafond du secteur (intermédiaire/social/très social), (2) le locataire respecte les plafonds de ressources applicables, (3) le logement est bien loué à titre de résidence principale du locataire, (4) la durée de 9 ans d'engagement est en cours (pas de cession ou de changement d'usage).",
      "Toute rupture de l'engagement entraîne la reprise de l'ensemble des déductions pratiquées, majorées des intérêts de retard.",
    ],
    bonnesPratiques: [
      "Effectuer un audit Jeanbrun de mi-parcours : vérifier les loyers pratiqués par rapport aux plafonds officiels (publiés par arrêté préfectoral ou décret), les ressources du locataire et la conformité DPE du logement si des travaux ont été réalisés.",
      "Conserver toutes les pièces justificatives de l'engagement Jeanbrun (acte d'acquisition, bail, avis de ressources du locataire, justificatifs de loyers) pendant toute la durée de l'engagement (9 ans + délai de reprise fiscale de 3 ans).",
      "Pour les biens soumis à la TVLH, déclarer tout changement de situation (mise en location, vente, travaux rendant le bien inhabitable) pour sortir du champ de la taxe.",
      "Profiter de la clôture de campagne pour planifier les investissements du second semestre 2027 et les travaux déductibles sur les revenus fonciers 2027.",
    ],
    nouveautes: [
      "Premier bilan annuel du dispositif Jeanbrun : les pouvoirs publics et l'administration fiscale feront un point sur le nombre de biens déclarés et l'efficacité du dispositif pour réorienter l'offre locative. Des ajustements par décret sont possibles (plafonds de loyers, zones d'application, taux d'amortissement).",
      "La TVLH en plein régime : les communes ayant délibéré pour son application hors zones tendues l'appliquent pour la première fois sur les logements vacants depuis 2025-2026. Les contestations doivent être formées dans les délais légaux.",
      "Si une loi de finances rectificative 2027 (LFR) est adoptée en cours d'année, elle peut modifier les paramètres du dispositif Jeanbrun ou d'autres régimes.",
    ],
  },
];

export const DISPOSITIFS_2026: Dispositif[] = [
  {
    nom: "Relance Logement (Jeanbrun)",
    type: "Location nue longue durée",
    avantage: "Amortissement 3,5 – 5,5 %/an (base 80 % du prix d'achat)",
    plafond: "8 000 – 12 000 €/an selon secteur loyer",
    conditions: [
      "Acquisition entre le 21/02/2026 et le 31/12/2028",
      "Engagement de location 9 ans",
      "Loyers plafonnés (intermédiaire/social/très social)",
      "Neuf ou ancien + 30 % de travaux",
    ],
    isNouveau: true,
  },
  {
    nom: "LMNP régime réel",
    type: "Location meublée non professionnelle",
    avantage: "Amortissement bien + mobilier, déduction de toutes les charges",
    plafond: "Résultat BIC = 0 (amortissement non plafonné)",
    conditions: [
      "Tous types de biens meublés",
      "Réintégration amortissements sur PV depuis janvier 2025",
      "Libre géographiquement",
    ],
  },
  {
    nom: "Déficit foncier",
    type: "Location nue régime réel",
    avantage: "Déduction sur revenu global, report 10 ans sur revenus fonciers",
    plafond: "10 700 €/an sur revenu global · 21 400 € si rénovation énergétique (passoire thermique)",
    conditions: ["Travaux d'entretien / réparation", "Bien loué à titre onéreux", "Immeuble nu"],
  },
  {
    nom: "Micro-foncier",
    type: "Location nue < 15 000 €/an",
    avantage: "Abattement forfaitaire 30 %",
    plafond: "15 000 € de recettes",
    conditions: [
      "Revenus bruts < 15 000 €",
      "Simplicité déclarative",
      "Pas de déduction des charges réelles",
    ],
  },
  {
    nom: "Micro-BIC meublés classés",
    type: "Meublés tourisme classés 1–5 étoiles",
    avantage: "Abattement 71 %",
    plafond: "188 700 € de CA",
    conditions: [
      "Classement officiel obligatoire",
      "Plus avantageux si peu de charges réelles",
    ],
  },
  {
    nom: "Micro-BIC meublés non classés",
    type: "Meublés tourisme non classés",
    avantage: "Abattement 30 % seulement",
    plafond: "15 000 € de CA (plafond divisé par 5 vs avant)",
    conditions: [
      "Réforme 2025-2026 très pénalisante",
      "Classement fortement recommandé",
    ],
  },
  {
    nom: "SCI à l'IS",
    type: "Toute location (via SCI)",
    avantage: "Amortissement + IS 15 % / 25 %",
    plafond: "IS 15 % jusqu'à 42 500 €, 25 % au-delà",
    conditions: [
      "Option IS irrévocable 15 ans minimum",
      "Comptabilité obligatoire",
      "Fiscalité dividendes (flat tax 30 %)",
    ],
  },
  {
    nom: "IFI (Impôt sur la Fortune Immobilière)",
    type: "Patrimoine immobilier net > 1,3 M€",
    avantage: "Réduction IFI par dons (75 %), déduction des dettes immobilières",
    plafond: "Barème 0,5 % → 1,5 % · Seuil 1 300 000 €",
    conditions: [
      "Déclaration avec IR (annexe 2042-IFI)",
      "Valeur au 1er janvier N",
      "Maintenu sans modification en 2026",
    ],
  },
  {
    nom: "TVLH (nouvelle)",
    type: "Logements vacants > 12 mois",
    avantage: "Taxe (non déductible)",
    plafond: "Basée sur VLC brute · 17 % an 1, 34 % an 2+",
    conditions: [
      "Remplace TLV et THLV",
      "Communes en zones tendues",
      "Communes hors zones tendues ayant délibéré",
    ],
    isNouveau: true,
  },
];
