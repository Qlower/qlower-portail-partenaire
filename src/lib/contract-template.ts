// Template du contrat BTOB Qlower - Affiliation & Marque Blanche - 2026
// Génération HTML imprimable (print-to-PDF côté browser).
//
// Source : CONTRAT BTOB AF&MB - 2026.pdf (17 pages, 18 articles + 5 annexes)
// Le HTML reproduit fidèlement la structure (titres, articles, listes, signatures)
// avec un styling print-optimisé : marges A4, page-break-inside: avoid sur les
// titres, font Inter, navy #0A3855 pour les titres.

import type { Partner } from "@/types";

interface ContractData {
  // Identité société partenaire
  name: string;            // Raison sociale
  type: string;            // Forme juridique (SAS, SARL...)
  capital: string;         // "10 000 €"
  rcs: string;             // Ville du RCS
  siret: string;
  address: string;         // Adresse complète (rue + numéro)
  zip: string;             // Code postal
  town: string;            // Ville
  // Signataire
  contactCivil: string;    // M. / Mme
  contactForename: string;
  contactName: string;
  contactPosition: string;
  // Métadonnées
  generatedDate: string;   // "13 mai 2026"
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getContractData(partner: Partner): ContractData {
  // Fallback "_____" pour les champs manquants → l'admin voit ce qui doit être complété
  const blank = "_____________";
  const civilite = partner.contact_civilite || "M./Mme";
  return {
    name: partner.nom || blank,
    type: partner.forme_juridique || blank,
    capital: partner.capital || blank,
    rcs: partner.rcs || blank,
    siret: partner.siret || blank,
    address: partner.adresse || blank,
    zip: partner.code_postal || blank,
    town: partner.ville || blank,
    contactCivil: civilite,
    contactForename: partner.contact_prenom || blank,
    contactName: partner.contact_nom || blank,
    contactPosition: partner.contact_position || blank,
    generatedDate: new Date().toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  };
}

export function renderContractHtml(partner: Partner): string {
  const d = getContractData(partner);
  const e = escapeHtml; // local alias

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Contrat Qlower - ${e(d.name)}</title>
<style>
  /* ===== Page setup (A4, print margins) ===== */
  @page {
    size: A4;
    margin: 18mm 16mm 20mm 16mm;
  }
  @media print {
    .no-print { display: none !important; }
    body { background: white; }
  }
  html, body {
    font-family: "Inter", -apple-system, BlinkMacSystemFont, Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.55;
    color: #1a1a1a;
    background: #f5f5f5;
    margin: 0;
  }
  .sheet {
    background: white;
    max-width: 210mm;
    margin: 12mm auto;
    padding: 20mm 18mm;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  }
  @media print {
    .sheet { box-shadow: none; margin: 0; padding: 0; max-width: none; }
  }
  /* ===== Toolbar (only on screen) ===== */
  .toolbar {
    position: sticky; top: 0; z-index: 10;
    background: #0A3855; color: white;
    padding: 10px 16px; display: flex; gap: 12px;
    align-items: center; justify-content: space-between;
    font-size: 12px;
  }
  .toolbar strong { color: #F6CCA4; }
  .toolbar button {
    background: #F6CCA4; color: #0A3855;
    border: none; padding: 8px 16px; border-radius: 4px;
    font-weight: 600; cursor: pointer; font-size: 12px;
  }
  .toolbar button:hover { background: #fbe2c8; }
  .toolbar a { color: white; text-decoration: underline; font-size: 11px; }
  /* ===== Typography ===== */
  h1 {
    font-size: 18pt; color: #0A3855; text-align: center;
    margin: 0 0 8mm 0; letter-spacing: 0.5px;
    page-break-after: avoid;
  }
  h2 {
    font-size: 12pt; color: #0A3855; margin: 8mm 0 3mm 0;
    border-bottom: 1px solid #E5EDF1; padding-bottom: 2mm;
    page-break-after: avoid;
  }
  h3 {
    font-size: 10.5pt; color: #0A3855; font-weight: 600;
    margin: 5mm 0 2mm 0;
    page-break-after: avoid;
  }
  p { margin: 0 0 3mm 0; text-align: justify; }
  ul { margin: 0 0 3mm 4mm; padding-left: 4mm; }
  ul li { margin-bottom: 1mm; }
  strong { color: #0A3855; }
  .small { font-size: 9pt; color: #555; }
  .center { text-align: center; }
  .hero {
    background: #E5EDF1; padding: 6mm; text-align: center;
    margin: 0 0 6mm 0; border-left: 3px solid #0A3855;
  }
  .hero h2 { border: none; margin: 0 0 2mm 0; }
  .twocol {
    display: grid; grid-template-columns: 1fr 1fr; gap: 6mm;
    margin: 4mm 0; font-size: 9.5pt;
  }
  .twocol .col {
    background: #FFF5ED; padding: 4mm; border-left: 3px solid #F6CCA4;
  }
  .twocol .col strong { display: block; font-size: 10pt; margin-bottom: 1mm; }
  .party-block {
    background: #fafafa; padding: 4mm 5mm; border-left: 2px solid #0A3855;
    margin: 3mm 0;
  }
  .placeholder {
    background: #FFF6E5; color: #B8864E; font-weight: 600;
    padding: 0 4px; border-radius: 2px;
  }
  .signature-block {
    margin-top: 12mm;
    display: grid; grid-template-columns: 1fr 1fr; gap: 10mm;
    page-break-inside: avoid;
  }
  .signature-block .box {
    border: 1px solid #ddd; padding: 5mm; min-height: 35mm;
  }
  .signature-block .label { font-weight: 600; color: #0A3855; margin-bottom: 2mm; }
  .page-break { page-break-before: always; }
  .annex-title {
    background: #0A3855; color: white; padding: 4mm 5mm;
    text-align: center; font-size: 13pt; font-weight: 600;
    margin: 0 0 6mm 0;
    page-break-after: avoid;
  }
  table.barem {
    width: 100%; border-collapse: collapse; margin: 3mm 0;
    font-size: 9.5pt;
  }
  table.barem th, table.barem td {
    border: 1px solid #ddd; padding: 2mm 3mm; text-align: left;
  }
  table.barem th {
    background: #E5EDF1; color: #0A3855; font-weight: 600;
  }
</style>
</head>
<body>

<div class="toolbar no-print">
  <span>Aperçu contrat <strong>${e(d.name)}</strong> · ${e(d.generatedDate)}</span>
  <span>
    <a href="#" onclick="window.close(); return false;">Fermer</a>
    &nbsp;·&nbsp;
    <button onclick="window.print()">📄 Imprimer / Enregistrer en PDF</button>
  </span>
</div>

<div class="sheet">

<h1>CONTRAT DE PARTENARIAT QLOWER</h1>
<p class="center" style="margin-top:-4mm;color:#555;font-size:11pt;">
  Affiliation &amp; Marque Blanche<br/>
  <strong>Qlower (ComptAppart SAS)</strong>
</p>

<div class="twocol">
  <div class="col">
    <strong>— AFFILIATION —</strong>
    Apport d'affaires : marque et tarification Qlower.<br/>
    <em>Commission par client abonné.</em>
  </div>
  <div class="col">
    <strong>— MARQUE BLANCHE —</strong>
    Production fiscale sous la marque du Partenaire.<br/>
    <em>Tarification à l'acte — pré-payé ou post-facturé.</em>
  </div>
</div>
<p class="small center">
  Ces deux modes peuvent être activés indépendamment ou simultanément,
  sans avenant, par simple notification écrite (voir Article 2).
</p>

<h2>Entre les soussignées</h2>

<p><strong>D'une part,</strong></p>

<div class="party-block">
  <strong>${e(d.name)}</strong>, <span class="placeholder">${e(d.type)}</span>,
  au capital de <span class="placeholder">${e(d.capital)}</span>,
  immatriculée au Registre du Commerce et des Sociétés de
  <span class="placeholder">${e(d.rcs)}</span> sous le numéro
  <span class="placeholder">${e(d.siret)}</span>,
  dont le siège social est sis <span class="placeholder">${e(d.address)}</span>
  <span class="placeholder">${e(d.zip)}</span> <span class="placeholder">${e(d.town)}</span>.<br/><br/>
  Représentée par <span class="placeholder">${e(d.contactCivil)}</span>
  <span class="placeholder">${e(d.contactForename)}</span>
  <span class="placeholder">${e(d.contactName)}</span>,
  en sa qualité de <span class="placeholder">${e(d.contactPosition)}</span>,
  dûment habilité(e) à l'effet des présentes,<br/>
  <em>ci-après désignée le « <strong>Partenaire</strong> ».</em>
</div>

<p><strong>Et d'autre part,</strong></p>

<div class="party-block">
  La société <strong>ComptAppart</strong>, société par actions simplifiée
  au capital de 14 386,40 €, immatriculée au Registre du Commerce et des
  Sociétés de Paris sous le numéro 883 386 757, dont le siège social est sis
  158B avenue de Suffren, 75015 Paris.<br/><br/>
  Représentée par M. Christophe DUPRAT, en sa qualité de Président,
  dûment habilité à l'effet des présentes,<br/>
  <em>ci-après désignée le « <strong>Bénéficiaire</strong> ».</em>
</div>

<p class="small">
  Le Bénéficiaire et le Partenaire peuvent être désignés individuellement
  une « Partie » et collectivement les « Parties ».
</p>

<h2>Préambule</h2>
<p>
  Qlower (ComptAppart SAS) est un spécialiste reconnu de la fiscalité des
  revenus locatifs. Elle édite un logiciel dédié au traitement fiscal
  immobilier (ci-après le « <strong>Logiciel</strong> ») et propose des
  prestations complémentaires et des livrables associés (décrits à l'Annexe A).
  Le Partenaire exerce une activité en lien avec l'immobilier et souhaite
  associer les services de Qlower à son offre.
</p>
<p>
  Le présent contrat a été conçu pour accompagner l'ensemble du cycle de vie
  du partenariat, du premier apport d'affaires jusqu'à une intégration
  complète en marque blanche. Les deux modes de partenariat — Affiliation et
  Marque Blanche — sont tous deux traités dans ce document unique. Chaque mode
  est activé indépendamment, sans nécessiter de nouveau contrat ni d'avenant
  juridique. Cette souplesse permet à chaque Partenaire de faire évoluer sa
  relation commerciale avec Qlower au rythme de son activité.
</p>
<p>
  Les Parties déclarent avoir négocié le présent contrat de bonne foi et
  disposer de toutes les informations nécessaires à leur engagement en
  connaissance de cause.
</p>

<h2>Article 1 — Définitions</h2>
<p class="small">
  Les termes employés au présent contrat ont la signification qui leur est
  donnée par usage commercial commun et, le cas échéant, par les Annexes.
</p>

<h2>Article 2 — Objet et modes de partenariat</h2>
<p>
  Le présent contrat définit les conditions dans lesquelles Qlower et le
  Partenaire collaborent pour proposer les Services aux Clients du Partenaire.
  Il régit simultanément les deux modes de partenariat ci-après, chacun
  pouvant être activé ou désactivé indépendamment, à tout moment, par simple
  Activation.
</p>
<p>
  <strong>Coexistence des modes :</strong> Les deux modes peuvent être actifs
  simultanément pour un même Partenaire. Dans ce cas, les règles propres à
  chaque mode s'appliquent indépendamment, notamment les conditions financières
  (Annexe B).
</p>

<h2>Article 3 — Obligations du Partenaire</h2>
<h3>3.1 Dispositions communes aux deux modes</h3>
<ul>
  <li>Obtenir préalablement le consentement éclairé du Client pour réaliser
      le service proposé, notamment la déclaration fiscale.</li>
  <li>Fournir à Qlower l'ensemble des informations et documents nécessaires
      à l'exécution des Services dans les délais utiles.</li>
  <li>S'abstenir de tout argument trompeur dans la présentation des Services.</li>
  <li>Respecter l'ensemble des réglementations applicables à son activité.</li>
  <li>Ne pas dupliquer ni reproduire à son compte la Solution ou le
      savoir-faire de Qlower (Article 7).</li>
  <li>Le partenaire s'engage à informer ses clients via ses CGV.
      L'article « Clause CGV recommandé » (informative, non contractuelle)
      figure en Annexe E.</li>
</ul>
<h3>3.2 Dans le cadre de l'Affiliation</h3>
<p class="small">
  Le Partenaire utilise le matériel de communication Qlower fourni et oriente
  ses clients vers le parcours d'inscription Qlower via son lien d'apport
  d'affaires (UTM personnalisé).
</p>
<h3>3.3 Dans le cadre de la Marque Blanche</h3>
<p class="small">
  Le Partenaire est responsable de la relation commerciale avec son Client et
  fixe librement le prix de revente. Qlower agit en sous-traitant fiscal.
</p>

<h2>Article 4 — Obligations de Qlower</h2>
<h3>4.1 Dispositions communes aux deux modes</h3>
<ul>
  <li>Exécuter les Services avec soin, compétence et conformément aux règles
      professionnelles et déontologiques en vigueur.</li>
  <li>Fournir pour chaque dossier un livrable conforme aux attentes des
      services fiscaux et, le cas échéant, une note signalant les informations
      manquantes ou erronées.</li>
  <li>Informer le Partenaire de toute indisponibilité du système informatique
      dans les meilleurs délais.</li>
  <li>Qlower s'engage à maintenir une disponibilité (uptime) supérieure à 99 %
      sur une base mensuelle, hors maintenances planifiées notifiées avec un
      préavis de 48 heures.</li>
  <li>Maintenir une police d'assurance responsabilité civile professionnelle
      pendant toute la durée du Contrat et en fournir l'attestation à
      première demande.</li>
  <li>Garantir le Partenaire contre tout recours de tiers directement lié à
      l'exécution défectueuse des Services par Qlower, dans la limite des
      conditions de la RC Pro applicable.</li>
</ul>
<h3>4.2 Dans le cadre de l'Affiliation</h3>
<p class="small">
  Qlower assure la facturation directe du Client, le suivi du dossier
  fiscal et le versement de la commission au Partenaire (Annexe B).
</p>
<h3>4.3 Dans le cadre de la Marque Blanche</h3>
<p class="small">
  Qlower fournit les livrables fiscaux selon les conditions de l'Annexe B et
  sous l'identité visuelle du Partenaire.
</p>

<h2>Article 5 — Traitement des leads et données personnelles</h2>
<h3>5.1 Responsabilité du traitement</h3>
<p>
  Chaque Partenaire demeure responsable de traitement au sens de l'article 4
  du RGPD pour les données des leads qu'il génère et transmet à Qlower. Qlower
  agit en qualité de sous-traitant au sens de l'article 28 du RGPD pour le
  compte du Partenaire émetteur.
</p>
<p>
  Si un lead parvient à Qlower sans consentement valide ou sans les
  Métadonnées de lead requises, la responsabilité de cette irrégularité
  incombe exclusivement au Partenaire émetteur. Qlower ne peut être tenu
  responsable des conséquences d'un consentement défaillant collecté par
  le Partenaire.
</p>

<h3>5.2 Traçabilité à l'entrée — Prérequis technique obligatoire</h3>
<p>Chaque lead transmis à Qlower DOIT impérativement comporter les Métadonnées de lead suivantes :</p>
<ul>
  <li><strong>Champ source</strong> : identifiant unique du Partenaire émetteur.</li>
  <li><strong>Date de consentement</strong> : date précise (JJ/MM/AAAA) à laquelle
      le consentement de la personne concernée a été recueilli.</li>
  <li><strong>Modalité de consentement</strong> : description succincte
      (ex. : formulaire en ligne, signature manuscrite, opt-in email).</li>
</ul>
<p class="small">
  À défaut de l'une de ces métadonnées, Qlower refuse techniquement et
  automatiquement l'entrée du lead dans son système. Qlower ne saurait être
  tenu responsable des leads rejetés pour non-conformité. Un rapport d'erreur
  est transmis au Partenaire dans les 24 heures.
</p>

<h3>5.3 Cloisonnement et étanchéité des données</h3>
<ul>
  <li>Les données des Clients d'un Partenaire ne sont en aucun cas croisées,
      comparées ou partagées avec les données d'un autre Partenaire.</li>
  <li>Chaque Partenaire n'accède qu'à ses propres leads entrants, sans
      visibilité sur les données des autres Partenaires.</li>
  <li>Les accès sont cloisonnés par des mesures techniques et organisationnelles
      adaptées (contrôle d'accès, journalisation).</li>
</ul>
<p class="small">
  Toute violation de cette règle d'étanchéité constitue une faute grave
  ouvrant droit à résiliation immédiate si demandée par le Partenaire lésé.
</p>

<h3>5.4 Priorité d'apport</h3>
<p>
  En cas de transmission d'un même contact par plusieurs Partenaires, le
  premier Partenaire à soumettre un lead valide (Métadonnées complètes et
  consentement valide) est réputé <strong>Partenaire apporteur prioritaire</strong>
  pour ce contact. L'horodatage UTC enregistré par le système Qlower lors de
  la réception du lead fait foi pour la détermination de la priorité.
</p>

<h3>5.5 Clause d'audit des consentements</h3>
<p>
  Qlower se réserve le droit de demander à tout moment au Partenaire la
  preuve du consentement valide pour tout contact reçu. Le Partenaire s'engage
  à fournir cette preuve dans un délai de cinq (5) jours ouvrés à compter de
  la demande. L'absence de réponse ou la production d'une preuve insuffisante
  vaut reconnaissance de responsabilité du Partenaire et autorise Qlower à
  supprimer les données du contact concerné de ses systèmes.
</p>

<h3>5.6 Obligations communes RGPD</h3>
<ul>
  <li>Traiter les données à caractère personnel de manière licite, loyale et transparente.</li>
  <li>Collecter les données pour des finalités déterminées, explicites et légitimes.</li>
  <li>Respecter les droits des personnes concernées (accès, rectification, effacement, portabilité).</li>
  <li>Héberger et traiter les données exclusivement dans l'Espace économique Européen.</li>
  <li>Ne pas transférer de données hors EEE sans garanties appropriées (articles 45 à 50 du RGPD).</li>
</ul>
<p class="small">
  Compte tenu du caractère fiscal des traitements réalisés par Qlower, la
  conservation des données est obligatoire pendant une période de dix (10)
  ans à compter de la dernière déclaration fiscale produite. Un client, même
  résilié, verra donc ses données conservées sur cette période légale,
  nonobstant toute demande de suppression contraire à cette obligation légale.
</p>

<h2>Article 6 — Conditions financières</h2>
<p>
  Les conditions financières applicables dépendent du ou des modes actifs
  pour le Partenaire, conformément à l'Annexe B. En cas d'activation
  simultanée des deux modes, les régimes financiers s'appliquent
  indépendamment, sans compensation entre eux.
</p>

<h2>Article 7 — Propriété intellectuelle et non-duplicata</h2>
<p>
  La Solution Qlower (logiciel, algorithmes, méthodes, interfaces, bases de
  données et savoir-faire afférent) est et demeure la propriété exclusive de
  Qlower, protégée notamment par le droit d'auteur, le droit des bases de
  données, la loi n° 2018-670 du 30 juillet 2018 relative au secret des
  affaires et le Règlement communautaire n° 772/2004.
</p>
<p>
  Le Partenaire s'interdit expressément de reproduire, dupliquer, développer
  ou faire développer tout ou partie de la Solution, et ce <strong>pendant toute
  la durée du Contrat</strong>.
</p>
<p class="small">
  Toute violation expose le Partenaire défaillant au paiement d'une pénalité
  d'<strong>un million d'euros (1 000 000 €)</strong>, conformément à l'article
  1231-5 du Code civil, sans préjudice de la résiliation du Contrat et de
  tous dommages-intérêts.
</p>

<h2>Article 8 — Confidentialité</h2>
<p>
  Chaque Partie traite comme strictement confidentielles toutes les
  Informations Confidentielles reçues de l'autre Partie. Elle s'engage à :
</p>
<ul>
  <li>Ne pas les utiliser à d'autres fins que l'exécution du Contrat.</li>
  <li>Ne pas les divulguer à des tiers sans accord préalable écrit de la Partie divulgatrice.</li>
  <li>Appliquer des mesures de protection au moins équivalentes à celles
      appliquées à ses propres informations sensibles.</li>
</ul>
<p class="small">
  Cet engagement est valable pour une durée de cinq (5) ans après l'expiration
  ou la résiliation du Contrat. Les exceptions habituelles s'appliquent
  (domaine public, connaissance antérieure, tiers légitime, développement
  indépendant, décision d'autorité).
</p>

<h2>Article 8 bis — Communication sur le partenariat</h2>
<p class="small">
  Ces dispositions survivent à la résiliation ou à l'expiration du Contrat
  pour une durée de deux (2) ans.
</p>

<h2>Article 9 — Indépendance et absence de subordination</h2>
<p>
  Les Parties sont et demeurent des partenaires commerciaux et professionnels
  indépendants, assumant chacun les risques de leur propre exploitation. Aucun
  lien de subordination, de mandat ou de représentation mutuelle ne résulte du
  présent Contrat. Chaque Partie supervise son propre personnel et en conserve
  l'entière autorité hiérarchique.
</p>

<h2>Article 10 — Non-exclusivité</h2>
<p>
  Le présent Contrat n'emporte aucune exclusivité. Qlower est libre de
  proposer ses Services à d'autres partenaires. Le Partenaire est libre de
  recourir à d'autres prestataires, sous réserve des dispositions de
  l'Article 7.
</p>

<h2>Article 11 — Durée</h2>
<p>
  Le présent Contrat est conclu pour une durée déterminée de <strong>douze (12)
  mois</strong> à compter de la date de signature. Il se renouvelle tacitement
  par périodes successives d'un (1) an, sauf notification de non-renouvellement
  par l'une ou l'autre des Parties par courrier recommandé ou email avec
  accusé de réception, au moins soixante (60) jours avant la date d'échéance.
</p>
<p class="small">
  La désactivation d'un mode de partenariat en cours de Contrat ne constitue
  pas une résiliation du Contrat. Le Contrat demeure valide et l'autre mode
  (s'il est actif) continue de produire ses effets.
</p>

<h2>Article 12 — Résiliation</h2>
<h3>12.1 Résiliation pour manquement</h3>
<p class="small">
  En cas de violation d'une obligation contractuelle, la Partie non fautive
  peut, huit (8) jours après mise en demeure par lettre recommandée AR restée
  sans effet, résilier le Contrat de plein droit aux torts de la Partie
  défaillante, sans préjudice de tous dommages-intérêts.
</p>
<h3>12.2 Résiliation unilatérale</h3>
<p class="small">
  Chaque Partie peut résilier le Contrat à tout moment avec un préavis de
  trente (30) jours par lettre recommandée AR ou email avec accusé de
  réception.
</p>
<h3>12.3 Force majeure</h3>
<p class="small">
  En cas de force majeure (article 1218 du Code civil), les Parties se
  concertent dans les meilleurs délais. Si l'empêchement est définitif, le
  Contrat est résolu de plein droit. S'il est temporaire, l'exécution est
  suspendue dans la limite d'un an, au-delà duquel le Contrat est résolu de
  plein droit.
</p>

<h2>Article 13 — Responsabilité</h2>
<p>
  Dans tous les cas, la responsabilité totale de Qlower est limitée à la
  couverture de sa police d'assurance RC professionnelle en cours de validité.
  Le plafond de couverture est fixé à <strong>300 000 €</strong> (trois cent
  mille euros) par sinistre. Les dommages indirects (perte de profits, perte
  de clientèle, perte d'image) sont exclus de toute indemnisation.
</p>

<h2>Article 14 — Non-sollicitation de personnel</h2>
<p class="small">
  Les Parties s'engagent réciproquement, pendant la durée du Contrat et les
  douze (12) mois suivant son terme, à ne pas solliciter, embaucher ni faire
  travailler, directement ou indirectement, tout collaborateur de l'autre
  Partie, sauf accord exprès préalable. En cas de violation : indemnité
  forfaitaire de 15 000 € par infraction, sans préjudice de l'indemnisation
  du préjudice réel.
</p>

<h2>Article 15 — Dispositions diverses</h2>
<h3>15.1 Intégralité et hiérarchie</h3>
<p class="small">
  Le présent Contrat prévaut sur tout document antérieur (propositions,
  emails, conventions orales) ayant le même objet. Les Annexes en font partie
  intégrante. En cas de contradiction, le corps du Contrat prévaut sur les
  Annexes.
</p>
<h3>15.2 Modification</h3>
<p class="small">
  Toute modification structurelle du Contrat (ajout ou suppression de
  clauses, modification des Annexes) requiert un avenant écrit et signé par
  les deux Parties. L'Activation ou la désactivation d'un mode de partenariat
  ne constitue pas une modification au sens du présent article. La mise à
  jour annuelle de l'Annexe B (grille tarifaire Marque Blanche) par simple
  échange d'emails ne constitue pas non plus une modification au sens du
  présent article.
</p>
<h3>15.3 Non-renonciation</h3>
<p class="small">
  Le fait pour une Partie de ne pas se prévaloir d'un droit ne vaut pas
  renonciation à ce droit.
</p>
<h3>15.4 Divisibilité</h3>
<p class="small">
  Si une stipulation est déclarée nulle, les autres demeurent en vigueur.
  Les Parties s'engagent à négocier de bonne foi une clause de substitution.
</p>
<h3>15.5 Cession</h3>
<p class="small">
  Le Contrat ne peut être cédé sans accord préalable écrit de l'autre Partie,
  sauf cession à une filiale ou entité contrôlante (article L.233-3 C. com.)
  ou dans le cadre d'une restructuration, sous réserve d'information préalable.
</p>

<h2>Article 16 — Loi applicable, médiation et juridiction</h2>
<p>
  Le présent Contrat est régi par le <strong>droit français</strong>. En cas
  de litige, les Parties s'efforceront de trouver une solution amiable.
  À défaut, elles soumettront le différend à une médiation auprès du Médiateur
  des entreprises (Ministère de l'Économie, 98-102 rue de Richelieu, Paris
  75002), avant toute action judiciaire. À défaut d'accord, le
  <strong>Tribunal de commerce de Paris</strong> est seul compétent.
</p>

<h2>Article 17 — Signature électronique</h2>
<p class="small">
  Les Parties conviennent de signer le présent Contrat par voie électronique
  via un service reconnu (Yousign, Vialink ou équivalent), auquel elles
  reconnaissent la même valeur probante qu'une signature manuscrite,
  conformément aux articles 1366 et 1367 du Code civil.
</p>

<h2>Article 18 — Lutte contre la corruption et le trafic d'influence</h2>
<h3>18.1 Engagement général</h3>
<p class="small">
  Les Parties s'engagent à respecter, dans le cadre de l'exécution du présent
  Contrat, l'ensemble des lois et règlements en vigueur en matière de lutte
  contre la corruption et le trafic d'influence, notamment la loi n° 2016-1691
  du 9 décembre 2016 (loi « Sapin II »), ainsi que, le cas échéant, les
  législations étrangères équivalentes (UK Bribery Act 2010, US FCPA).
</p>
<h3>18.2 Engagements réciproques</h3>
<ul>
  <li>n'a pas été condamnée, et qu'à sa connaissance aucun de ses dirigeants,
      mandataires sociaux, salariés ou sous-traitants intervenant dans
      l'exécution du Contrat n'a été condamné, pour des faits de corruption,
      trafic d'influence, concussion, prise illégale d'intérêt, détournement
      de fonds, favoritisme ou recel de telles infractions ;</li>
  <li>ne fera, ni directement ni indirectement, aucune offre, promesse, don,
      présent, avantage, ou autre paiement injustifié à un agent public, un
      élu, un responsable politique, un dirigeant ou salarié d'une entreprise
      privée, ou à toute autre personne, en vue d'obtenir ou conserver un
      avantage indu ;</li>
  <li>tiendra des livres, registres et comptabilités exacts, complets et
      fidèles concernant toutes les opérations réalisées au titre du Contrat ;</li>
  <li>s'abstiendra de toute pratique susceptible de caractériser un fait de
      corruption ou de trafic d'influence, qu'elle soit active ou passive.</li>
</ul>
<h3>18.3 Cadeaux et invitations</h3>
<p class="small">
  Les Parties s'interdisent d'accepter ou d'offrir des cadeaux, invitations,
  voyages, hébergements ou tout autre avantage en nature, dont la valeur ou
  la fréquence pourrait raisonnablement être perçue comme susceptible
  d'influencer une décision commerciale. Tout avantage d'une valeur unitaire
  supérieure à <strong>cent cinquante euros (150 €)</strong> doit faire l'objet
  d'une déclaration écrite préalable à l'autre Partie.
</p>
<h3>18.4 Information et alerte</h3>
<p class="small">
  Chaque Partie s'engage à informer l'autre, sans délai et par écrit, de tout
  fait, soupçon ou allégation de corruption ou de trafic d'influence dont elle
  aurait connaissance et qui serait susceptible d'affecter, directement ou
  indirectement, l'exécution du présent Contrat.
</p>
<h3>18.5 Audit</h3>
<p class="small">
  Chaque Partie pourra, sous réserve d'un préavis raisonnable de quinze (15)
  jours et durant les heures ouvrables, procéder ou faire procéder, à ses
  frais, à un audit limité au respect des engagements souscrits au titre du
  présent article.
</p>
<h3>18.6 Sanction du manquement</h3>
<p class="small">
  Tout manquement avéré aux engagements souscrits au titre du présent article
  constitue une faute grave, ouvrant droit à la résiliation immédiate du
  Contrat aux torts exclusifs de la Partie défaillante, par lettre recommandée
  avec accusé de réception, sans préavis ni indemnité et sans préjudice des
  dommages-intérêts pouvant être réclamés. Par dérogation à l'Article 13,
  le plafond de responsabilité prévu au Contrat ne s'applique pas aux
  conséquences directes du manquement aux dispositions du présent article.
</p>

<div class="signature-block">
  <div class="box">
    <div class="label">Le Bénéficiaire</div>
    <div class="small">Date : ${e(d.generatedDate)}</div>
    <div class="small">158B avenue de Suffren, 75015 Paris</div>
    <br/><br/>
    <div>Nom : Christophe DUPRAT</div>
    <div class="small">Qualité : Président — ComptAppart SAS</div>
  </div>
  <div class="box">
    <div class="label">Le Partenaire</div>
    <div class="small">Date : _____________</div>
    <div class="small">${e(d.name)}</div>
    <br/><br/>
    <div>Nom : ${e(d.contactCivil)} ${e(d.contactForename)} ${e(d.contactName)}</div>
    <div class="small">Qualité : ${e(d.contactPosition)}</div>
  </div>
</div>

<!-- ====================== ANNEXES ====================== -->
<div class="page-break"></div>

<div class="annex-title">Annexe A — Description des services Qlower</div>

<h3>A.1 Fonctionnalités du Logiciel</h3>
<ul>
  <li>Recueil des informations relatives aux propriétés, flux monétaires,
      propriétaires, acquisition, financement et fiscalité des biens gérés
      par le Partenaire.</li>
  <li>Vérification automatique de la cohérence des données transmises.</li>
  <li>Traitement automatique des données fiscales et calcul du résultat au
      format attendu par les services fiscaux, pour tout régime fiscal
      immobilier (exclusion : Trust, Foncières, Fiducies, sociétés nécessitant
      validation par Commissaire aux Comptes).</li>
  <li>Télétransmission en option, avec obligation de moyen.</li>
</ul>

<h3>A.2 Prestations complémentaires</h3>
<ul>
  <li>Vérification de chaque liasse fiscale (algorithmique ou humaine selon option).</li>
  <li>Assistance en cas de contrôle par les services fiscaux.</li>
  <li>Déclarations d'activité : immatriculation INPI, modification
      d'immatriculation, création de SCI (IS et IR), déclaration de TVA,
      toutes autres formalités sur demande.</li>
</ul>

<h3>A.3 Livrables par type de location</h3>
<p class="small">
  Qlower fournit également un <strong>bilan rédigé</strong> : explication
  personnalisée de la liasse fiscale pour chaque Client du Partenaire.
</p>

<div class="page-break"></div>

<div class="annex-title">Annexe B — Conditions financières</div>

<h3>Affiliation — Barème des commissions</h3>
<p class="small">
  Paiement trimestriel (ou fréquence convenue). Facture réglée dans les 30 jours.
  Pénalités de retard : <em>taux BCE + 10 pts + 40 € forfaitaires</em>.
</p>

<h3>Marque Blanche — Tarification des prestations (coûts Qlower)</h3>
<p class="small">
  Les prix de revente au Client final sont fixés librement par le Partenaire
  et communiqués à Qlower par email. Le tableau ci-dessous indique uniquement
  le coût unitaire facturé par Qlower au Partenaire.
</p>
<p class="small">
  Tarification fixe pour un an à compter de la signature. Toute modification
  des coûts Qlower requiert une notification par email au Partenaire avec un
  préavis de trente (30) jours. Pénalités de retard : <em>taux BCE + 10 pts +
  40 € forfaitaires</em>.
</p>

<div class="page-break"></div>

<div class="annex-title">Annexe C — Accord de traitement des données (DPA — art. 28 RGPD)</div>

<p class="small">
  Conformément à l'article 28 du RGPD et à la loi n° 78-17 du 6 janvier 1978,
  la présente annexe régit les conditions dans lesquelles Qlower traite les
  données à caractère personnel pour le compte du Partenaire, en qualité de
  sous-traitant.
</p>

<h3>C.1 Rôles</h3>
<ul>
  <li><strong>Responsable du Traitement</strong> : Le Partenaire détermine les
      finalités et les moyens du traitement des données de ses Clients.</li>
  <li><strong>Sous-traitant</strong> : Qlower traite les données sur
      instructions documentées du Partenaire.</li>
</ul>

<h3>C.2 Description du traitement</h3>
<ul>
  <li><strong>Finalité</strong> : Production fiscale immobilière, fournitures
      des Livrables, exécution des Prestations.</li>
  <li><strong>Nature des données</strong> : Données d'identification, fiscales,
      transactionnelles et financières.</li>
  <li><strong>Personnes concernées</strong> : Clients du Partenaire
      (propriétaires bailleurs).</li>
  <li><strong>Durée de conservation</strong> : Durée du Contrat + 10 ans
      (délai imposé par les traitements fiscaux, y compris pour les clients
      résiliés).</li>
  <li><strong>Localisation</strong> : Exclusivement dans l'Espace économique
      Européen.</li>
</ul>

<h3>C.3 Obligations de Qlower en qualité de sous-traitant</h3>
<ul>
  <li>Traiter les données uniquement sur instructions documentées du Partenaire.</li>
  <li>Garantir la confidentialité des données (personnel habilité, engagement
      de confidentialité).</li>
  <li>Mettre en œuvre les mesures techniques et organisationnelles appropriées
      (sécurité, accès, chiffrement).</li>
  <li>Ne pas recourir à un sous-traitant ultérieur sans accord écrit préalable
      du Partenaire.</li>
  <li>Notifier le Partenaire de toute violation de données dans les 72 heures,
      puis rapport détaillé dans les 5 jours ouvrés.</li>
  <li>Assister le Partenaire dans l'exercice des droits des personnes
      concernées dans les 3 jours ouvrés.</li>
  <li>Restituer ou supprimer toutes les données à la demande écrite du
      Partenaire ou à la fin du Contrat, sous réserve des obligations légales
      de conservation de 10 ans.</li>
  <li>Tenir un registre des activités de traitement et permettre les audits
      du Partenaire.</li>
</ul>

<h3>C.4 Cloisonnement et étanchéité (rappel art. 5.3)</h3>
<p class="small">
  Qlower maintient une séparation technique stricte entre les données de
  chaque Partenaire. Aucune donnée d'un Partenaire n'est accessible ou
  partagée avec un autre Partenaire, sous quelque forme que ce soit.
</p>

<h3>C.5 Audit des consentements (rappel art. 5.5)</h3>
<p class="small">
  Qlower peut demander à tout moment la preuve de consentement RGPD pour tout
  lead reçu. Le Partenaire dispose de cinq (5) jours ouvrés pour produire
  cette preuve.
</p>

<div class="page-break"></div>

<div class="annex-title">Annexe D — Charte de traitement des leads</div>

<p class="small">
  La présente charte précise les règles opérationnelles de transmission et de
  traitement des leads entre le Partenaire et Qlower.
</p>

<h3>D.1 Format de transmission obligatoire</h3>
<p class="small">
  Chaque lead doit comporter au minimum : identité (nom, prénom, email),
  champ <em>source</em> (UTM unique du Partenaire), date et modalité de
  consentement (cf. art. 5.2).
</p>

<h3>D.2 Refus automatique</h3>
<p class="small">
  Tout lead ne comportant pas les cinq champs OBLIGATOIRES est automatiquement
  rejeté. Un rapport d'erreur est transmis au Partenaire dans les 24 heures.
</p>

<h3>D.3 Horodatage de priorité</h3>
<p class="small">
  L'horodatage UTC enregistré par le système Qlower lors de la réception fait
  foi pour l'application du principe de Priorité d'apport (Article 5.4).
</p>

<h3>D.4 Durée de protection du lead</h3>
<p class="small">
  Un lead valide attribué à un Partenaire est protégé pendant douze (12) mois.
  Passé ce délai sans souscription, le contact redevient disponible.
</p>

<h3>D.5 Rapport mensuel</h3>
<p class="small">
  Qlower fournit au Partenaire un rapport mensuel des leads reçus, leur statut
  (accepté / rejeté / converti) et les motifs de rejet éventuels, via
  interface partenaire ou fichier CSV.
</p>

<div class="page-break"></div>

<div class="annex-title">Annexe E — Clause CGV recommandée (Marque Blanche)</div>

<p class="small"><em>À titre de modèle, à insérer dans les CGV Partenaire :</em></p>

<div class="party-block">
  <p class="small">
    « Le Client est informé et accepte expressément que le Partenaire puisse
    avoir recours à une société tierce spécialisée en fiscalité immobilière,
    pour la réalisation de ses déclarations fiscales et/ou de ses formalités
    d'immatriculation.
  </p>
  <p class="small">
    À cet effet, le Client autorise expressément le Partenaire à transmettre
    à ladite société tierce l'ensemble des données strictement nécessaires à
    l'exécution de cette mission, à savoir notamment :
  </p>
  <ul>
    <li>les données d'identification (nom, prénom, date et lieu de naissance, adresse) ;</li>
    <li>les coordonnées de contact (téléphone, e-mail) ;</li>
    <li>les données transactionnelles et documents utiles aux opérations concernées ;</li>
    <li>les données fiscales et patrimoniales (numéro d'immatriculation,
        revenus locatifs, informations relatives aux biens immobiliers détenus,
        baux, charges, etc.).</li>
  </ul>
  <p class="small">
    La société tierce agit en qualité de sous-traitant au sens de l'article 28
    du Règlement (UE) 2016/679 (RGPD). Le traitement de ces données est
    strictement limité à la finalité fiscale et comptable décrite ci-dessus
    et s'effectue dans le respect de la réglementation applicable en matière
    de protection des données à caractère personnel.
  </p>
  <p class="small">
    Le Client conserve à tout moment ses droits d'accès, de rectification,
    d'effacement, de limitation, d'opposition et de portabilité de ses
    données, qu'il peut exercer auprès de nos services qui relaiera auprès
    de la société tierce en charge des traitements comptables et fiscaux. »
  </p>
</div>

<p class="center small" style="margin-top:10mm;color:#888;">
  Fait en deux exemplaires électroniques, chacun valant original.
</p>

</div>
</body>
</html>`;
}
