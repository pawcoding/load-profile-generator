export interface MatomoContentPiece {
  label: string
  nb_visits: number
  /**
   * Die Anzahl, wie häufig ein Inhalt, z.b. ein Banner oder eine Anzeige, auf der Seite angezeigt wurden.
   */
  nb_impressions: number
  /**
   * Die Anzahl, wie häufig mit einem Inhalt interagiert wurde (z.B. durch einen Klick auf ein Banner oder eine Anzeige).
   */
  nb_interactions: number
  sum_daily_nb_uniq_visitors: number
  /**
   * Verhältnis zwischen Impressionen des Inhalts und Interaktionen.
   */
  interaction_rate: string
  segment: string
  idsubdatatable: number
}
