export default function KitPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500&display=swap');
        .kit-wrap { --color-border-tertiary: #e5e7eb; --color-border-secondary: #d1d5db; --color-text-primary: #111827; --color-text-secondary: #6b7280; --color-text-tertiary: #9ca3af; --color-text-info: #185FA5; --color-background-primary: #ffffff; --color-background-secondary: #f9fafb; --color-background-info: #E6F1FB; --border-radius-lg: 12px; --border-radius-md: 8px; font-family: 'DM Sans', sans-serif; }
        .kit { max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem; }
        .hero { border: 0.5px solid var(--color-border-tertiary); border-radius: var(--border-radius-lg); padding: 2rem 2.5rem; margin-bottom: 2rem; position: relative; overflow: hidden; }
        .hero-label { font-size: 11px; font-weight: 500; letter-spacing: 0.12em; color: var(--color-text-tertiary); text-transform: uppercase; margin-bottom: 0.75rem; }
        .hero h1 { font-family: 'DM Serif Display', serif; font-size: 28px; font-weight: 400; color: var(--color-text-primary); line-height: 1.2; margin-bottom: 0.5rem; }
        .hero-sub { font-size: 14px; color: var(--color-text-secondary); line-height: 1.6; max-width: 480px; }
        .badge { display: inline-block; font-size: 11px; font-weight: 500; padding: 3px 10px; border-radius: 20px; background: var(--color-background-info); color: var(--color-text-info); margin-right: 6px; margin-top: 1rem; }
        .accent-bar { position: absolute; top: 0; right: 0; width: 6px; height: 100%; background: #0F6E56; }
        .section-title { font-size: 11px; font-weight: 500; letter-spacing: 0.12em; color: var(--color-text-tertiary); text-transform: uppercase; margin: 2rem 0 0.75rem; }
        .kit-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 1rem; }
        .card { background: var(--color-background-primary); border: 0.5px solid var(--color-border-tertiary); border-radius: var(--border-radius-lg); padding: 1rem 1.25rem; cursor: pointer; transition: border-color 0.15s; }
        .card:hover { border-color: var(--color-border-secondary); }
        .card-icon { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 0.75rem; font-size: 14px; }
        .card-icon.green { background: #E1F5EE; color: #0F6E56; }
        .card-icon.blue { background: #E6F1FB; color: #185FA5; }
        .card-icon.amber { background: #FAEEDA; color: #854F0B; }
        .card-icon.teal { background: #E1F5EE; color: #085041; }
        .card-icon.coral { background: #FAECE7; color: #993C1D; }
        .card-icon.purple { background: #EEEDFE; color: #534AB7; }
        .card h3 { font-size: 13px; font-weight: 500; color: var(--color-text-primary); margin-bottom: 4px; line-height: 1.3; }
        .card p { font-size: 12px; color: var(--color-text-secondary); line-height: 1.5; }
        .card a { font-size: 12px; color: var(--color-text-info); text-decoration: none; display: block; margin-top: 8px; }
        .card a:hover { text-decoration: underline; }
        .card a + a { margin-top: 4px; }
        .info-row { display: flex; align-items: flex-start; gap: 12px; padding: 1rem 1.25rem; background: var(--color-background-secondary); border-radius: var(--border-radius-md); margin-bottom: 10px; font-size: 13px; }
        .info-row .dot { width: 8px; height: 8px; border-radius: 50%; background: #1D9E75; margin-top: 4px; flex-shrink: 0; }
        .info-row strong { color: var(--color-text-primary); font-weight: 500; }
        .info-row span { color: var(--color-text-secondary); line-height: 1.5; }
        .commission-box { border: 0.5px solid var(--color-border-tertiary); border-radius: var(--border-radius-lg); padding: 1.5rem; display: flex; align-items: center; gap: 2rem; flex-wrap: wrap; margin-bottom: 1rem; }
        .stat { text-align: center; }
        .stat .num { font-family: 'DM Serif Display', serif; font-size: 32px; color: #0F6E56; }
        .stat .lbl { font-size: 12px; color: var(--color-text-secondary); margin-top: 2px; }
        .divider { width: 1px; height: 48px; background: var(--color-border-tertiary); }
        .contact-card { background: var(--color-background-primary); border: 0.5px solid var(--color-border-tertiary); border-radius: var(--border-radius-lg); padding: 1rem 1.25rem; display: flex; align-items: center; gap: 12px; }
        .avatar { width: 40px; height: 40px; border-radius: 50%; background: #E1F5EE; display: flex; align-items: center; justify-content: center; font-weight: 500; font-size: 14px; color: #0F6E56; flex-shrink: 0; }
        .contact-card .name { font-size: 14px; font-weight: 500; color: var(--color-text-primary); }
        .contact-card .role { font-size: 12px; color: var(--color-text-secondary); margin-top: 1px; }
        .contact-card .email { font-size: 12px; color: var(--color-text-info); margin-top: 4px; }
      `}</style>

      <div className="kit-wrap">
        <div className="kit">
          <div className="hero">
            <div className="accent-bar"></div>
            <div className="hero-label">Qlower — Programme partenaire</div>
            <h1>Kit apporteur d&apos;affaires</h1>
            <p className="hero-sub">Tous les outils pour présenter Qlower à vos clients investisseurs immobiliers et générer une commission récurrente.</p>
            <span className="badge">Affiliation</span>
            <span className="badge">LMNP · SCI · Foncier</span>
          </div>

          <div className="section-title">Modèle de commission</div>
          <div className="commission-box">
            <div className="stat"><div className="num">−20€</div><div className="lbl">remise client via code promo</div></div>
            <div className="divider"></div>
            <div className="stat"><div className="num">+100€</div><div className="lbl">commission annuelle / client</div></div>
            <div className="divider"></div>
            <div className="stat"><div className="num">269€</div><div className="lbl">prix public (1 bien)</div></div>
          </div>

          <div className="info-row">
            <div className="dot"></div>
            <div><strong>+130€ pour chaque bien supplémentaire dans la même liasse fiscale</strong> <span>— ex : 2 biens LMNP = 399€ / 1 bien LMNP + 1 SCI = 269€ × 2 (liasses séparées)</span></div>
          </div>
          <div className="info-row">
            <div className="dot"></div>
            <div><strong>Zéro intégration technique</strong> <span>— contrat apporteur d&apos;affaires + code promo dédié</span></div>
          </div>

          <div className="section-title">Présentation &amp; découverte</div>
          <div className="kit-grid">
            <div className="card">
              <div className="card-icon green">▶</div>
              <h3>Démo produit</h3>
              <p>Interface Qlower en vidéo — à montrer en RDV ou à transmettre</p>
              <a href="https://youtu.be/Z6mlC-RP_ss" target="_blank" rel="noreferrer">Voir la vidéo générale →</a>
            </div>
            <div className="card">
              <div className="card-icon blue">⬡</div>
              <h3>Expliquer Qlower</h3>
              <p>Guide pas à pas pour présenter l&apos;offre à un client</p>
              <a href="https://www.notion.so/qlower/Expliquer-Qlower-ses-clients-comment-y-souscrire-6b4eee4ecb4e48dc8cf64b026681a9d5" target="_blank" rel="noreferrer">Accéder au guide →</a>
            </div>
            <div className="card">
              <div className="card-icon amber">◈</div>
              <h3>Plaquette B2C</h3>
              <p>Document à envoyer directement à vos clients</p>
              <a href="https://drive.google.com/file/d/17xTVPzA8_WzgSaHMlPf5Y37imgtHBJCW/view" target="_blank" rel="noreferrer">Télécharger la plaquette →</a>
            </div>
          </div>

          <div className="section-title">Templates de communication</div>
          <div className="kit-grid">
            <div className="card">
              <div className="card-icon teal">✉</div>
              <h3>Emails clients</h3>
              <p>Séquence complète prête à envoyer tout au long de l&apos;année</p>
              <a href="https://www.notion.so/qlower/Templates-mails-Apporteurs-d-affaires-0a113a3302c84e18af17c4afffca1ab9" target="_blank" rel="noreferrer">Voir les templates →</a>
            </div>
            <div className="card">
              <div className="card-icon green">⊕</div>
              <h3>Souscription avec code promo</h3>
              <p>Guide visuel pour accompagner un client lors de la souscription</p>
              <a href="https://drive.google.com/file/d/1jQNSS9ftqD_td99F7IxacmiCOISUqaWf/view" target="_blank" rel="noreferrer">Voir le guide →</a>
            </div>
            <div className="card">
              <div className="card-icon purple">◎</div>
              <h3>Newsletter &amp; cross-content</h3>
              <p>Calendrier éditorial + processus d&apos;échange d&apos;articles</p>
              <a href="https://drive.google.com/file/d/1ZEGfpLchF6LZLwC-BarAufOALK7400Gr/view" target="_blank" rel="noreferrer">Calendrier éditorial →</a>
              <a href="https://qlower.notion.site/Processus-d-change-d-articles-et-de-contenu-pour-notre-partenariat-2640e15e2f3844f385b5fe98f35c0dd1" target="_blank" rel="noreferrer">Processus co-contenu →</a>
            </div>
          </div>

          <div className="section-title">Guides fiscaux à transmettre</div>
          <div className="kit-grid">
            <div className="card">
              <div className="card-icon green">◈</div>
              <h3>Guide LMNP / Location meublée</h3>
              <p>Version apporteur d&apos;affaires — arguments + explications régimes</p>
              <a href="https://drive.google.com/file/d/1DpzSZejenc1LxcIcMyqHs2b-yFx8Fi5g/view" target="_blank" rel="noreferrer">Télécharger →</a>
            </div>
            <div className="card">
              <div className="card-icon coral">◈</div>
              <h3>Guide SCI</h3>
              <p>Comptabilité et fiscalité de la SCI — guide complet + vidéo</p>
              <a href="https://drive.google.com/file/d/1ipSwn5sOopR75rf6cP90Ne-dVam0A2A8/view" target="_blank" rel="noreferrer">Télécharger le guide →</a>
              <a href="https://youtu.be/fISjBIFg3Ro" target="_blank" rel="noreferrer">Voir la vidéo →</a>
            </div>
            <div className="card">
              <div className="card-icon amber">◉</div>
              <h3>Calendrier fiscal</h3>
              <p>Échéances clés à transmettre à vos clients chaque année</p>
              <a href="https://drive.google.com/file/d/185wn2HvpXxOENNtccFAcCbwkxDz0WEc_/view" target="_blank" rel="noreferrer">Télécharger →</a>
            </div>
          </div>

          <div className="section-title">Exemples de livrables Qlower</div>
          <div className="kit-grid">
            <div className="card">
              <div className="card-icon blue">⬡</div>
              <h3>Pré-bilan Qlower</h3>
              <p>Document envoyé au client avant télétransmission</p>
              <a href="https://drive.google.com/open?id=1FTc1q04CpFWzW6rN1CAa0lUV3oHAufEs" target="_blank" rel="noreferrer">Voir l&apos;exemple →</a>
            </div>
            <div className="card">
              <div className="card-icon teal">⬡</div>
              <h3>Mail de synthèse post-déclaration</h3>
              <p>Exemple du mail personnalisé envoyé après télétransmission</p>
              <a href="https://drive.google.com/open?id=1__tKgbJl-po-vmBFGHDWlTofBBQ2-7hY" target="_blank" rel="noreferrer">Voir l&apos;exemple →</a>
            </div>
            <div className="card">
              <div className="card-icon coral">⬡</div>
              <h3>Liasse fiscale 2033</h3>
              <p>Formulaire LMNP produit automatiquement par Qlower</p>
              <a href="https://www.impots.gouv.fr/formulaire/2033-sd/liasse-bicsi-regime-rsi-tableaux-ndeg-2033-sd-2033-g-sd" target="_blank" rel="noreferrer">Voir le formulaire →</a>
            </div>
          </div>

          <div className="section-title">Prendre rendez-vous</div>
          <div className="kit-grid">
            <div className="card">
              <div className="card-icon green">◷</div>
              <h3>RDV découverte Qlower</h3>
              <p>Question produit, démonstration, accompagnement</p>
              <a href="https://meetings-eu1.hubspot.com/qlower/accompagnement-declaration-fiscale-decouverte-qlower" target="_blank" rel="noreferrer">Réserver →</a>
            </div>
            <div className="card">
              <div className="card-icon purple">◷</div>
              <h3>Webinaire interne</h3>
              <p>Former vos équipes commerciales sur la fiscalité locative</p>
              <a href="https://meetings-eu1.hubspot.com/qlower/accompagnement-declaration-fiscale-avec-alexandre" target="_blank" rel="noreferrer">Organiser un webinaire →</a>
            </div>
            <div className="card">
              <div className="card-icon amber">◷</div>
              <h3>Appel expert Marque Qlower</h3>
              <p>Conseil expert — 200€ / 30 min</p>
              <a href="https://meetings-eu1.hubspot.com/anatole-delord" target="_blank" rel="noreferrer">Réserver →</a>
            </div>
          </div>

          <div className="section-title">Interlocutrice partenaire</div>
          <div className="contact-card">
            <div className="avatar">CS</div>
            <div>
              <div className="name">Coline Sinquin</div>
              <div className="role">Responsable partenariats — Qlower</div>
              <div className="email">coline@qlower.com</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
