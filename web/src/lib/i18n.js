// Tiny i18n for the site. English (default, at /) and French (at /fr/).
// Strings that contain inline markup are rendered with set:html in the components.
export const LOCALES = ["en", "fr"];

// Prefix a path for a locale: localePath("fr", "/browse") -> "/fr/browse".
export function localePath(lang, path) {
  if (lang !== "fr") return path;
  return path === "/" ? "/fr" : "/fr" + path;
}

function interpolate(str, vars) {
  return vars ? str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : "")) : str;
}

export function useT(lang) {
  const l = dict[lang] ? lang : "en";
  return (key, vars) => interpolate(dict[l][key] ?? dict.en[key] ?? key, vars);
}

const dict = {
  en: {
    // chrome
    nav_bestxi: "Best XI",
    nav_browse: "Browse & rank",
    nav_about: "How it works",
    howitworks: "How it works →",
    footer:
      "Atlas XI — players eligible for Morocco who haven't been called up yet, ranked by a minutes-weighted, league-adjusted fair rating. Data: Transfermarkt (eligibility) · SofaScore (stats).",
    meta_desc:
      "Players eligible for the Morocco national team who haven't committed to a country yet, ranked by a fair, league-adjusted rating.",
    // status badges
    status_eligible: "eligible",
    status_review: "review",
    status_excluded: "excluded",
    // home
    home_h1: "The Atlas XI",
    home_lede:
      "The best footballers who are <strong>eligible for Morocco and still free to choose it</strong> — players the national team could still call up, because they haven't committed to a country yet — auto-picked into a 4-3-3 by a fair, league-adjusted rating.",
    stat_eligible: "eligible players",
    stat_rated: "rated this season",
    stat_leagues: "leagues tracked",
    home_note:
      "{filled}/11 slots filled · min {min} league minutes to qualify · tap a player for the breakdown.",
    score_word: "Score",
    home_note_tail: "— not the raw match rating.",
    score_tip:
      "A fair rating: each match rating weighted by minutes, pulled toward a baseline for small samples, then multiplied by league strength. See How it works.",
    home_empty: "No rated eligible players yet. Populate the database, then rebuild.",
    // browse
    browse_h1: "Browse & rank",
    browse_lede:
      "Every eligible player, ranked by fair score. Filter by league and position. ({eligible} eligible, {review} in review.)",
    f_league: "League",
    f_position: "Position",
    all_leagues: "All leagues",
    all_positions: "All positions",
    players_word: "players",
    col_player: "Player",
    col_pos: "Pos",
    col_league: "League",
    col_club: "Club",
    col_score: "Score",
    col_rating: "Rating",
    col_mins: "Mins",
    col_apps: "Apps",
    col_value: "Value",
    col_status: "Status",
    tip_score:
      "Our fair rating: match ratings weighted by minutes, pulled toward a baseline for small samples, then multiplied by league strength. This is what we rank by.",
    tip_rating:
      "Raw average match rating, for reference. Score is this made comparable across leagues.",
    tip_status:
      "eligible = 0 senior caps, free to recruit. review = has senior caps for another country but may still be switchable.",
    browse_empty: "No rated players yet. Run the ETL to populate, then rebuild.",
    // about
    about_h1: "How Atlas XI works",
    about_lede:
      "Atlas XI scouts footballers who could still choose to play for <strong>Morocco</strong> — and ranks them with a rating built to be fair across leagues. Here's what that means.",
    about_s1_h: "Who's on this list",
    about_s1_p:
      "Every player here is <strong>eligible for Morocco but not yet tied to its senior team</strong>. A player with two nationalities can freely choose a country — until he plays one competitive match for a senior national team, which locks him to it for good (that appearance is called a <em>cap</em>).",
    about_eligible:
      "Moroccan by nationality or descent, with <strong>0 senior caps</strong> — free to be recruited. Youth caps (U-17 → U-23) don't count, so a player who's featured for a Morocco or another country's youth team is still here.",
    about_review:
      "Moroccan-eligible but has already played a senior match for <strong>another country</strong>. Often still switchable (friendlies don't tie a player), so we flag rather than hide them — worth a manual check.",
    about_excluded:
      "Not shown: already a Morocco senior international (job done), or committed elsewhere.",
    about_s2_h: "The fair score",
    about_s2_p:
      "A raw match rating (like SofaScore's) has two blind spots: it ignores <strong>how long</strong> a player was on the pitch and <strong>how strong</strong> his league is. A striker who scores in a 10-minute cameo can post an 8.0; a defender who's solid for 90 minutes gets a 7.0. The cameo isn't better. Our score fixes that in three steps:",
    about_step1:
      "<b>Weight by minutes.</b> A rating over 90 minutes counts far more than one over 10.",
    about_step2:
      "<b>Trust the sample.</b> With few minutes played, the score is pulled toward an average baseline — you have to earn the minutes before a big number sticks. This is what stops the cameo from topping the list.",
    about_step3:
      "<b>Adjust for league strength.</b> The result is multiplied by a league coefficient, so a 7.0 in the Premier League outranks a 7.0 in a weaker division.",
    about_example:
      "<b>Worked example.</b> An 8.0 across 50 minutes all season scores <b>6.82</b>; a 7.0 across 2700 minutes scores <b>6.95</b>. The steady starter correctly comes out on top.",
    about_fine:
      "Only <strong>league matches</strong> count (cups and internationals are excluded). A player needs <strong>450+ league minutes</strong> to make the Best XI. Scores sit lower than raw ratings because of the league multiplier and the pull toward baseline — that's expected, and it's what makes them comparable.",
    about_s3_h: "League strength",
    about_s3_p:
      "Hand-set starting coefficients (1.00 = strongest). Every match is weighted by its league:",
    about_s4_h: "Glossary",
    gloss_score_t: "Score",
    gloss_score_d:
      "Our fair rating: minutes-weighted, sample-adjusted, league-weighted. The number we rank by.",
    gloss_rating_t: "Rating",
    gloss_rating_d:
      "The raw average match rating, for reference. Score is Rating made comparable across leagues.",
    gloss_mins_t: "Mins / Apps",
    gloss_mins_d:
      "League minutes played and appearances this season — how large the sample behind the score is.",
    gloss_pos_t: "Positions",
    gloss_pos_d:
      "GK goalkeeper · CB centre-back · FB full-back · DM/CM/AM midfield · W winger · ST striker.",
    about_src:
      "Covering {eligible} eligible players across {leagues} divisions. Data: Transfermarkt (eligibility) · SofaScore (match ratings & minutes). Season 2025/26.",
    // player detail
    back: "← Back to rankings",
    fair_score: "fair score",
    elig_h: "Eligibility",
    elig_eligible:
      "Has never played a senior match for any country, so he's free to be called up by Morocco. (Youth-team games don't count.)",
    elig_review:
      "Has {n} senior appearance{s} for another country. If those were friendlies — which don't lock a player to a country — he could still switch to Morocco, so worth a manual check.",
    build_h: "How the score is built",
    build_tip:
      "Minutes-weighted average rating, pulled toward a baseline for small samples, then multiplied by league strength.",
    step_avg: "avg rating (minutes-weighted)",
    step_adjusted: "adjusted for sample ({min} min)",
    step_league: "league strength",
    based_on: "Based on {n} league {matches} ({min} minutes) this season.",
    matches_one: "match",
    matches_many: "matches",
    matchlog_h: "Match log",
    c_date: "Date",
    c_comp: "Competition",
    c_rating: "Rating",
    c_min: "Min",
    c_g: "G",
    c_a: "A",
    excluded_tag: "excluded",
    cup_note: "Cup / non-league matches are shown but don't count toward the score.",
    born: "born",
    value: "value",
    not_found: "Player not found.",
    // form chart
    form_h: "Season form",
    form_note_thin: "Not enough matches yet to show a trend.",
    form_baseline: "baseline",
    form_avg: "season avg",
    form_minutes: "dot size = minutes",
    last5_h: "Recent form",
    career_h: "Career trajectory",
    career_note: "Fair score per season (SofaScore average rating, league-adjusted).",
    apps_short: "apps",
  },

  fr: {
    nav_bestxi: "Meilleur XI",
    nav_browse: "Explorer & classer",
    nav_about: "Comment ça marche",
    howitworks: "Comment ça marche →",
    footer:
      "Atlas XI — joueurs éligibles pour le Maroc, pas encore sélectionnés, classés par une note équitable pondérée par les minutes et ajustée à la force du championnat. Données : Transfermarkt (éligibilité) · SofaScore (stats).",
    meta_desc:
      "Joueurs éligibles pour l'équipe nationale du Maroc qui ne se sont engagés avec aucun pays, classés par une note équitable ajustée au championnat.",
    status_eligible: "éligible",
    status_review: "à vérifier",
    status_excluded: "exclu",
    home_h1: "Le Onze de l'Atlas",
    home_lede:
      "Les meilleurs footballeurs <strong>éligibles pour le Maroc et encore libres de le choisir</strong> — des joueurs que la sélection pourrait encore appeler, car ils ne se sont engagés avec aucun pays — assemblés en 4-3-3 par une note équitable ajustée au championnat.",
    stat_eligible: "joueurs éligibles",
    stat_rated: "notés cette saison",
    stat_leagues: "championnats suivis",
    home_note:
      "{filled}/11 postes remplis · min. {min} minutes de championnat pour se qualifier · touchez un joueur pour le détail.",
    score_word: "Note",
    home_note_tail: "— pas la note de match brute.",
    score_tip:
      "Une note équitable : chaque note de match est pondérée par les minutes, ramenée vers une base pour les petits échantillons, puis multipliée par la force du championnat. Voir Comment ça marche.",
    home_empty:
      "Aucun joueur noté pour l'instant. Remplissez la base de données, puis reconstruisez.",
    browse_h1: "Explorer & classer",
    browse_lede:
      "Tous les joueurs éligibles, classés par note équitable. Filtrez par championnat et par poste. ({eligible} éligibles, {review} à vérifier.)",
    f_league: "Championnat",
    f_position: "Poste",
    all_leagues: "Tous les championnats",
    all_positions: "Tous les postes",
    players_word: "joueurs",
    col_player: "Joueur",
    col_pos: "Poste",
    col_league: "Champ.",
    col_club: "Club",
    col_score: "Note",
    col_rating: "Note brute",
    col_mins: "Min",
    col_apps: "Matchs",
    col_value: "Valeur",
    col_status: "Statut",
    tip_score:
      "Notre note équitable : notes de match pondérées par les minutes, ramenées vers une base pour les petits échantillons, puis multipliées par la force du championnat. C'est le critère de classement.",
    tip_rating:
      "Note de match moyenne brute, pour référence. La Note rend cette valeur comparable entre championnats.",
    tip_status:
      "éligible = 0 sélection A, recrutable. à vérifier = a des sélections A avec un autre pays mais reste peut-être changeable.",
    browse_empty: "Aucun joueur noté. Lancez l'ETL pour remplir, puis reconstruisez.",
    about_h1: "Comment fonctionne Atlas XI",
    about_lede:
      "Atlas XI repère les footballeurs qui pourraient encore choisir de jouer pour le <strong>Maroc</strong> — et les classe avec une note conçue pour être équitable entre championnats. Voici ce que cela signifie.",
    about_s1_h: "Qui figure dans cette liste",
    about_s1_p:
      "Chaque joueur ici est <strong>éligible pour le Maroc mais pas encore lié à sa sélection A</strong>. Un joueur binational peut librement choisir un pays — jusqu'à ce qu'il dispute un match officiel avec une sélection A, ce qui le lie définitivement (cette apparition s'appelle une <em>sélection</em>).",
    about_eligible:
      "Marocain par nationalité ou par ascendance, avec <strong>0 sélection A</strong> — recrutable. Les sélections de jeunes (U-17 → U-23) ne comptent pas : un joueur ayant joué pour une équipe de jeunes du Maroc ou d'un autre pays figure donc ici.",
    about_review:
      "Éligible pour le Maroc mais a déjà disputé un match A avec <strong>un autre pays</strong>. Souvent encore changeable (les amicaux ne lient pas un joueur), donc on le signale plutôt que de le cacher — à vérifier manuellement.",
    about_excluded:
      "Non affichés : déjà international A marocain (mission accomplie), ou engagé ailleurs.",
    about_s2_h: "La note équitable",
    about_s2_p:
      "Une note de match brute (comme celle de SofaScore) a deux angles morts : elle ignore <strong>combien de temps</strong> un joueur a été sur le terrain et <strong>la force</strong> de son championnat. Un attaquant qui marque en 10 minutes peut obtenir 8,0 ; un défenseur solide pendant 90 minutes obtient 7,0. Le cameo n'est pas meilleur. Notre note corrige cela en trois étapes :",
    about_step1:
      "<b>Pondérer par les minutes.</b> Une note sur 90 minutes compte bien plus qu'une note sur 10.",
    about_step2:
      "<b>Se méfier des petits échantillons.</b> Avec peu de minutes, la note est ramenée vers une moyenne de base — il faut accumuler des minutes avant qu'un gros chiffre tienne. C'est ce qui empêche le cameo de dominer le classement.",
    about_step3:
      "<b>Ajuster selon la force du championnat.</b> Le résultat est multiplié par un coefficient de championnat : un 7,0 en Premier League passe devant un 7,0 dans une division plus faible.",
    about_example:
      "<b>Exemple concret.</b> Un 8,0 sur 50 minutes toute la saison donne <b>6,82</b> ; un 7,0 sur 2700 minutes donne <b>6,95</b>. Le titulaire régulier ressort à juste titre en tête.",
    about_fine:
      "Seuls les <strong>matchs de championnat</strong> comptent (coupes et matchs internationaux exclus). Il faut <strong>450+ minutes de championnat</strong> pour intégrer le Meilleur XI. Les notes sont plus basses que les notes brutes à cause du multiplicateur de championnat et du recentrage vers la base — c'est normal, et c'est ce qui les rend comparables.",
    about_s3_h: "Force des championnats",
    about_s3_p:
      "Coefficients de départ fixés à la main (1,00 = le plus fort). Chaque match est pondéré par son championnat :",
    about_s4_h: "Glossaire",
    gloss_score_t: "Note",
    gloss_score_d:
      "Notre note équitable : pondérée par les minutes, ajustée à l'échantillon, pondérée par le championnat. Le critère de classement.",
    gloss_rating_t: "Note brute",
    gloss_rating_d:
      "La note de match moyenne brute, pour référence. La Note rend cette valeur comparable entre championnats.",
    gloss_mins_t: "Min / Matchs",
    gloss_mins_d:
      "Minutes de championnat jouées et apparitions cette saison — la taille de l'échantillon derrière la note.",
    gloss_pos_t: "Postes",
    gloss_pos_d:
      "GK gardien · CB défenseur central · FB latéral · DM/CM/AM milieu · W ailier · ST attaquant.",
    about_src:
      "Couvre {eligible} joueurs éligibles dans {leagues} divisions. Données : Transfermarkt (éligibilité) · SofaScore (notes & minutes). Saison 2025/26.",
    back: "← Retour au classement",
    fair_score: "note équitable",
    elig_h: "Éligibilité",
    elig_eligible:
      "N'a jamais disputé de match A pour aucun pays : il peut donc être appelé par le Maroc. (Les matchs de jeunes ne comptent pas.)",
    elig_review:
      "A {n} sélection{s} A avec un autre pays. S'il s'agissait d'amicaux — qui ne lient pas un joueur à un pays — il pourrait encore rejoindre le Maroc : à vérifier manuellement.",
    build_h: "Comment la note est calculée",
    build_tip:
      "Note moyenne pondérée par les minutes, ramenée vers une base pour les petits échantillons, puis multipliée par la force du championnat.",
    step_avg: "note moy. (pondérée par minutes)",
    step_adjusted: "ajustée à l'échantillon ({min} min)",
    step_league: "force du championnat",
    based_on: "Sur la base de {n} {matches} de championnat ({min} minutes) cette saison.",
    matches_one: "match",
    matches_many: "matchs",
    matchlog_h: "Journal des matchs",
    c_date: "Date",
    c_comp: "Compétition",
    c_rating: "Note",
    c_min: "Min",
    c_g: "B",
    c_a: "PD",
    excluded_tag: "exclu",
    cup_note:
      "Les matchs de coupe / hors championnat sont affichés mais ne comptent pas dans la note.",
    born: "né à",
    value: "valeur",
    not_found: "Joueur introuvable.",
    form_h: "Forme de la saison",
    form_note_thin: "Pas encore assez de matchs pour dégager une tendance.",
    form_baseline: "base",
    form_avg: "moy. saison",
    form_minutes: "taille = minutes",
    last5_h: "Forme récente",
    career_h: "Trajectoire de carrière",
    career_note: "Note équitable par saison (moyenne SofaScore, ajustée au championnat).",
    apps_short: "matchs",
  },
};
