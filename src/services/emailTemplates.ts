export interface PartnerEmailData {
  nom: string;
  email: string;
  utm: string;
  code: string;
  leads: number;
  abonnes: number;
}

export type TemplateKey = "presentation" | "relance" | "performance" | "nouveaute";

export function getEmailContent(key: TemplateKey, p: PartnerEmailData): { subject: string; body: string } {
  const link = `https://secure.qlower.com/signup?utm_source=${p.utm}&utm_medium=affiliation&utm_campaign=${p.code}`;

  switch (key) {
    case "presentation":
      return {
        subject: `${p.nom}, découvrez votre espace partenaire Qlower !`,
        body: `Bonjour ${p.nom},\n\nBienvenue dans le programme partenaire Qlower !\n\nNous sommes ravis de vous accueillir dans notre réseau de professionnels qui accompagnent leurs clients investisseurs LMNP vers une gestion fiscale simplifiée et optimisée.\n\nEn tant que partenaire Qlower, vous bénéficiez de :\n- 100 € de commission par client abonné chaque année\n- Un tableau de bord dédié pour suivre vos leads en temps réel\n- Des supports de communication personnalisés\n- Un interlocuteur dédié pour vous accompagner\n\nVotre lien d'inscription personnalisé :\n👉 ${link}\n\nVotre code partenaire : ${p.code}\n\nPour toute question, répondez simplement à cet email.\n\nÀ très vite,\nL'équipe Qlower`,
      };
    case "relance":
      return {
        subject: `${p.nom}, activez votre partenariat Qlower`,
        body: `Bonjour ${p.nom},\n\nNous avons remarqué que votre lien partenaire n'a pas encore été utilisé.\n\nC'est tout à fait normal au démarrage — voici quelques idées pour commencer :\n\n• Partagez votre lien avec vos clients propriétaires bailleurs lors de vos prochains rendez-vous\n• Mentionnez Qlower dans votre prochaine newsletter ou communication client\n• Utilisez les supports du kit partenaire disponibles dans votre espace\n\nVotre lien personnalisé :\n👉 ${link}\n\nBesoin d'un coup de pouce ? Répondez à cet email, nous sommes là pour vous aider à démarrer.\n\nÀ bientôt,\nL'équipe Qlower`,
      };
    case "performance":
      return {
        subject: `Bilan partenaire Qlower — ${p.nom}`,
        body: `Bonjour ${p.nom},\n\nVoici votre bilan de performance Qlower :\n\n📊 Résumé\n- Leads générés : ${p.leads}\n- Abonnés convertis : ${p.abonnes}\n- Taux de conversion : ${p.leads > 0 ? ((p.abonnes / p.leads) * 100).toFixed(1) : "0"}%\n- Commission estimée : ${p.abonnes * 100} € / an\n\n${p.leads > 0 ? "Bravo pour votre implication ! Continuez sur cette lancée." : "Vous n'avez pas encore généré de leads ce mois-ci. N'hésitez pas à partager votre lien avec vos contacts."}\n\nRappel de votre lien partenaire :\n👉 ${link}\n\nÀ très vite,\nL'équipe Qlower`,
      };
    case "nouveaute":
      return {
        subject: `Nouveauté Qlower — Programme partenaire`,
        body: `Bonjour ${p.nom},\n\nNous avons le plaisir de vous annoncer une nouveauté dans notre programme partenaire.\n\n[À compléter avant envoi : décrivez ici la nouveauté ou la mise à jour à communiquer]\n\nVotre lien reste inchangé :\n👉 ${link}\n\nÀ très vite,\nL'équipe Qlower`,
      };
  }
}
